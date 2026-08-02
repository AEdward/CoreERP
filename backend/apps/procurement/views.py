from apps.common.views import CompanyScopedViewSet

from .models import PurchaseOrder
from .serializers import PurchaseOrderSerializer


class PurchaseOrderViewSet(CompanyScopedViewSet):
    queryset = PurchaseOrder.objects.select_related("supplier").prefetch_related("lines__item")
    serializer_class = PurchaseOrderSerializer
    permission_module = "procurement"
