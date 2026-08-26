from django.db import transaction
from rest_framework import serializers

from apps.common.numbering import next_number
from apps.common.serializers import CompanyScopedSerializer
from apps.crm.models import Customer
from apps.tax.engine import compute_inclusive_tax_cents

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


def _create_reservation(validated_data):
    """Shared by ReservationSerializer.create (a single booking) and
    GroupReservationSerializer.create (one call per member room) — same
    rate default, confirmation numbering, and folio creation either way.
    Caller is responsible for wrapping this in a transaction.

    When nobody names a rate, the default is the Smart Pricing suggestion
    (seasonal override + occupancy surge) rather than a flat
    room_type.base_rate_cents — computed once here, same locking
    principle Reservation.rate_cents' own docstring already documents.
    """
    if not validated_data.get("rate_cents"):
        pricing = compute_suggested_rate_cents(
            validated_data["room_type"], validated_data["check_in_date"], validated_data["check_out_date"]
        )
        validated_data["rate_cents"] = pricing["suggested_rate_cents"]
    reservation = Reservation.objects.create(**validated_data)
    reservation.confirmation_number = next_number(reservation.company, "RES")
    reservation.save(update_fields=["confirmation_number"])
    GuestFolio.objects.create(company=reservation.company, reservation=reservation)
    return reservation


class BuildingSerializer(CompanyScopedSerializer):
    same_company_fields = ["branch"]

    class Meta:
        model = Building
        fields = ["id", "name", "branch", "created_at"]
        read_only_fields = ["id", "created_at"]


class FloorSerializer(CompanyScopedSerializer):
    same_company_fields = ["building"]

    class Meta:
        model = Floor
        fields = ["id", "building", "name", "level", "created_at"]
        read_only_fields = ["id", "created_at"]


class RoomTypeSerializer(CompanyScopedSerializer):
    class Meta:
        model = RoomType
        fields = [
            "id",
            "name",
            "description",
            "base_rate_cents",
            "max_occupancy",
            "amenities",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class SeasonalRateSerializer(CompanyScopedSerializer):
    same_company_fields = ["room_type"]
    room_type_name = serializers.CharField(source="room_type.name", read_only=True)

    class Meta:
        model = SeasonalRate
        fields = ["id", "room_type", "room_type_name", "name", "start_date", "end_date", "rate_cents", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "End date must be on or after the start date."})
        return attrs


class RoomBlockSerializer(CompanyScopedSerializer):
    same_company_fields = ["room"]
    room_number = serializers.CharField(source="room.number", read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True, default="")

    class Meta:
        model = RoomBlock
        fields = [
            "id",
            "room",
            "room_number",
            "start_date",
            "end_date",
            "reason",
            "created_by",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_by", "created_by_name", "created_at"]

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "End date must be on or after the start date."})
        return attrs

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class RoomStatusLogSerializer(CompanyScopedSerializer):
    changed_by_name = serializers.CharField(source="changed_by.full_name", read_only=True)

    class Meta:
        model = RoomStatusLog
        fields = ["id", "room", "status", "changed_by", "changed_by_name", "created_at"]
        read_only_fields = fields


class RoomSerializer(CompanyScopedSerializer):
    # Status is deliberately read-only here and mutated only through
    # RoomViewSet.set_status — same principle as apps.inventory.Stock
    # being read-only over StockMovement, so every status change is
    # guaranteed to also write a RoomStatusLog, not just sometimes.
    same_company_fields = ["floor", "room_type"]
    room_type_name = serializers.CharField(source="room_type.name", read_only=True)

    class Meta:
        model = Room
        fields = ["id", "floor", "room_type", "room_type_name", "number", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]


class SetRoomStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Room.Status.choices)


class FolioChargeSerializer(CompanyScopedSerializer):
    same_company_fields = ["folio"]

    class Meta:
        model = FolioCharge
        fields = [
            "id",
            "folio",
            "source_module",
            "description",
            "amount_cents",
            "tax_amount_cents",
            "created_at",
        ]
        read_only_fields = ["id", "tax_amount_cents", "created_at"]

    def validate_folio(self, folio):
        if folio.status != GuestFolio.Status.OPEN:
            raise serializers.ValidationError("This folio is closed — no new charges can be posted.")
        return folio

    def create(self, validated_data):
        validated_data["tax_amount_cents"] = compute_inclusive_tax_cents(
            validated_data["company"],
            validated_data["amount_cents"],
            applies_to_room=validated_data["source_module"] == FolioCharge.SourceModule.ROOM,
        )
        return super().create(validated_data)


