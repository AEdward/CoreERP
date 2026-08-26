from rest_framework.routers import DefaultRouter

from .views import CostCenterViewSet

router = DefaultRouter()
router.register("cost-centers", CostCenterViewSet, basename="cost-center")

urlpatterns = router.urls
