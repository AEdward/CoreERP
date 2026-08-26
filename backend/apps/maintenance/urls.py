from rest_framework.routers import DefaultRouter

from .views import AssetViewSet, MaintenanceScheduleViewSet, WorkOrderViewSet

router = DefaultRouter()
router.register("work-orders", WorkOrderViewSet, basename="maintenance-work-order")
router.register("schedules", MaintenanceScheduleViewSet, basename="maintenance-schedule")
router.register("assets", AssetViewSet, basename="maintenance-asset")

urlpatterns = router.urls
