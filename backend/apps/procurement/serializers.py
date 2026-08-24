from django.db import transaction
from rest_framework import serializers

from apps.common.numbering import next_number
from apps.common.serializers import CompanyScopedSerializer
from apps.companies.models import CompanyMembership
from apps.tax.engine import compute_line_tax_cents

from .models import (
    Bill,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseRequest,
    PurchaseRequestLine,
    PurchaseReturn,
)


class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    outstanding_quantity = serializers.IntegerField(read_only=True)

    class Meta:
        model = PurchaseOrderLine
        fields = [
            "id",
            "item",
            "quantity",
            "unit_cost_cents",
            "received_quantity",
            "outstanding_quantity",
        ]
        read_only_fields = ["id", "received_quantity"]


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
        # whole line list each time. But a full replace deletes and
        # recreates every line, which would silently reset
        # received_quantity to 0 (a new row, not the one PurchaseOrderViewSet.receive
        # incremented) — letting the same physical delivery be received
        # twice. Once any line has real receiving progress, the line
        # list is locked; only the header (supplier/status) stays
        # editable.
        lines_data = validated_data.pop("lines", None)
        with transaction.atomic():
            instance.supplier = validated_data.get("supplier", instance.supplier)
            instance.status = validated_data.get("status", instance.status)
            instance.save()
            if lines_data is not None:
                if any(line.received_quantity > 0 for line in instance.lines.all()):
                    raise serializers.ValidationError(
                        {"lines": "Can't edit line items once receiving has started on this order."}
                    )
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


class PurchaseRequestLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseRequestLine
        fields = ["id", "item", "quantity", "estimated_unit_cost_cents"]
        read_only_fields = ["id"]


class PurchaseRequestSerializer(CompanyScopedSerializer):
    lines = PurchaseRequestLineSerializer(many=True)
    total_cents = serializers.IntegerField(read_only=True)
    requested_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseRequest
        fields = [
            "id",
            "requested_by",
            "requested_by_name",
            "justification",
            "status",
            "lines",
            "total_cents",
            "converted_purchase_order",
            "created_at",
        ]
        read_only_fields = ["id", "status", "converted_purchase_order", "created_at"]

    def get_requested_by_name(self, obj):
        return obj.requested_by.full_name if obj.requested_by_id else ""

    def validate_requested_by(self, requested_by):
        # requested_by is a User, not a TenantModel, so same_company_fields
        # (which checks .company_id) can't cover it — same pattern as
        # apps.tasks.TaskSerializer.validate_assignee.
        request = self.context.get("request")
        company = getattr(request, "company", None)
        if requested_by is not None and company is not None:
            is_member = CompanyMembership.objects.filter(
                user=requested_by, company=company, status=CompanyMembership.Status.ACTIVE
            ).exists()
            if not is_member:
                raise serializers.ValidationError("Must be an active member of the active company.")
        return requested_by

    def validate_lines(self, lines):
        if not lines:
            raise serializers.ValidationError("At least one line item is required.")
        return lines

    def validate_status(self, value):
        # Same reasoning as PurchaseOrderSerializer.validate_status —
        # submitted/approved/rejected/converted are set by the approval
        # flow and PurchaseRequestViewSet.convert, not edited directly.
        if self.instance and value == self.instance.status:
            return value
        blocked = {
            PurchaseRequest.Status.SUBMITTED,
            PurchaseRequest.Status.APPROVED,
            PurchaseRequest.Status.REJECTED,
            PurchaseRequest.Status.CONVERTED,
        }
        if value in blocked:
            raise serializers.ValidationError(
                "Submitted/approved/rejected/converted are set by the approval flow, not edited directly."
            )
        return value

    def _create_lines(self, purchase_request, company, lines_data):
        for line in lines_data:
            if line["item"].company_id != company.id:
                raise serializers.ValidationError(
                    {"lines": "All line items must belong to the active company."}
                )
            PurchaseRequestLine.objects.create(company=company, purchase_request=purchase_request, **line)

    def create(self, validated_data):
        lines_data = validated_data.pop("lines")
        company = validated_data["company"]
        with transaction.atomic():
            purchase_request = PurchaseRequest.objects.create(**validated_data)
            self._create_lines(purchase_request, company, lines_data)
        return purchase_request

    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)
        with transaction.atomic():
            instance.requested_by = validated_data.get("requested_by", instance.requested_by)
            instance.justification = validated_data.get("justification", instance.justification)
            instance.status = validated_data.get("status", instance.status)
            instance.save()
            if lines_data is not None:
                instance.lines.all().delete()
                self._create_lines(instance, instance.company, lines_data)
        return instance


class PurchaseReturnSerializer(CompanyScopedSerializer):
    same_company_fields = ["bill"]

    class Meta:
        model = PurchaseReturn
        fields = [
            "id",
            "bill",
            "debit_note_number",
            "amount_cents",
            "tax_amount_cents",
            "reason",
            "created_at",
        ]
        read_only_fields = ["id", "debit_note_number", "created_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        bill = attrs.get("bill")
        if bill is not None:
            total_due = bill.amount_cents + bill.tax_amount_cents
            already_returned = sum(
                pr.amount_cents + pr.tax_amount_cents for pr in bill.purchase_returns.all()
            )
            requested = attrs.get("amount_cents", 0) + attrs.get("tax_amount_cents", 0)
            if already_returned + requested > total_due:
                remaining = total_due - already_returned
                raise serializers.ValidationError(
                    {"amount_cents": f"Exceeds the bill's remaining balance ({remaining} cents)."}
                )
        return attrs

    def create(self, validated_data):
        with transaction.atomic():
            purchase_return = PurchaseReturn.objects.create(**validated_data)
            purchase_return.debit_note_number = next_number(purchase_return.company, "DBN")
            purchase_return.save(update_fields=["debit_note_number"])
        return purchase_return
