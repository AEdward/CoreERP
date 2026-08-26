from django.db import transaction
from rest_framework import serializers

from apps.common.serializers import CompanyScopedSerializer

from .models import SpaBooking, SpaBookingLine


class SpaBookingLineSerializer(serializers.ModelSerializer):
    treatment_name = serializers.CharField(source="treatment.name", read_only=True)
    therapist_name = serializers.CharField(source="therapist.full_name", read_only=True)
    line_total_cents = serializers.IntegerField(read_only=True)

    class Meta:
        model = SpaBookingLine
        fields = [
            "id",
            "booking",
            "treatment",
            "treatment_name",
            "therapist",
            "therapist_name",
            "scheduled_at",
            "duration_minutes",
            "quantity",
            "unit_price_cents",
            "status",
            "line_total_cents",
            "created_at",
        ]
        read_only_fields = ["id", "booking", "status", "created_at"]


class SpaBookingSerializer(CompanyScopedSerializer):
    # status/receipt_number/closed_at are read-only — every billing
    # transition goes through charge_to_room/mark_paid/cancel, same
    # reasoning as apps.pos.Order/apps.laundry.LaundryOrder. `lines` is
    # only accepted on create — adding a treatment to an already-open
    # booking goes through AddSpaBookingLineSerializer instead, same
    # split as apps.pos's AddOrderLineSerializer.
    same_company_fields = ["reservation", "guest"]
    lines = SpaBookingLineSerializer(many=True, required=False)
    guest_name = serializers.CharField(source="guest.name", read_only=True)
    total_cents = serializers.IntegerField(read_only=True)

    class Meta:
        model = SpaBooking
        fields = [
            "id",
            "reservation",
            "guest",
            "guest_name",
            "status",
            "receipt_number",
            "total_cents",
            "lines",
            "notes",
            "closed_at",
            "created_at",
        ]
        read_only_fields = ["id", "status", "receipt_number", "closed_at", "created_at"]

    def _create_lines(self, booking, company, lines_data):
        for line in lines_data:
            if line["treatment"].company_id != company.id:
                raise serializers.ValidationError({"lines": "All treatments must belong to the active company."})
            SpaBookingLine.objects.create(company=company, booking=booking, **line)

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        company = validated_data["company"]
        with transaction.atomic():
            booking = SpaBooking.objects.create(**validated_data)
            self._create_lines(booking, company, lines_data)
        return booking

    def update(self, instance, validated_data):
        validated_data.pop("lines", None)
        return super().update(instance, validated_data)


class AddSpaBookingLineSerializer(serializers.ModelSerializer):
    """Adds one treatment to an already-open booking — mirrors
    apps.pos.serializers.AddOrderLineSerializer."""

    class Meta:
        model = SpaBookingLine
        fields = [
            "id",
            "booking",
            "treatment",
            "therapist",
            "scheduled_at",
            "duration_minutes",
            "quantity",
            "unit_price_cents",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "status", "created_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        company = getattr(request, "company", None) if request else None

        booking = attrs.get("booking")
        if company and booking.company_id != company.id:
            raise serializers.ValidationError({"booking": "Must belong to the active company."})
        if booking.status != SpaBooking.Status.OPEN:
            raise serializers.ValidationError({"booking": "Can't add treatments to a closed or cancelled booking."})

        treatment = attrs.get("treatment")
        if company and treatment.company_id != company.id:
            raise serializers.ValidationError({"treatment": "Must belong to the active company."})

        return attrs
