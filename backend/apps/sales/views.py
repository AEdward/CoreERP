from apps.common.views import CompanyScopedViewSet

from .models import Invoice, Quotation, SalesOrder
from .serializers import InvoiceSerializer, QuotationSerializer, SalesOrderSerializer


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
