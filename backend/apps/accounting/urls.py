from django.urls import path
from rest_framework.routers import DefaultRouter

from .reports import (
    BalanceSheetView,
    BudgetVsActualView,
    CashFlowView,
    ProfitAndLossView,
    TrialBalanceView,
)
from .views import (
    AccountViewSet,
    BankAccountViewSet,
    BankStatementLineViewSet,
    BudgetViewSet,
    FinancialPeriodViewSet,
    FixedAssetViewSet,
    JournalEntryViewSet,
    PaymentViewSet,
    PettyCashFundViewSet,
    PettyCashTransactionViewSet,
)

router = DefaultRouter()
router.register("accounts", AccountViewSet, basename="account")
router.register("journal-entries", JournalEntryViewSet, basename="journal-entry")
router.register("payments", PaymentViewSet, basename="payment")
router.register("financial-periods", FinancialPeriodViewSet, basename="financial-period")
router.register("bank-accounts", BankAccountViewSet, basename="bank-account")
router.register("bank-statement-lines", BankStatementLineViewSet, basename="bank-statement-line")
router.register("petty-cash-funds", PettyCashFundViewSet, basename="petty-cash-fund")
router.register("petty-cash-transactions", PettyCashTransactionViewSet, basename="petty-cash-transaction")
router.register("budgets", BudgetViewSet, basename="budget")
router.register("fixed-assets", FixedAssetViewSet, basename="fixed-asset")

urlpatterns = router.urls + [
    path("reports/trial-balance/", TrialBalanceView.as_view(), name="trial-balance"),
    path("reports/profit-and-loss/", ProfitAndLossView.as_view(), name="profit-and-loss"),
    path("reports/balance-sheet/", BalanceSheetView.as_view(), name="balance-sheet"),
    path("reports/cash-flow/", CashFlowView.as_view(), name="cash-flow"),
    path("reports/budget-vs-actual/", BudgetVsActualView.as_view(), name="budget-vs-actual"),
]
