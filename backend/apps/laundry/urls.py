from rest_framework.routers import DefaultRouter

from .views import LaundryOrderLineViewSet, LaundryOrderViewSet

router = DefaultRouter()
router.register("orders", LaundryOrderViewSet, basename="laundry-order")
router.register("order-lines", LaundryOrderLineViewSet, basename="laundry-order-line")

urlpatterns = router.urls