class GuestPaymentSerializer(CompanyScopedSerializer):
    same_company_fields = ["folio"]
    received_by_name = serializers.CharField(source="received_by.full_name", read_only=True, default="")

    class Meta:
        model = GuestPayment
        fields = [
            "id",
            "folio",
            "method",
            "amount_cents",
            "reference",
            "received_by",
            "received_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "received_by", "received_by_name", "created_at"]

    def validate_amount_cents(self, value):
        if value <= 0:
            raise serializers.ValidationError("Must be greater than zero.")
        return value

    def create(self, validated_data):
        validated_data["received_by"] = self.context["request"].user
        return super().create(validated_data)


class GuestRefundSerializer(CompanyScopedSerializer):
    same_company_fields = ["folio", "payment"]
    issued_by_name = serializers.CharField(source="issued_by.full_name", read_only=True, default="")

    class Meta:
        model = GuestRefund
        fields = [
            "id",
            "folio",
            "payment",
            "amount_cents",
            "reason",
            "issued_by",
            "issued_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "issued_by", "issued_by_name", "created_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        amount = attrs.get("amount_cents")
        if amount is not None and amount <= 0:
            raise serializers.ValidationError({"amount_cents": "Must be greater than zero."})
        payment = attrs.get("payment")
        if payment is not None and amount is not None and amount > payment.amount_cents:
            raise serializers.ValidationError({"amount_cents": "Can't refund more than the payment itself."})
        return attrs

    def create(self, validated_data):
        validated_data["issued_by"] = self.context["request"].user
        return super().create(validated_data)


class GuestFolioSerializer(CompanyScopedSerializer):
    charges = FolioChargeSerializer(many=True, read_only=True)
    payments = GuestPaymentSerializer(many=True, read_only=True)
    refunds = GuestRefundSerializer(many=True, read_only=True)
    balance_cents = serializers.IntegerField(read_only=True)

    class Meta:
        model = GuestFolio
        fields = ["id", "reservation", "status", "balance_cents", "charges", "payments", "refunds", "created_at"]
        read_only_fields = fields


class RoomTransferSerializer(serializers.ModelSerializer):
    from_room_number = serializers.CharField(source="from_room.number", read_only=True)
    to_room_number = serializers.CharField(source="to_room.number", read_only=True)

    class Meta:
        model = RoomTransfer
        fields = ["id", "from_room", "from_room_number", "to_room", "to_room_number", "reason", "created_at"]
        read_only_fields = fields


class ReservationSerializer(CompanyScopedSerializer):
    # status and confirmation_number are read-only: transitions go through
    # ReservationViewSet's check_in/check_out/cancel/transfer_room actions,
    # which also carry the room-status and folio side effects a plain
    # PATCH can't be trusted to remember — same reasoning as Room.status
    # above.
    same_company_fields = ["guest", "room_type", "room", "travel_agency"]
    guest_name = serializers.CharField(source="guest.name", read_only=True)
    room_type_name = serializers.CharField(source="room_type.name", read_only=True)
    room_number = serializers.CharField(source="room.number", read_only=True)
    travel_agency_name = serializers.CharField(source="travel_agency.name", read_only=True, default="")
    group_name = serializers.CharField(source="group.name", read_only=True, default="")
    room_transfers = RoomTransferSerializer(many=True, read_only=True)

    class Meta:
        model = Reservation
        fields = [
            "id",
            "guest",
            "guest_name",
            "room_type",
            "room_type_name",
            "room",
            "room_number",
            "source",
            "travel_agency",
            "travel_agency_name",
            "commission_cents",
            "group",
            "group_name",
            "status",
            "check_in_date",
            "check_out_date",
            "adults",
            "children",
            "rate_cents",
            "confirmation_number",
            "room_transfers",
            "late_checkout_approved",
            "early_checkin_approved",
            "created_at",
        ]
        # group is only ever set through GroupReservationSerializer.create,
        # never client-writable on a plain reservation create/update.
        read_only_fields = [
            "id",
            "status",
            "confirmation_number",
            "commission_cents",
            "group",
            "late_checkout_approved",
            "early_checkin_approved",
            "created_at",
        ]
        extra_kwargs = {"rate_cents": {"required": False}}

    def validate(self, attrs):
        attrs = super().validate(attrs)
        check_in = attrs.get("check_in_date", getattr(self.instance, "check_in_date", None))
        check_out = attrs.get("check_out_date", getattr(self.instance, "check_out_date", None))
        if check_in and check_out and check_out <= check_in:
            raise serializers.ValidationError(
                {"check_out_date": "Must be after the check-in date."}
            )

        source = attrs.get("source", getattr(self.instance, "source", None))
        travel_agency = attrs.get("travel_agency", getattr(self.instance, "travel_agency", None))
        if source == Reservation.Source.TRAVEL_AGENCY and travel_agency is None:
            raise serializers.ValidationError(
                {"travel_agency": "Required when the source is Travel Agency."}
            )

        room = attrs.get("room", getattr(self.instance, "room", None))
        if room is not None and check_in and check_out:
            overlapping = Reservation.objects.filter(
                room=room,
                status__in=[Reservation.Status.CONFIRMED, Reservation.Status.CHECKED_IN],
                check_in_date__lt=check_out,
                check_out_date__gt=check_in,
            )
            if self.instance:
                overlapping = overlapping.exclude(pk=self.instance.pk)
            if overlapping.exists():
                raise serializers.ValidationError(
                    {"room": "Already booked by another reservation for an overlapping date range."}
                )

        return attrs

    def create(self, validated_data):
        with transaction.atomic():
            return _create_reservation(validated_data)


class GroupReservationSerializer(CompanyScopedSerializer):
    """A group's own `check_in_date`/`check_out_date` apply to every
    member room — this isn't a general-purpose multi-booking tool, it's
    specifically for the common case (a wedding party, a tour group) of
    one shared stay. `rooms` is write-only: a list of
    `{guest, room_type, room?, rate_cents?, adults?, children?}` dicts,
    one real `Reservation` created per entry via the same
    `_create_reservation` helper a single booking uses."""

    same_company_fields = ["organizer"]
    organizer_name = serializers.CharField(source="organizer.name", read_only=True)
    reservations = ReservationSerializer(many=True, read_only=True)
    rooms = serializers.ListField(child=serializers.DictField(), write_only=True)

    class Meta:
        model = GroupReservation
        fields = [
            "id",
            "name",
            "organizer",
            "organizer_name",
            "check_in_date",
            "check_out_date",
            "notes",
            "reservations",
            "rooms",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        check_in = attrs.get("check_in_date", getattr(self.instance, "check_in_date", None))
        check_out = attrs.get("check_out_date", getattr(self.instance, "check_out_date", None))
        if check_in and check_out and check_out <= check_in:
            raise serializers.ValidationError(
                {"check_out_date": "Must be after the check-in date."}
            )
        return attrs

    def validate_rooms(self, rooms):
        if not rooms:
            raise serializers.ValidationError("At least one room is required.")
        return rooms

    def create(self, validated_data):
        rooms_data = validated_data.pop("rooms")
        company = validated_data["company"]
        check_in = validated_data["check_in_date"]
        check_out = validated_data["check_out_date"]

        with transaction.atomic():
            group = GroupReservation.objects.create(**validated_data)
            for i, room_spec in enumerate(rooms_data):
                guest_id = room_spec.get("guest")
                room_type_id = room_spec.get("room_type")
                if not guest_id or not room_type_id:
                    raise serializers.ValidationError(
                        {"rooms": f"Room {i + 1}: guest and room_type are required."}
                    )
                try:
                    guest = Customer.objects.get(pk=guest_id, company=company)
                except Customer.DoesNotExist:
                    raise serializers.ValidationError(
                        {"rooms": f"Room {i + 1}: guest must belong to the active company."}
                    ) from None
                try:
                    room_type = RoomType.objects.get(pk=room_type_id, company=company)
                except RoomType.DoesNotExist:
                    raise serializers.ValidationError(
                        {"rooms": f"Room {i + 1}: room_type must belong to the active company."}
                    ) from None
                room = None
                if room_spec.get("room"):
                    try:
                        room = Room.objects.get(pk=room_spec["room"], company=company)
                    except Room.DoesNotExist:
                        raise serializers.ValidationError(
                            {"rooms": f"Room {i + 1}: room must belong to the active company."}
                        ) from None
                    overlapping = Reservation.objects.filter(
                        room=room,
                        status__in=[Reservation.Status.CONFIRMED, Reservation.Status.CHECKED_IN],
                        check_in_date__lt=check_out,
                        check_out_date__gt=check_in,
                    )
                    if overlapping.exists():
                        raise serializers.ValidationError(
                            {"rooms": f"Room {i + 1}: already booked for an overlapping date range."}
                        )

                _create_reservation(
                    {
                        "company": company,
                        "guest": guest,
                        "room_type": room_type,
                        "room": room,
                        "source": Reservation.Source.GROUP,
                        "group": group,
                        "check_in_date": check_in,
                        "check_out_date": check_out,
                        "adults": room_spec.get("adults", 1),
                        "children": room_spec.get("children", 0),
                        "rate_cents": room_spec.get("rate_cents"),
                    }
                )
        return group
