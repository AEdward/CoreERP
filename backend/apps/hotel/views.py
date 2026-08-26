from datetime import date

from django.db import transaction
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response

from apps.common.views import CompanyScopedReadOnlyViewSet, CompanyScopedViewSet
from apps.tax.engine import compute_inclusive_tax_cents


def _format_cents(cents):
    return f"{cents / 100:,.2f}"

from .models import (
    Building,
    Floor,
    FolioCharge,
    GroupReservation,
    GuestFolio,
    GuestPayment,
    GuestRefund,
    Reservation,
    Room,
    RoomBlock,
    RoomStatusLog,
    RoomTransfer,
    RoomType,
    SeasonalRate,
)
from .pricing import compute_suggested_rate_cents
from .serializers import (
    BuildingSerializer,
    FloorSerializer,
    FolioChargeSerializer,
    GroupReservationSerializer,
    GuestFolioSerializer,
    GuestPaymentSerializer,
    GuestRefundSerializer,
    ReservationSerializer,
    RoomBlockSerializer,
    RoomSerializer,
    RoomStatusLogSerializer,
    RoomTypeSerializer,
    SeasonalRateSerializer,
    SetRoomStatusSerializer,
)


class BuildingViewSet(CompanyScopedViewSet):
    queryset = Building.objects.all()
    serializer_class = BuildingSerializer
    permission_module = "hotel"


class FloorViewSet(CompanyScopedViewSet):
    queryset = Floor.objects.select_related("building").all()
    serializer_class = FloorSerializer
    permission_module = "hotel"


class RoomTypeViewSet(CompanyScopedViewSet):
    queryset = RoomType.objects.all()
    serializer_class = RoomTypeSerializer
    permission_module = "hotel"

    @action(detail=True, methods=["get"])
    def suggested_rate(self, request, pk=None):
        """Smart Pricing quote preview — the same computation
        `_create_reservation` falls back on when a booking doesn't name
        its own rate, exposed here so the front desk can see the number
        (and why) before committing to a booking."""
        room_type = self.get_object()
        check_in_raw = request.query_params.get("check_in_date")
        check_out_raw = request.query_params.get("check_out_date")
        if not check_in_raw or not check_out_raw:
            raise ValidationError(
                {"check_in_date": "check_in_date and check_out_date query params are required."}
            )
        try:
            check_in_date = date.fromisoformat(check_in_raw)
            check_out_date = date.fromisoformat(check_out_raw)
        except ValueError:
            raise ValidationError({"check_in_date": "Dates must be in YYYY-MM-DD format."})
        return Response(compute_suggested_rate_cents(room_type, check_in_date, check_out_date))


class SeasonalRateViewSet(CompanyScopedViewSet):
    queryset = SeasonalRate.objects.select_related("room_type").all()
    serializer_class = SeasonalRateSerializer
    permission_module = "hotel"


class RoomViewSet(CompanyScopedViewSet):
    queryset = Room.objects.select_related("floor", "room_type").all()
    serializer_class = RoomSerializer
    permission_module = "hotel"

    @action(detail=True, methods=["post"])
    def set_status(self, request, pk=None):
        """The only way Room.status changes — see RoomSerializer's
        comment: this guarantees a RoomStatusLog row for every change,
        which a plain PATCH on `status` couldn't."""
        room = self.get_object()
        serializer = SetRoomStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data["status"]

        with transaction.atomic():
            room.status = new_status
            room.save(update_fields=["status"])
            RoomStatusLog.objects.create(
                company=room.company, room=room, status=new_status, changed_by=request.user
            )
        return Response(RoomSerializer(room).data)


class RoomBlockViewSet(CompanyScopedViewSet):
    queryset = RoomBlock.objects.select_related("room", "created_by").all()
    serializer_class = RoomBlockSerializer
    permission_module = "hotel"


class RoomStatusLogViewSet(CompanyScopedReadOnlyViewSet):
    queryset = RoomStatusLog.objects.select_related("room", "changed_by").all()
    serializer_class = RoomStatusLogSerializer
    permission_module = "hotel"

    def get_queryset(self):
        qs = super().get_queryset()
        room_id = self.request.query_params.get("room")
        if room_id:
            qs = qs.filter(room_id=room_id)
        return qs


