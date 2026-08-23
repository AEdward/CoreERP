from django.db import transaction
from django.db.models import Sum
from rest_framework import serializers

from apps.common.numbering import next_number
from apps.common.serializers import CompanyScopedSerializer

from .models import (
    Account,
    BankAccount,
    BankStatementLine,
    Budget,
    FinancialPeriod,
    FixedAsset,
    JournalEntry,
    JournalLine,
    Payment,
    PettyCashFund,
    PettyCashTransaction,
)


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


class FinancialPeriodSerializer(CompanyScopedSerializer):
    class Meta:
        model = FinancialPeriod
        fields = [
            "id",
            "label",
            "start_date",
            "end_date",
            "status",
            "closed_at",
            "net_income_cents",
            "created_at",
        ]
        read_only_fields = ["id", "status", "closed_at", "net_income_cents", "created_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs.get("start_date") and attrs.get("end_date") and attrs["start_date"] > attrs["end_date"]:
            raise serializers.ValidationError({"end_date": "Must be on or after the start date."})
        return attrs


def _account_balance_cents(account):
    totals = account.journal_lines.aggregate(debit=Sum("debit_cents"), credit=Sum("credit_cents"))
    debit, credit = totals["debit"] or 0, totals["credit"] or 0
    # Asset-type accounts (Cash, bank accounts) run debit-normal.
    return debit - credit


class BankAccountSerializer(CompanyScopedSerializer):
    same_company_fields = ["account"]
    balance_cents = serializers.SerializerMethodField()

    class Meta:
        model = BankAccount
        fields = [
            "id",
            "name",
            "bank_name",
            "account_number",
            "account",
            "is_active",
            "balance_cents",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_balance_cents(self, obj):
        return _account_balance_cents(obj.account)


class BankStatementLineSerializer(CompanyScopedSerializer):
    same_company_fields = ["bank_account"]

    class Meta:
        model = BankStatementLine
        fields = ["id", "bank_account", "date", "description", "amount_cents", "is_reconciled", "created_at"]
        read_only_fields = ["id", "created_at"]


class PettyCashFundSerializer(CompanyScopedSerializer):
    same_company_fields = ["custodian", "account"]
    balance_cents = serializers.SerializerMethodField()

    class Meta:
        model = PettyCashFund
        fields = [
            "id",
            "name",
            "custodian",
            "account",
            "imprest_amount_cents",
            "is_active",
            "balance_cents",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_balance_cents(self, obj):
        return _account_balance_cents(obj.account)


class PettyCashTransactionSerializer(CompanyScopedSerializer):
    same_company_fields = ["fund"]

    class Meta:
        model = PettyCashTransaction
        fields = ["id", "fund", "type", "category", "description", "amount_cents", "date", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate_amount_cents(self, value):
        if value <= 0:
            raise serializers.ValidationError("Must be a positive amount.")
        return value


class BudgetSerializer(CompanyScopedSerializer):
    same_company_fields = ["account"]

    class Meta:
        model = Budget
        fields = ["id", "account", "period_label", "amount_cents", "created_at"]
        read_only_fields = ["id", "created_at"]


class FixedAssetSerializer(CompanyScopedSerializer):
    book_value_cents = serializers.IntegerField(read_only=True)
    monthly_depreciation_cents = serializers.IntegerField(read_only=True)

    class Meta:
        model = FixedAsset
        fields = [
            "id",
            "name",
            "category",
            "purchase_date",
            "cost_cents",
            "salvage_value_cents",
            "useful_life_months",
            "accumulated_depreciation_cents",
            "last_depreciated_on",
            "status",
            "book_value_cents",
            "monthly_depreciation_cents",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "accumulated_depreciation_cents",
            "last_depreciated_on",
            "created_at",
        ]

    def validate_useful_life_months(self, value):
        if value <= 0:
            raise serializers.ValidationError("Must be at least 1 month.")
        return value
