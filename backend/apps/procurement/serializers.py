from django.db import transaction
from rest_framework import serializers

from apps.common.numbering import next_number
from apps.common.serializers import CompanyScopedSerializer
from apps.tax.engine import compute_line_tax_cents

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

    def validate_status(self, value):
        # Submitted/approved/rejected are set only by apps.approvals
        # (POST /api/approvals/, then its approve/reject actions) — see
        # apps/procurement/apps.py's hook registration. Draft/Received/
        # Cancelled stay freely editable; they're ordinary record edits,
        # not part of the approval chain. Only a *change* into one of the
        # blocked values is rejected — leaving it as-is has to stay legal,
        # since the order form always resends the current status
        # alongside an unrelated edit (a line item fix, say) to an order
        # that's already submitted/approved/rejected.
        if self.instance and value == self.instance.status:
            return value
        blocked = {PurchaseOrder.Status.SUBMITTED, PurchaseOrder.Status.APPROVED, PurchaseOrder.Status.REJECTED}
        if value in blocked:
            raise serializers.ValidationError(
                "Submitted/approved/rejected are set by the approval flow, not edited directly."
            )
        return value

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
            validated_data["tax_amount_cents"] = compute_line_tax_cents(
                purchase_order.lines.select_related("item__tax_rate")
            )
        elif "amount_cents" not in validated_data:
            raise serializers.ValidationError(
                {"amount_cents": "Required when not billing against a purchase order."}
            )

        with transaction.atomic():
            bill = Bill.objects.create(**validated_data)
            bill.bill_number = next_number(bill.company, "BILL")
            bill.save(update_fields=["bill_number"])
        return bill
