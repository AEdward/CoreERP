from django.db import transaction
from rest_framework import serializers

from apps.common.numbering import next_number
from apps.common.serializers import CompanyScopedSerializer

from .models import Account, JournalEntry, JournalLine, Payment


class AccountSerializer(CompanyScopedSerializer):
    same_company_fields = ["parent"]

    class Meta:
        model = Account
        fields = ["id", "code", "name", "type", "parent", "role", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class JournalLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = JournalLine
        fields = ["id", "account", "debit_cents", "credit_cents"]
        read_only_fields = ["id"]

    def validate(self, attrs):
        debit = attrs.get("debit_cents") or 0
        credit = attrs.get("credit_cents") or 0
        if (debit > 0) == (credit > 0):
            raise serializers.ValidationError(
                "Each line must be either a debit or a credit, not both or neither."
            )
        return attrs


class JournalEntrySerializer(CompanyScopedSerializer):
    """Manual entries only — Invoice/Bill/Payment post through here too,
    but via apps.accounting.posting directly (system-triggered, not a
    request through this serializer). See apps.accounting.signals."""

    lines = JournalLineSerializer(many=True)

    class Meta:
        model = JournalEntry
        fields = ["id", "reference", "memo", "lines", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_lines(self, lines):
        if len(lines) < 2:
            raise serializers.ValidationError("A journal entry needs at least two lines.")
        total_debit = sum(line.get("debit_cents") or 0 for line in lines)
        total_credit = sum(line.get("credit_cents") or 0 for line in lines)
        if total_debit != total_credit:
            raise serializers.ValidationError(
                f"Debits ({total_debit}) must equal credits ({total_credit})."
            )
        return lines

    def create(self, validated_data):
        lines_data = validated_data.pop("lines")
        company = validated_data["company"]
        with transaction.atomic():
            entry = JournalEntry.objects.create(**validated_data)
            for line in lines_data:
                if line["account"].company_id != company.id:
                    raise serializers.ValidationError(
                        {"lines": "All accounts must belong to the active company."}
                    )
                JournalLine.objects.create(company=company, journal_entry=entry, **line)
        return entry


class PaymentSerializer(CompanyScopedSerializer):
    same_company_fields = ["invoice", "bill", "expense"]

    class Meta:
        model = Payment
        fields = [
            "id",
            "direction",
            "amount_cents",
            "method",
            "reference",
            "receipt_number",
            "invoice",
            "bill",
            "expense",
            "created_at",
        ]
        read_only_fields = ["id", "receipt_number", "created_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        invoice = attrs.get("invoice")
        bill = attrs.get("bill")
        expense = attrs.get("expense")
        if sum(bool(x) for x in (invoice, bill, expense)) != 1:
            raise serializers.ValidationError("Exactly one of invoice, bill, or expense must be set.")
        if invoice and attrs.get("direction") != Payment.Direction.RECEIVED:
            raise serializers.ValidationError(
                {"direction": "Payments against an invoice must be 'received'."}
            )
        if (bill or expense) and attrs.get("direction") != Payment.Direction.PAID:
            raise serializers.ValidationError(
                {"direction": "Payments against a bill or expense must be 'paid'."}
            )
        return attrs

    def create(self, validated_data):
        with transaction.atomic():
            payment = Payment.objects.create(**validated_data)
            payment.receipt_number = next_number(payment.company, "RCT")
            payment.save(update_fields=["receipt_number"])
        return payment
