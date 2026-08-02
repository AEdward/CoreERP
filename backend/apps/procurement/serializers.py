from django.db import transaction
from rest_framework import serializers

from apps.common.serializers import CompanyScopedSerializer

from .models import PurchaseOrder, PurchaseOrderLine


class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrderLine
        fields = ["id", "item", "quantity", "unit_cost_cents"]
        read_only_fields = ["id"]


class PurchaseOrderSerializer(CompanyScopedSerializer):
    same_company_fields = ["supplier"]
    lines = PurchaseOrderLineSerializer(many=True)
    total_cents = serializers.IntegerField(read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = ["id", "supplier", "status", "lines", "total_cents", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_lines(self, lines):
        if not lines:
            raise serializers.ValidationError("At least one line item is required.")
        return lines

    def _create_lines(self, order, company, lines_data):
        for line in lines_data:
            if line["item"].company_id != company.id:
                raise serializers.ValidationError(
                    {"lines": "All line items must belong to the active company."}
                )
            PurchaseOrderLine.objects.create(company=company, purchase_order=order, **line)

    def create(self, validated_data):
        lines_data = validated_data.pop("lines")
        company = validated_data["company"]
        with transaction.atomic():
            order = PurchaseOrder.objects.create(**validated_data)
            self._create_lines(order, company, lines_data)
        return order

    def update(self, instance, validated_data):
        # Full replace on update rather than per-line diffing — simplest
        # correct semantics for an MVP order form that resubmits the
        # whole line list each time.
        lines_data = validated_data.pop("lines", None)
        with transaction.atomic():
            instance.supplier = validated_data.get("supplier", instance.supplier)
            instance.status = validated_data.get("status", instance.status)
            instance.save()
            if lines_data is not None:
                instance.lines.all().delete()
                self._create_lines(instance, instance.company, lines_data)
        return instance
