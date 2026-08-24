from django.urls import path
from rest_framework.routers import DefaultRouter

from .reports import ReorderSuggestionsView
from .views import (
    StockCountViewSet,
    StockMovementViewSet,
    StockViewSet,
    StorageLocationViewSet,
    WarehouseViewSet,
)

router = DefaultRouter()
router.register("warehouses", WarehouseViewSet, basename="warehouse")
router.register("storage-locations", StorageLocationViewSet, basename="storage-location")
router.register("stock", StockViewSet, basename="stock")
router.register("stock-movements", StockMovementViewSet, basename="stock-movement")
router.register("stock-counts", StockCountViewSet, basename="stock-count")

urlpatterns = router.urls + [
    path("reports/reorder-suggestions/", ReorderSuggestionsView.as_view(), name="reorder-suggestions"),
]
