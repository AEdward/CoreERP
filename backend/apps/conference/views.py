from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.common.numbering import next_number
from apps.common.views import CompanyScopedViewSet
from apps.hotel.models import FolioCharge, GuestFolio
from apps.tax.engine import compute_inclusive_tax_cents

from .models import ConferenceBooking, ConferenceBookingLine, ConferenceHall
from .serializers import AddConferenceBookingLineSerializer, ConferenceBookingSerializer, ConferenceHallSerializer


class ConferenceHallViewSet(CompanyScopedViewSet):
    queryset = ConferenceHall.objects.all()
    serializer_class = ConferenceHallSerializer
    permission_module = "conference"


class ConferenceBookingViewSet(CompanyScopedViewSet):
    queryset = ConferenceBooking.objects.select_related("hall", "reservation", "guest").prefetch_related("lines__item")
    serializer_class = ConferenceBookingSerializer
    permission_module = "conference"

    @action(detail=True, methods=["post"])
    def charge_to_room(self, request, pk=None):
        booking = self.get_object()
        if booking.status != ConferenceBooking.Status.OPEN:
            raise ValidationError({"status": "Only an open booking can be closed."})
        if booking.reservation_id is None:
            raise ValidationError({"reservation": "This booking has no room to charge — assign one first."})

        folio = getattr(booking.reservation, "folio", None)
        if folio is None or folio.status != GuestFolio.Status.OPEN:
            raise ValidationError(
                {"reservation": "That guest's folio is closed — they may have already checked out."}
            )

        with transaction.atomic():
            FolioCharge.objects.create(
                company=booking.company,
                folio=folio,
                source_module=FolioCharge.SourceModule.CONFERENCE,
                description=f"Conference booking #{booking.id} — {booking.event_name}",
                amount_cents=booking.total_cents,
                tax_amount_cents=compute_inclusive_tax_cents(
                    booking.company, booking.total_cents, applies_to_room=False
                ),
            )
            booking.status = ConferenceBooking.Status.CHARGED_TO_ROOM
            booking.receipt_number = next_number(booking.company, "CNF")
            booking.closed_at = timezone.now()
            booking.save(update_fields=["status", "receipt_number", "closed_at"])

        return Response(ConferenceBookingSerializer(booking).data)

    @action(detail=True, methods=["post"])
    def mark_paid(self, request, pk=None):
        booking = self.get_object()
        if booking.status != ConferenceBooking.Status.OPEN:
            raise ValidationError({"status": "Only an open booking can be closed."})

        booking.status = ConferenceBooking.Status.PAID
        booking.receipt_number = next_number(booking.company, "CNF")
        booking.closed_at = timezone.now()
        booking.save(update_fields=["status", "receipt_number", "closed_at"])
        return Response(ConferenceBookingSerializer(booking).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        booking = self.get_object()
        if booking.status != ConferenceBooking.Status.OPEN:
            raise ValidationError({"status": "Only an open booking can be cancelled."})
        booking.status = ConferenceBooking.Status.CANCELLED
        booking.save(update_fields=["status"])
        return Response(ConferenceBookingSerializer(booking).data)


class ConferenceBookingLineViewSet(CompanyScopedViewSet):
    queryset = ConferenceBookingLine.objects.select_related("booking", "item").all()
    serializer_class = AddConferenceBookingLineSerializer
    permission_module = "conference"
    http_method_names = ["get", "post", "head", "options"]
