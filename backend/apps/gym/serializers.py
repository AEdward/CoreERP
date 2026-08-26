from django.db import transaction
from rest_framework import serializers

from apps.common.serializers import CompanyScopedSerializer

from .models import BillingStatus, GymBooking, GymBookingLine, GymMembership


class GymMembershipSerializer(CompanyScopedSerializer):
    same_company_fields = ["guest", "reservation"]
    guest_name = serializers.CharField(source="guest.name", read_only=True)
    membership_status = serializers.CharField(read_only=True)

    class Meta:
        model = GymMembership
        fields = [
            "id",
            "guest",
            "guest_name",
            "reservation",
            "plan_type",
            "start_date",
            "end_date",
            "price_cents",
            "status",
            "membership_status",
            "receipt_number",
            "closed_at",
            "created_at",
        ]
        read_only_fields = ["id", "status", "receipt_number", "closed_at", "created_at"]


class GymBookingLineSerializer(serializers.ModelSerializer):
    activity_name = serializers.CharField(source="activity.name", read_only=True)
    trainer_name = serializers.CharField(source="trainer.full_name", read_only=True)
    line_total_cents = serializers.IntegerField(read_only=True)

    class Meta:
        model = GymBookingLine
        fields = [
            "id",
            "booking",
            "activity",
            "activity_name",
            "trainer",
            "trainer_name",
            "scheduled_at",
            "duration_minutes",
            "quantity",
            "unit_price_cents",
            "status",
            "line_total_cents",
            "created_at",
        ]
        read_only_fields = ["id", "booking", "status", "created_at"]


class GymBookingSerializer(CompanyScopedSerializer):
    same_company_fields = ["reservation", "guest"]
    lines = GymBookingLineSerializer(many=True, required=False)
    guest_name = serializers.CharField(source="guest.name", read_only=True)
    total_cents = serializers.IntegerField(read_only=True)

    class Meta:
        model = GymBooking
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
            if line["activity"].company_id != company.id:
                raise serializers.ValidationError({"lines": "All activities must belong to the active company."})
            GymBookingLine.objects.create(company=company, booking=booking, **line)

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        company = validated_data["company"]
        with transaction.atomic():
            booking = GymBooking.objects.create(**validated_data)
            self._create_lines(booking, company, lines_data)
        return booking

    def update(self, instance, validated_data):
        validated_data.pop("lines", None)
        return super().update(instance, validated_data)


class AddGymBookingLineSerializer(serializers.ModelSerializer):
    """Adds one activity to an already-open booking — mirrors
    apps.spa.serializers.AddSpaBookingLineSerializer."""

    class Meta:
        model = GymBookingLine
        fields = [
            "id",
            "booking",
            "activity",
            "trainer",
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
        if booking.status != BillingStatus.OPEN:
            raise serializers.ValidationError({"booking": "Can't add activities to a closed or cancelled booking."})

        activity = attrs.get("activity")
        if company and activity.company_id != company.id:
            raise serializers.ValidationError({"activity": "Must belong to the active company."})

        return attrs
