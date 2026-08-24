from apps.common.views import CompanyScopedViewSet

from .models import CreditNote, Invoice, Quotation, SalesOrder
from .serializers import CreditNoteSerializer, InvoiceSerializer, QuotationSerializer, SalesOrderSerializer


class QuotationViewSet(CompanyScopedViewSet):
    queryset = Quotation.objects.select_related("customer").prefetch_related("lines__item")
    serializer_class = QuotationSerializer
    permission_module = "sales"


class SalesOrderViewSet(CompanyScopedViewSet):
    queryset = SalesOrder.objects.select_related("customer", "quotation").prefetch_related("lines__item")
    serializer_class = SalesOrderSerializer
    permission_module = "sales"


class InvoiceViewSet(CompanyScopedViewSet):
    queryset = Invoice.objects.select_related("sales_order")
    serializer_class = InvoiceSerializer
    permission_module = "sales"
    # Issuing an invoice auto-posts a journal entry (apps.accounting.signals);
    # editing or deleting it afterwards would desync the ledger from the
    # document, same reasoning as JournalEntry/Payment being append-only.
    # Correcting a mistake means a void status change or a reversing entry,
    # not editing history.
    http_method_names = ["get", "post", "head", "options"]


class CreditNoteViewSet(CompanyScopedViewSet):
    queryset = CreditNote.objects.select_related("invoice")
    serializer_class = CreditNoteSerializer
    permission_module = "sales"
    # Same reasoning as Invoice/Bill above — posts a journal entry on
    # creation, so editing or deleting it afterwards would desync the
    # ledger.
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = super().get_queryset()
        invoice_id = self.request.query_params.get("invoice")
        if invoice_id:
            qs = qs.filter(invoice_id=invoice_id)
        return qs
