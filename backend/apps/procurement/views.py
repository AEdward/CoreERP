from apps.common.views import CompanyScopedViewSet

from .models import Bill, PurchaseOrder
from .serializers import BillSerializer, PurchaseOrderSerializer


class PurchaseOrderViewSet(CompanyScopedViewSet):
    queryset = PurchaseOrder.objects.select_related("supplier").prefetch_related("lines__item")
    serializer_class = PurchaseOrderSerializer
    permission_module = "procurement"


class BillViewSet(CompanyScopedViewSet):
    queryset = Bill.objects.select_related("purchase_order")
    serializer_class = BillSerializer
    permission_module = "procurement"
