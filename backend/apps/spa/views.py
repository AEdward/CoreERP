from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.common.numbering import next_number
from apps.common.views import CompanyScopedViewSet
from apps.hotel.models import FolioCharge, GuestFolio
from apps.tax.engine import compute_inclusive_tax_cents

from .models import SpaBooking, SpaBookingLine
from .serializers import AddSpaBookingLineSerializer, SpaBookingSerializer


class SpaBookingViewSet(CompanyScopedViewSet):
    queryset = SpaBooking.objects.select_related("reservation", "guest").prefetch_related("lines__treatment", "lines__therapist")
    serializer_class = SpaBookingSerializer
    permission_module = "spa"

    @action(detail=True, methods=["post"])
    def charge_to_room(self, request, pk=None):
        booking = self.get_object()
        if booking.status != SpaBooking.Status.OPEN:
            raise ValidationError({"status": "Only an open booking can be closed."})
        if booking.reservation_id is None:
            raise ValidationError({"reservation": "This booking has no room to charge — assign one first."})

        folio = getattr(booking.reservation, "folio", None)
        if folio is None or folio.status != GuestFolio.Status.OPEN:
            raise ValidationError(
                {"reservation": "That guest's folio is closed — they may have already checked out."}
            )

        with transaction.atomic():
            line_count = booking.lines.count()
            FolioCharge.objects.create(
                company=booking.company,
                folio=folio,
                source_module=FolioCharge.SourceModule.SPA,
                description=f"Spa booking #{booking.id} ({line_count} treatment{'s' if line_count != 1 else ''})",
                amount_cents=booking.total_cents,
                tax_amount_cents=compute_inclusive_tax_cents(
                    booking.company, booking.total_cents, applies_to_room=False
                ),
            )
            booking.status = SpaBooking.Status.CHARGED_TO_ROOM
            booking.receipt_number = next_number(booking.company, "SPA")
            booking.closed_at = timezone.now()
            booking.save(update_fields=["status", "receipt_number", "closed_at"])

        return Response(SpaBookingSerializer(booking).data)

    @action(detail=True, methods=["post"])
    def mark_paid(self, request, pk=None):
        booking = self.get_object()
        if booking.status != SpaBooking.Status.OPEN:
            raise ValidationError({"status": "Only an open booking can be closed."})

        booking.status = SpaBooking.Status.PAID
        booking.receipt_number = next_number(booking.company, "SPA")
        booking.closed_at = timezone.now()
        booking.save(update_fields=["status", "receipt_number", "closed_at"])
        return Response(SpaBookingSerializer(booking).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        booking = self.get_object()
        if booking.status != SpaBooking.Status.OPEN:
            raise ValidationError({"status": "Only an open booking can be cancelled."})
        booking.status = SpaBooking.Status.CANCELLED
        booking.save(update_fields=["status"])
        return Response(SpaBookingSerializer(booking).data)


class SpaBookingLineViewSet(CompanyScopedViewSet):
    """Adding a treatment to an already-open booking, plus its own
    scheduling lifecycle (start/complete/cancel) — mirrors
    apps.housekeeping.HousekeepingTaskViewSet's start/complete/cancel."""

    queryset = SpaBookingLine.objects.select_related("booking", "treatment", "therapist").all()
    serializer_class = AddSpaBookingLineSerializer
    permission_module = "spa"
    http_method_names = ["get", "post", "head", "options"]

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        return self._transition(pk, SpaBookingLine.TreatmentStatus.SCHEDULED, SpaBookingLine.TreatmentStatus.IN_PROGRESS)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        return self._transition(pk, SpaBookingLine.TreatmentStatus.IN_PROGRESS, SpaBookingLine.TreatmentStatus.COMPLETED)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        line = self.get_object()
        if line.status not in (SpaBookingLine.TreatmentStatus.SCHEDULED, SpaBookingLine.TreatmentStatus.IN_PROGRESS):
            raise ValidationError({"status": "Only a scheduled or in-progress treatment can be cancelled."})
        line.status = SpaBookingLine.TreatmentStatus.CANCELLED
        line.save(update_fields=["status"])
        return Response(AddSpaBookingLineSerializer(line).data)

    def _transition(self, pk, expected_from, to):
        line = self.get_object()
        if line.status != expected_from:
            raise ValidationError({"status": f"Only a '{expected_from}' treatment can move to '{to}' from here."})
        line.status = to
        line.save(update_fields=["status"])
        return Response(AddSpaBookingLineSerializer(line).data)
