from django.db import transaction
from rest_framework import serializers

from apps.common.numbering import next_number
from apps.common.serializers import CompanyScopedSerializer

from .models import Bill, PurchaseOrder, PurchaseOrderLine


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


class BillSerializer(CompanyScopedSerializer):
    same_company_fields = ["purchase_order"]

    class Meta:
        model = Bill
        fields = [
            "id",
            "purchase_order",
            "bill_number",
            "amount_cents",
            "tax_amount_cents",
            "due_date",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "bill_number", "created_at"]
        extra_kwargs = {"amount_cents": {"required": False}}

    def create(self, validated_data):
        purchase_order = validated_data.get("purchase_order")
        if purchase_order is not None:
            validated_data["amount_cents"] = purchase_order.total_cents
        elif "amount_cents" not in validated_data:
            raise serializers.ValidationError(
                {"amount_cents": "Required when not billing against a purchase order."}
            )

        with transaction.atomic():
            bill = Bill.objects.create(**validated_data)
            bill.bill_number = next_number(bill.company, "BILL")
            bill.save(update_fields=["bill_number"])
        return bill
