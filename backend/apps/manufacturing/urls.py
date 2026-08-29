from rest_framework.routers import DefaultRouter

from .views import (
    BillOfMaterialViewSet,
    MachineMaintenanceLogViewSet,
    MachineViewSet,
    MaterialConsumptionViewSet,
    ProductionOrderViewSet,
    QualityCheckViewSet,
    ScrapEntryViewSet,
    WorkCenterViewSet,
    WorkOrderViewSet,
)

router = DefaultRouter()
router.register("work-centers", WorkCenterViewSet, basename="work-center")
router.register("machines", MachineViewSet, basename="machine")
router.register("machine-maintenance-logs", MachineMaintenanceLogViewSet, basename="machine-maintenance-log")
router.register("boms", BillOfMaterialViewSet, basename="bom")
router.register("production-orders", ProductionOrderViewSet, basename="production-order")
router.register("work-orders", WorkOrderViewSet, basename="manufacturing-work-order")
router.register("material-consumptions", MaterialConsumptionViewSet, basename="material-consumption")
router.register("scrap-entries", ScrapEntryViewSet, basename="scrap-entry")
router.register("quality-checks", QualityCheckViewSet, basename="quality-check")

urlpatterns = router.urls
