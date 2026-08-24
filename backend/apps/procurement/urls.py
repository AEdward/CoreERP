from rest_framework.routers import DefaultRouter

from .views import BillViewSet, PurchaseOrderViewSet, PurchaseRequestViewSet, PurchaseReturnViewSet

router = DefaultRouter()
router.register("purchase-requests", PurchaseRequestViewSet, basename="purchase-request")
router.register("purchase-orders", PurchaseOrderViewSet, basename="purchase-order")
router.register("bills", BillViewSet, basename="bill")
router.register("purchase-returns", PurchaseReturnViewSet, basename="purchase-return")

urlpatterns = router.urls
