from rest_framework.routers import DefaultRouter

from .views import VehicleAssignmentViewSet, VehicleViewSet

router = DefaultRouter()
router.register("vehicles", VehicleViewSet, basename="vehicle")
router.register("vehicle-assignments", VehicleAssignmentViewSet, basename="vehicle-assignment")

urlpatterns = router.urls
