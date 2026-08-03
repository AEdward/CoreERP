from rest_framework.routers import DefaultRouter

from .views import BillViewSet, PurchaseOrderViewSet

router = DefaultRouter()
router.register("purchase-orders", PurchaseOrderViewSet, basename="purchase-order")
router.register("bills", BillViewSet, basename="bill")

urlpatterns = router.urls
