from django.urls import path
from rest_framework.routers import DefaultRouter

from .reports import BalanceSheetView, CashFlowView, ProfitAndLossView, TrialBalanceView
from .views import AccountViewSet, JournalEntryViewSet, PaymentViewSet

router = DefaultRouter()
router.register("accounts", AccountViewSet, basename="account")
router.register("journal-entries", JournalEntryViewSet, basename="journal-entry")
router.register("payments", PaymentViewSet, basename="payment")

urlpatterns = router.urls + [
    path("reports/trial-balance/", TrialBalanceView.as_view(), name="trial-balance"),
    path("reports/profit-and-loss/", ProfitAndLossView.as_view(), name="profit-and-loss"),
    path("reports/balance-sheet/", BalanceSheetView.as_view(), name="balance-sheet"),
    path("reports/cash-flow/", CashFlowView.as_view(), name="cash-flow"),
]
