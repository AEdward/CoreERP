from rest_framework.routers import DefaultRouter

from .views import StockCountViewSet, StockMovementViewSet, StockViewSet, WarehouseViewSet

router = DefaultRouter()
router.register("warehouses", WarehouseViewSet, basename="warehouse")
router.register("stock", StockViewSet, basename="stock")
router.register("stock-movements", StockMovementViewSet, basename="stock-movement")
router.register("stock-counts", StockCountViewSet, basename="stock-count")

urlpatterns = router.urls
