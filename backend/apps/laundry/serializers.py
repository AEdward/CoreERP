from django.db import transaction
from rest_framework import serializers

from apps.common.serializers import CompanyScopedSerializer

from .models import LaundryOrder, LaundryOrderLine


class LaundryOrderLineSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    line_total_cents = serializers.IntegerField(read_only=True)

    class Meta:
        model = LaundryOrderLine
        fields = ["id", "order", "item", "item_name", "quantity", "unit_price_cents", "line_total_cents", "created_at"]
        read_only_fields = ["id", "order", "created_at"]


class LaundryOrderSerializer(CompanyScopedSerializer):
    # status/tracking_status/receipt_number/closed_at are read-only —
    # every transition goes through a dedicated action (start_washing,
    # mark_ready, deliver, charge_to_room, mark_paid, cancel), same
    # reasoning as apps.pos.Order.
    same_company_fields = ["reservation", "guest"]
    lines = LaundryOrderLineSerializer(many=True, required=False)
    guest_name = serializers.CharField(source="guest.name", read_only=True)
    total_cents = serializers.IntegerField(read_only=True)

    class Meta:
        model = LaundryOrder
        fields = [
            "id",
            "category",
            "reservation",
            "guest",
            "guest_name",
            "tracking_status",
            "status",
            "receipt_number",
            "total_cents",
            "lines",
            "notes",
            "closed_at",
            "created_at",
        ]
        read_only_fields = ["id", "tracking_status", "status", "receipt_number", "closed_at", "created_at"]

    def _create_lines(self, order, company, lines_data):
        for line in lines_data:
            if line["item"].company_id != company.id:
                raise serializers.ValidationError({"lines": "All items must belong to the active company."})
            LaundryOrderLine.objects.create(company=company, order=order, **line)

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        company = validated_data["company"]
        with transaction.atomic():
            order = LaundryOrder.objects.create(**validated_data)
            self._create_lines(order, company, lines_data)
        return order

    def update(self, instance, validated_data):
        validated_data.pop("lines", None)
        return super().update(instance, validated_data)


class AddLaundryOrderLineSerializer(serializers.ModelSerializer):
    """Adds one line to an already-open order — mirrors
    apps.pos.serializers.AddOrderLineSerializer."""

    class Meta:
        model = LaundryOrderLine
        fields = ["id", "order", "item", "quantity", "unit_price_cents", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        company = getattr(request, "company", None) if request else None

        order = attrs.get("order")
        if company and order.company_id != company.id:
            raise serializers.ValidationError({"order": "Must belong to the active company."})
        if order.status != LaundryOrder.Status.OPEN:
            raise serializers.ValidationError({"order": "Can't add items to a closed or cancelled order."})

        item = attrs.get("item")
        if company and item.company_id != company.id:
            raise serializers.ValidationError({"item": "Must belong to the active company."})

        return attrs
