from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.common.numbering import next_number
from apps.common.views import CompanyScopedViewSet
from apps.hotel.models import FolioCharge, GuestFolio
from apps.tax.engine import compute_inclusive_tax_cents

from .models import BillingStatus, GymBooking, GymBookingLine, GymMembership
from .serializers import AddGymBookingLineSerializer, GymBookingSerializer, GymMembershipSerializer


def _charge_to_room(request, instance, source_description, receipt_prefix):
    if instance.status != BillingStatus.OPEN:
        raise ValidationError({"status": "Only an open record can be closed."})
    if instance.reservation_id is None:
        raise ValidationError({"reservation": "This has no room to charge — assign one first."})

    folio = getattr(instance.reservation, "folio", None)
    if folio is None or folio.status != GuestFolio.Status.OPEN:
        raise ValidationError({"reservation": "That guest's folio is closed — they may have already checked out."})

    with transaction.atomic():
        charge_amount_cents = instance.total_cents if hasattr(instance, "total_cents") else instance.price_cents
        FolioCharge.objects.create(
            company=instance.company,
            folio=folio,
            source_module=FolioCharge.SourceModule.GYM,
            description=source_description,
            amount_cents=charge_amount_cents,
            tax_amount_cents=compute_inclusive_tax_cents(
                instance.company, charge_amount_cents, applies_to_room=False
            ),
        )
        instance.status = BillingStatus.CHARGED_TO_ROOM
        instance.receipt_number = next_number(instance.company, receipt_prefix)
        instance.closed_at = timezone.now()
        instance.save(update_fields=["status", "receipt_number", "closed_at"])
    return instance


def _mark_paid(instance, receipt_prefix):
    if instance.status != BillingStatus.OPEN:
        raise ValidationError({"status": "Only an open record can be closed."})
    instance.status = BillingStatus.PAID
    instance.receipt_number = next_number(instance.company, receipt_prefix)
    instance.closed_at = timezone.now()
    instance.save(update_fields=["status", "receipt_number", "closed_at"])
    return instance


def _cancel(instance):
    if instance.status != BillingStatus.OPEN:
        raise ValidationError({"status": "Only an open record can be cancelled."})
    instance.status = BillingStatus.CANCELLED
    instance.save(update_fields=["status"])
    return instance


class GymMembershipViewSet(CompanyScopedViewSet):
    queryset = GymMembership.objects.select_related("guest", "reservation")
    serializer_class = GymMembershipSerializer
    permission_module = "gym"

    @action(detail=True, methods=["post"])
    def charge_to_room(self, request, pk=None):
        membership = self.get_object()
        membership = _charge_to_room(request, membership, f"Gym membership #{membership.id}", "GYM-M")
        return Response(GymMembershipSerializer(membership).data)

    @action(detail=True, methods=["post"])
    def mark_paid(self, request, pk=None):
        membership = _mark_paid(self.get_object(), "GYM-M")
        return Response(GymMembershipSerializer(membership).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        membership = _cancel(self.get_object())
        return Response(GymMembershipSerializer(membership).data)


class GymBookingViewSet(CompanyScopedViewSet):
    queryset = GymBooking.objects.select_related("reservation", "guest").prefetch_related("lines__activity", "lines__trainer")
    serializer_class = GymBookingSerializer
    permission_module = "gym"

    @action(detail=True, methods=["post"])
    def charge_to_room(self, request, pk=None):
        booking = self.get_object()
        line_count = booking.lines.count()
        booking = _charge_to_room(
            request, booking, f"Gym booking #{booking.id} ({line_count} activit{'y' if line_count == 1 else 'ies'})", "GYM"
        )
        return Response(GymBookingSerializer(booking).data)

    @action(detail=True, methods=["post"])
    def mark_paid(self, request, pk=None):
        booking = _mark_paid(self.get_object(), "GYM")
        return Response(GymBookingSerializer(booking).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        booking = _cancel(self.get_object())
        return Response(GymBookingSerializer(booking).data)


class GymBookingLineViewSet(CompanyScopedViewSet):
    queryset = GymBookingLine.objects.select_related("booking", "activity", "trainer").all()
    serializer_class = AddGymBookingLineSerializer
    permission_module = "gym"
    http_method_names = ["get", "post", "head", "options"]

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        return self._transition(pk, GymBookingLine.ActivityStatus.SCHEDULED, GymBookingLine.ActivityStatus.IN_PROGRESS)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        return self._transition(pk, GymBookingLine.ActivityStatus.IN_PROGRESS, GymBookingLine.ActivityStatus.COMPLETED)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        line = self.get_object()
        if line.status not in (GymBookingLine.ActivityStatus.SCHEDULED, GymBookingLine.ActivityStatus.IN_PROGRESS):
            raise ValidationError({"status": "Only a scheduled or in-progress activity can be cancelled."})
        line.status = GymBookingLine.ActivityStatus.CANCELLED
        line.save(update_fields=["status"])
        return Response(AddGymBookingLineSerializer(line).data)

    def _transition(self, pk, expected_from, to):
        line = self.get_object()
        if line.status != expected_from:
            raise ValidationError({"status": f"Only a '{expected_from}' activity can move to '{to}' from here."})
        line.status = to
        line.save(update_fields=["status"])
        return Response(AddGymBookingLineSerializer(line).data)