def _check_in_reservation(reservation, user):
    """Shared by ReservationViewSet.check_in and GroupReservationViewSet's
    bulk check_in_all — same validation and side effects either way, one
    reservation at a time."""
    if reservation.status != Reservation.Status.CONFIRMED:
        raise ValidationError({"status": "Only a confirmed reservation can be checked in."})
    if reservation.room_id is None:
        raise ValidationError({"room": "Assign a room before checking in."})
    guest = reservation.guest
    if not (guest.id_type and guest.id_number):
        raise ValidationError(
            {"guest": "Guest registration is incomplete — record an ID type and number before check-in."}
        )

    with transaction.atomic():
        reservation.status = Reservation.Status.CHECKED_IN
        reservation.save(update_fields=["status"])

        room = reservation.room
        room.status = Room.Status.OCCUPIED
        room.save(update_fields=["status"])
        RoomStatusLog.objects.create(
            company=room.company, room=room, status=Room.Status.OCCUPIED, changed_by=user
        )


def _check_out_reservation(reservation, user):
    """Shared by ReservationViewSet.check_out and GroupReservationViewSet's
    bulk check_out_all."""
    if reservation.status != Reservation.Status.CHECKED_IN:
        raise ValidationError({"status": "Only a checked-in reservation can be checked out."})

    with transaction.atomic():
        update_fields = ["status"]
        reservation.status = Reservation.Status.CHECKED_OUT

        folio = getattr(reservation, "folio", None)
        if reservation.travel_agency_id is not None and folio is not None:
            # Computed once, from the final folio balance and the
            # agency's rate right now — see Reservation.commission_cents'
            # own docstring for why this never gets recomputed later.
            reservation.commission_cents = round(
                folio.balance_cents * reservation.travel_agency.commission_rate_percent / 100
            )
            update_fields.append("commission_cents")
        reservation.save(update_fields=update_fields)

        room = reservation.room
        if room is not None:
            room.status = Room.Status.DIRTY
            room.save(update_fields=["status"])
            RoomStatusLog.objects.create(
                company=room.company, room=room, status=Room.Status.DIRTY, changed_by=user
            )

        if folio is not None and folio.status == GuestFolio.Status.OPEN:
            folio.status = GuestFolio.Status.CLOSED
            folio.save(update_fields=["status"])


