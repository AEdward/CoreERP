from apps.common.views import CompanyScopedReadOnlyViewSet, CompanyScopedViewSet

from .models import Stock, StockMovement, Warehouse
from .serializers import StockMovementSerializer, StockSerializer, WarehouseSerializer


class WarehouseViewSet(CompanyScopedViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    permission_module = "inventory"


class StockViewSet(CompanyScopedReadOnlyViewSet):
    """Read-only — quantities are only ever mutated via StockMovement."""

    queryset = Stock.objects.select_related("item", "warehouse").all()
    serializer_class = StockSerializer
    permission_module = "inventory"


class StockMovementViewSet(CompanyScopedViewSet):
    queryset = StockMovement.objects.select_related("item", "warehouse", "to_warehouse").all()
    serializer_class = StockMovementSerializer
    permission_module = "inventory"
    http_method_names = ["get", "post", "head", "options"]  # movements are an append-only ledger
