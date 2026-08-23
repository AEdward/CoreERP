from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.common.views import CompanyScopedViewSet

from .models import (
    Account,
    BankAccount,
    BankStatementLine,
    Budget,
    FinancialPeriod,
    FixedAsset,
    JournalEntry,
    Payment,
    PettyCashFund,
    PettyCashTransaction,
)
from .posting import post_depreciation_journal, post_period_close_journal, post_petty_cash_transaction_journal
from .serializers import (
    AccountSerializer,
    BankAccountSerializer,
    BankStatementLineSerializer,
    BudgetSerializer,
    FinancialPeriodSerializer,
    FixedAssetSerializer,
    JournalEntrySerializer,
    PaymentSerializer,
    PettyCashFundSerializer,
    PettyCashTransactionSerializer,
)


class AccountViewSet(CompanyScopedViewSet):
    queryset = Account.objects.select_related("parent")
    serializer_class = AccountSerializer
    permission_module = "accounting"


class JournalEntryViewSet(CompanyScopedViewSet):
    queryset = JournalEntry.objects.prefetch_related("lines__account")
    serializer_class = JournalEntrySerializer
    permission_module = "accounting"
    http_method_names = ["get", "post", "head", "options"]  # append-only ledger


class PaymentViewSet(CompanyScopedViewSet):
    queryset = Payment.objects.select_related("invoice", "bill", "expense")
    serializer_class = PaymentSerializer
    permission_module = "accounting"
    http_method_names = ["get", "post", "head", "options"]  # not edited after the fact either


class FinancialPeriodViewSet(CompanyScopedViewSet):
    queryset = FinancialPeriod.objects.all()
    serializer_class = FinancialPeriodSerializer
    permission_module = "accounting"
    http_method_names = ["get", "post", "head", "options"]  # decided only via `close`, see below

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        period = self.get_object()
        if period.status == FinancialPeriod.Status.CLOSED:
            raise ValidationError({"detail": "This period is already closed."})
        if (
            FinancialPeriod.objects.filter(
                company=period.company,
                status=FinancialPeriod.Status.OPEN,
                start_date__lt=period.start_date,
            )
            .exclude(pk=period.pk)
            .exists()
        ):
            raise ValidationError(
                {"detail": "An earlier period is still open — periods must close in order."}
            )

        net_income = post_period_close_journal(period)
        period.status = FinancialPeriod.Status.CLOSED
        period.closed_at = timezone.now()
        period.closed_by = request.user
        period.net_income_cents = net_income
        period.save(update_fields=["status", "closed_at", "closed_by", "net_income_cents"])

        return Response(FinancialPeriodSerializer(period).data)


class BankAccountViewSet(CompanyScopedViewSet):
    queryset = BankAccount.objects.select_related("account")
    serializer_class = BankAccountSerializer
    permission_module = "accounting"


class BankStatementLineViewSet(CompanyScopedViewSet):
    queryset = BankStatementLine.objects.select_related("bank_account")
    serializer_class = BankStatementLineSerializer
    permission_module = "accounting"

    def get_queryset(self):
        qs = super().get_queryset()
        bank_account_id = self.request.query_params.get("bank_account")
        if bank_account_id:
            qs = qs.filter(bank_account_id=bank_account_id)
        return qs


class PettyCashFundViewSet(CompanyScopedViewSet):
    queryset = PettyCashFund.objects.select_related("custodian", "account")
    serializer_class = PettyCashFundSerializer
    permission_module = "accounting"


class PettyCashTransactionViewSet(CompanyScopedViewSet):
    queryset = PettyCashTransaction.objects.select_related("fund")
    serializer_class = PettyCashTransactionSerializer
    permission_module = "accounting"
    http_method_names = ["get", "post", "head", "options"]  # append-only, like Payment

    def get_queryset(self):
        qs = super().get_queryset()
        fund_id = self.request.query_params.get("fund")
        if fund_id:
            qs = qs.filter(fund_id=fund_id)
        return qs

    def perform_create(self, serializer):
        super().perform_create(serializer)
        post_petty_cash_transaction_journal(serializer.instance)


class BudgetViewSet(CompanyScopedViewSet):
    queryset = Budget.objects.select_related("account")
    serializer_class = BudgetSerializer
    permission_module = "accounting"


class FixedAssetViewSet(CompanyScopedViewSet):
    queryset = FixedAsset.objects.all()
    serializer_class = FixedAssetSerializer
    permission_module = "accounting"

    @action(detail=True, methods=["post"])
    def depreciate(self, request, pk=None):
        asset = self.get_object()
        if asset.status != FixedAsset.Status.ACTIVE:
            raise ValidationError({"detail": "Only an active asset can be depreciated."})

        today = timezone.now().date()
        if (
            asset.last_depreciated_on
            and asset.last_depreciated_on.year == today.year
            and asset.last_depreciated_on.month == today.month
        ):
            raise ValidationError({"detail": "This asset has already been depreciated this month."})

        remaining = asset.cost_cents - asset.salvage_value_cents - asset.accumulated_depreciation_cents
        if remaining <= 0:
            raise ValidationError({"detail": "This asset is already fully depreciated."})

        amount = post_depreciation_journal(asset, on_date=today)
        asset.accumulated_depreciation_cents += amount
        asset.last_depreciated_on = today
        asset.save(update_fields=["accumulated_depreciation_cents", "last_depreciated_on"])

        return Response(FixedAssetSerializer(asset).data)