class ReservationViewSet(CompanyScopedViewSet):
    queryset = Reservation.objects.select_related("guest", "room_type", "room").prefetch_related(
        "room_transfers__from_room", "room_transfers__to_room"
    )
    serializer_class = ReservationSerializer
    permission_module = "hotel"

    # status/confirmation_number are read-only on the serializer — every
    # transition goes through one of these three actions instead of a
    # plain PATCH, so the room-status and folio side effects below always
    # happen together with the status change, never separately.

    @action(detail=True, methods=["post"])
    def check_in(self, request, pk=None):
        reservation = self.get_object()
        _check_in_reservation(reservation, request.user)
        return Response(ReservationSerializer(reservation).data)

    @action(detail=True, methods=["post"])
    def check_out(self, request, pk=None):
        reservation = self.get_object()
        _check_out_reservation(reservation, request.user)
        return Response(ReservationSerializer(reservation).data)

    @action(detail=True, methods=["post"])
    def transfer_room(self, request, pk=None):
        reservation = self.get_object()
        if reservation.status != Reservation.Status.CHECKED_IN:
            raise ValidationError({"status": "Only a checked-in reservation can transfer rooms."})

        new_room_id = request.data.get("room")
        if not new_room_id:
            raise ValidationError({"room": "Required."})
        try:
            new_room = Room.objects.get(pk=new_room_id, company=request.company)
        except Room.DoesNotExist:
            raise ValidationError({"room": "Must belong to the active company."}) from None

        old_room = reservation.room
        if old_room is not None and new_room.id == old_room.id:
            raise ValidationError({"room": "Already in this room."})

        # Same overlap check ReservationSerializer.validate applies at
        # booking time — a transfer is just a very late room reassignment,
        # it shouldn't skip the check that reassignment already gets.
        overlapping = Reservation.objects.filter(
            room=new_room,
            status__in=[Reservation.Status.CONFIRMED, Reservation.Status.CHECKED_IN],
            check_in_date__lt=reservation.check_out_date,
            check_out_date__gt=reservation.check_in_date,
        ).exclude(pk=reservation.pk)
        if overlapping.exists():
            raise ValidationError(
                {"room": "Already booked by another reservation for an overlapping date range."}
            )

        with transaction.atomic():
            RoomTransfer.objects.create(
                company=request.company,
                reservation=reservation,
                from_room=old_room,
                to_room=new_room,
                reason=request.data.get("reason", ""),
                transferred_by=request.user,
            )

            reservation.room = new_room
            reservation.room_type = new_room.room_type
            reservation.save(update_fields=["room", "room_type"])

            new_room.status = Room.Status.OCCUPIED
            new_room.save(update_fields=["status"])
            RoomStatusLog.objects.create(
                company=new_room.company, room=new_room, status=Room.Status.OCCUPIED, changed_by=request.user
            )

            if old_room is not None:
                old_room.status = Room.Status.DIRTY
                old_room.save(update_fields=["status"])
                RoomStatusLog.objects.create(
                    company=old_room.company, room=old_room, status=Room.Status.DIRTY, changed_by=request.user
                )

        # self.get_object() prefetched room_transfers (empty) before the
        # RoomTransfer above was created — refresh_from_db() clears that
        # cache so the response actually reflects the new transfer.
        reservation.refresh_from_db()
        return Response(ReservationSerializer(reservation).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        reservation = self.get_object()
        if reservation.status != Reservation.Status.CONFIRMED:
            raise ValidationError({"status": "Only a confirmed reservation can be cancelled."})

        reservation.status = Reservation.Status.CANCELLED
        reservation.save(update_fields=["status"])
        return Response(ReservationSerializer(reservation).data)

    @action(detail=True, methods=["post"])
    def mark_no_show(self, request, pk=None):
        reservation = self.get_object()
        if reservation.status != Reservation.Status.CONFIRMED:
            raise ValidationError({"status": "Only a confirmed reservation can be marked a no-show."})

        with transaction.atomic():
            reservation.status = Reservation.Status.NO_SHOW
            reservation.save(update_fields=["status"])
            room = reservation.room
            if room is not None:
                room.status = Room.Status.AVAILABLE
                room.save(update_fields=["status"])
                RoomStatusLog.objects.create(
                    company=room.company, room=room, status=Room.Status.AVAILABLE, changed_by=request.user
                )
        return Response(ReservationSerializer(reservation).data)

    @action(detail=True, methods=["post"])
    def approve_late_checkout(self, request, pk=None):
        """Optionally posts a fee to the folio — see FolioCharge.tax_amount_cents'
        docstring for why the tax portion is computed the same way a
        manual folio charge's is."""
        reservation = self.get_object()
        if reservation.status != Reservation.Status.CHECKED_IN:
            raise ValidationError({"status": "Only a checked-in reservation can get a late check-out."})

        fee_cents = int(request.data.get("fee_cents") or 0)
        with transaction.atomic():
            reservation.late_checkout_approved = True
            reservation.save(update_fields=["late_checkout_approved"])
            folio = getattr(reservation, "folio", None)
            if fee_cents > 0 and folio is not None and folio.status == GuestFolio.Status.OPEN:
                FolioCharge.objects.create(
                    company=request.company,
                    folio=folio,
                    source_module=FolioCharge.SourceModule.ROOM,
                    description="Late check-out fee",
                    amount_cents=fee_cents,
                    tax_amount_cents=compute_inclusive_tax_cents(request.company, fee_cents, applies_to_room=True),
                )
        return Response(ReservationSerializer(reservation).data)

    @action(detail=True, methods=["post"])
    def approve_early_checkin(self, request, pk=None):
        reservation = self.get_object()
        if reservation.status != Reservation.Status.CONFIRMED:
            raise ValidationError({"status": "Only a confirmed reservation can get an early check-in."})

        reservation.early_checkin_approved = True
        reservation.save(update_fields=["early_checkin_approved"])
        return Response(ReservationSerializer(reservation).data)


class GroupReservationViewSet(CompanyScopedViewSet):
    queryset = GroupReservation.objects.select_related("organizer").prefetch_related(
        "reservations__guest", "reservations__room_type", "reservations__room"
    )
    serializer_class = GroupReservationSerializer
    permission_module = "hotel"

    @action(detail=True, methods=["post"])
    def check_in_all(self, request, pk=None):
        group = self.get_object()
        checked_in, skipped = [], []
        for reservation in group.reservations.all():
            try:
                _check_in_reservation(reservation, request.user)
                checked_in.append(reservation.id)
            except ValidationError as exc:
                skipped.append({"reservation": reservation.id, "detail": exc.detail})
        return Response({"checked_in": checked_in, "skipped": skipped})

    @action(detail=True, methods=["post"])
    def check_out_all(self, request, pk=None):
        group = self.get_object()
        checked_out, skipped = [], []
        for reservation in group.reservations.all():
            try:
                _check_out_reservation(reservation, request.user)
                checked_out.append(reservation.id)
            except ValidationError as exc:
                skipped.append({"reservation": reservation.id, "detail": exc.detail})
        return Response({"checked_out": checked_out, "skipped": skipped})


class GuestFolioViewSet(CompanyScopedReadOnlyViewSet):
    """Read-only — a folio is created automatically with its reservation
    and closed automatically at check-out; nothing creates or edits one
    directly."""

    queryset = GuestFolio.objects.select_related("reservation__guest", "reservation__room_type", "reservation__room").prefetch_related(
        "charges", "payments", "refunds"
    )
    serializer_class = GuestFolioSerializer
    permission_module = "hotel"

    @action(detail=True, methods=["get"])
    def pdf(self, request, pk=None):
        try:
            from weasyprint import HTML
        except (ImportError, OSError) as exc:
            raise APIException(
                "PDF generation is unavailable on this server — WeasyPrint's native "
                "libraries (Pango/GObject/Cairo) aren't installed. See "
                "https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#installation."
            ) from exc

        folio = self.get_object()
        reservation = folio.reservation
        html = render_to_string(
            "hotel/invoice_pdf.html",
            {
                "company": request.company,
                "confirmation_number": reservation.confirmation_number,
                "guest_name": reservation.guest.name,
                "room_type_name": reservation.room_type.name,
                "room_number": reservation.room.number if reservation.room_id else "",
                "check_in_date": reservation.check_in_date.isoformat(),
                "check_out_date": reservation.check_out_date.isoformat(),
                "folio_status": folio.get_status_display(),
                "charges": [
                    {"description": c.description, "source_module": c.get_source_module_display(), "amount": _format_cents(c.amount_cents)}
                    for c in folio.charges.all()
                ],
                "payments": [
                    {"method": p.get_method_display(), "reference": p.reference, "amount": _format_cents(p.amount_cents)}
                    for p in folio.payments.all()
                ],
                "refunds": [
                    {"reason": r.reason, "amount": _format_cents(r.amount_cents)} for r in folio.refunds.all()
                ],
                "balance_due": _format_cents(folio.balance_cents),
                "generated_on": timezone.localdate().isoformat(),
            },
        )
        pdf_bytes = HTML(string=html).write_pdf()
        filename = f"invoice-{reservation.confirmation_number or folio.id}.pdf"
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class FolioChargeViewSet(CompanyScopedViewSet):
    queryset = FolioCharge.objects.select_related("folio").all()
    serializer_class = FolioChargeSerializer
    permission_module = "hotel"
    http_method_names = ["get", "post", "head", "options"]  # append-only ledger, like StockMovement


class GuestPaymentViewSet(CompanyScopedViewSet):
    queryset = GuestPayment.objects.select_related("folio", "received_by").all()
    serializer_class = GuestPaymentSerializer
    permission_module = "hotel"
    http_method_names = ["get", "post", "head", "options"]  # append-only ledger, like FolioCharge


class GuestRefundViewSet(CompanyScopedViewSet):
    queryset = GuestRefund.objects.select_related("folio", "payment", "issued_by").all()
    serializer_class = GuestRefundSerializer
    permission_module = "hotel"
    http_method_names = ["get", "post", "head", "options"]
