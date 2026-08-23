from apps.common.views import CompanyScopedViewSet

from .models import Account, JournalEntry, Payment
from .serializers import AccountSerializer, JournalEntrySerializer, PaymentSerializer


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
