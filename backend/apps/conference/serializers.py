from django.db import transaction
from rest_framework import serializers

from apps.common.serializers import CompanyScopedSerializer

from .models import ConferenceBooking, ConferenceBookingLine, ConferenceHall


class ConferenceHallSerializer(CompanyScopedSerializer):
    class Meta:
        model = ConferenceHall
        fields = ["id", "name", "capacity", "day_rate_cents", "description", "created_at"]
        read_only_fields = ["id", "created_at"]


class ConferenceBookingLineSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    line_total_cents = serializers.IntegerField(read_only=True)

    class Meta:
        model = ConferenceBookingLine
        fields = ["id", "booking", "item", "item_name", "quantity", "unit_price_cents", "line_total_cents", "created_at"]
        read_only_fields = ["id", "booking", "created_at"]


class ConferenceBookingSerializer(CompanyScopedSerializer):
    # status/receipt_number/closed_at are read-only — every billing
    # transition goes through charge_to_room/mark_paid/cancel, same
    # reasoning as every other module's booking/order. `lines` is only
    # accepted on create.
    same_company_fields = ["hall", "reservation", "guest"]
    lines = ConferenceBookingLineSerializer(many=True, required=False)
    hall_name = serializers.CharField(source="hall.name", read_only=True)
    guest_name = serializers.CharField(source="guest.name", read_only=True)
    hall_rate_cents = serializers.IntegerField(read_only=True)
    total_cents = serializers.IntegerField(read_only=True)

    class Meta:
        model = ConferenceBooking
        fields = [
            "id",
            "hall",
            "hall_name",
            "reservation",
            "guest",
            "guest_name",
            "event_name",
            "event_type",
            "seating_plan",
            "attendees",
            "start_at",
            "end_at",
            "status",
            "receipt_number",
            "hall_rate_cents",
            "total_cents",
            "lines",
            "notes",
            "closed_at",
            "created_at",
        ]
        read_only_fields = ["id", "status", "receipt_number", "closed_at", "created_at"]

    def validate(self, attrs):
        hall = attrs.get("hall") or getattr(self.instance, "hall", None)
        start_at = attrs.get("start_at") or getattr(self.instance, "start_at", None)
        end_at = attrs.get("end_at") or getattr(self.instance, "end_at", None)

        if start_at and end_at and start_at >= end_at:
            raise serializers.ValidationError({"end_at": "Must be after the start time."})

        if hall and start_at and end_at:
            overlapping = ConferenceBooking.objects.filter(
                hall=hall,
                status__in=[ConferenceBooking.Status.OPEN, ConferenceBooking.Status.PAID, ConferenceBooking.Status.CHARGED_TO_ROOM],
                start_at__lt=end_at,
                end_at__gt=start_at,
            )
            if self.instance:
                overlapping = overlapping.exclude(pk=self.instance.pk)
            if overlapping.exists():
                raise serializers.ValidationError(
                    {"hall": "Already booked by another event for an overlapping time range."}
                )

        return attrs

    def _create_lines(self, booking, company, lines_data):
        for line in lines_data:
            if line["item"].company_id != company.id:
                raise serializers.ValidationError({"lines": "All items must belong to the active company."})
            ConferenceBookingLine.objects.create(company=company, booking=booking, **line)

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        company = validated_data["company"]
        with transaction.atomic():
            booking = ConferenceBooking.objects.create(**validated_data)
            self._create_lines(booking, company, lines_data)
        return booking

    def update(self, instance, validated_data):
        validated_data.pop("lines", None)
        return super().update(instance, validated_data)


class AddConferenceBookingLineSerializer(serializers.ModelSerializer):
    """Adds one catering/equipment item to an already-open booking —
    mirrors apps.pos.serializers.AddOrderLineSerializer."""

    class Meta:
        model = ConferenceBookingLine
        fields = ["id", "booking", "item", "quantity", "unit_price_cents", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        company = getattr(request, "company", None) if request else None

        booking = attrs.get("booking")
        if company and booking.company_id != company.id:
            raise serializers.ValidationError({"booking": "Must belong to the active company."})
        if booking.status != ConferenceBooking.Status.OPEN:
            raise serializers.ValidationError({"booking": "Can't add items to a closed or cancelled booking."})

        item = attrs.get("item")
        if company and item.company_id != company.id:
            raise serializers.ValidationError({"item": "Must belong to the active company."})

        return attrs
