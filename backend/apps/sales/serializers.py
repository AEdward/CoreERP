from django.db import transaction
from rest_framework import serializers

from apps.common.numbering import next_number
from apps.common.serializers import CompanyScopedSerializer
from apps.tax.engine import compute_line_tax_cents

from .models import CreditNote, Invoice, Quotation, QuotationLine, SalesOrder, SalesOrderLine


class QuotationLineSerializer(serializers.ModelSerializer):
    line_total_cents = serializers.IntegerField(read_only=True)

    class Meta:
        model = QuotationLine
        fields = ["id", "item", "quantity", "unit_price_cents", "discount_percent", "line_total_cents"]
        read_only_fields = ["id"]


class QuotationSerializer(CompanyScopedSerializer):
    same_company_fields = ["customer"]
    lines = QuotationLineSerializer(many=True)
    total_cents = serializers.IntegerField(read_only=True)

    class Meta:
        model = Quotation
        fields = ["id", "customer", "status", "lines", "total_cents", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_lines(self, lines):
        if not lines:
            raise serializers.ValidationError("At least one line item is required.")
        return lines

    def _create_lines(self, quotation, company, lines_data):
        for line in lines_data:
            if line["item"].company_id != company.id:
                raise serializers.ValidationError(
                    {"lines": "All line items must belong to the active company."}
                )
            QuotationLine.objects.create(company=company, quotation=quotation, **line)

    def create(self, validated_data):
        lines_data = validated_data.pop("lines")
        company = validated_data["company"]
        with transaction.atomic():
            quotation = Quotation.objects.create(**validated_data)
            self._create_lines(quotation, company, lines_data)
        return quotation

    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)
        with transaction.atomic():
            instance.customer = validated_data.get("customer", instance.customer)
            instance.status = validated_data.get("status", instance.status)
            instance.save()
            if lines_data is not None:
                instance.lines.all().delete()
                self._create_lines(instance, instance.company, lines_data)
        return instance


class SalesOrderLineSerializer(serializers.ModelSerializer):
    line_total_cents = serializers.IntegerField(read_only=True)
    outstanding_quantity = serializers.IntegerField(read_only=True)

    class Meta:
        model = SalesOrderLine
        fields = [
            "id",
            "item",
            "quantity",
            "unit_price_cents",
            "discount_percent",
            "line_total_cents",
            "dispatched_quantity",
            "outstanding_quantity",
        ]
        read_only_fields = ["id", "dispatched_quantity"]


class SalesOrderSerializer(CompanyScopedSerializer):
    same_company_fields = ["customer", "quotation"]
    lines = SalesOrderLineSerializer(many=True)
    total_cents = serializers.IntegerField(read_only=True)

    class Meta:
        model = SalesOrder
        fields = [
            "id",
            "customer",
            "quotation",
            "status",
            "payment_status",
            "lines",
            "total_cents",
            "created_at",
        ]
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
            SalesOrderLine.objects.create(company=company, sales_order=order, **line)

    def create(self, validated_data):
        lines_data = validated_data.pop("lines")
        company = validated_data["company"]
        with transaction.atomic():
            order = SalesOrder.objects.create(**validated_data)
            self._create_lines(order, company, lines_data)
        return order

    def update(self, instance, validated_data):
        # Full replace, same as PurchaseOrderSerializer — and the same
        # reason it has to lock the line list once dispatch has made
        # real progress: recreating lines would reset dispatched_quantity
        # to 0 on a fresh row, letting the same goods ship twice.
        lines_data = validated_data.pop("lines", None)
        with transaction.atomic():
            instance.customer = validated_data.get("customer", instance.customer)
            instance.quotation = validated_data.get("quotation", instance.quotation)
            instance.status = validated_data.get("status", instance.status)
            instance.payment_status = validated_data.get("payment_status", instance.payment_status)
            instance.save()
            if lines_data is not None:
                if any(line.dispatched_quantity > 0 for line in instance.lines.all()):
                    raise serializers.ValidationError(
                        {"lines": "Can't edit line items once dispatch has started on this order."}
                    )
                instance.lines.all().delete()
                self._create_lines(instance, instance.company, lines_data)
        return instance


class InvoiceSerializer(CompanyScopedSerializer):
    same_company_fields = ["sales_order"]

    class Meta:
        model = Invoice
        fields = [
            "id",
            "sales_order",
            "invoice_number",
            "amount_cents",
            "tax_amount_cents",
            "due_date",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "invoice_number", "created_at"]
        extra_kwargs = {"amount_cents": {"required": False}}

    def create(self, validated_data):
        sales_order = validated_data.get("sales_order")
        if sales_order is not None:
            validated_data["amount_cents"] = sales_order.total_cents
            validated_data["tax_amount_cents"] = compute_line_tax_cents(
                sales_order.lines.select_related("item__tax_rate")
            )
        elif "amount_cents" not in validated_data:
            raise serializers.ValidationError(
                {"amount_cents": "Required when not invoicing a sales order."}
            )

        with transaction.atomic():
            invoice = Invoice.objects.create(**validated_data)
            invoice.invoice_number = next_number(invoice.company, "INV")
            invoice.save(update_fields=["invoice_number"])
        return invoice


class CreditNoteSerializer(CompanyScopedSerializer):
    same_company_fields = ["invoice"]

    class Meta:
        model = CreditNote
        fields = [
            "id",
            "invoice",
            "credit_note_number",
            "amount_cents",
            "tax_amount_cents",
            "reason",
            "created_at",
        ]
        read_only_fields = ["id", "credit_note_number", "created_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        invoice = attrs.get("invoice")
        if invoice is not None:
            total_due = invoice.amount_cents + invoice.tax_amount_cents
            already_credited = sum(
                cn.amount_cents + cn.tax_amount_cents for cn in invoice.credit_notes.all()
            )
            requested = attrs.get("amount_cents", 0) + attrs.get("tax_amount_cents", 0)
            if already_credited + requested > total_due:
                remaining = total_due - already_credited
                raise serializers.ValidationError(
                    {"amount_cents": f"Exceeds the invoice's remaining balance ({remaining} cents)."}
                )
        return attrs

    def create(self, validated_data):
        with transaction.atomic():
            credit_note = CreditNote.objects.create(**validated_data)
            credit_note.credit_note_number = next_number(credit_note.company, "CRN")
            credit_note.save(update_fields=["credit_note_number"])
        return credit_note
