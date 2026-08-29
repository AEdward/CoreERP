from rest_framework.routers import DefaultRouter

from .views import (
    BOQItemViewSet,
    ChangeOrderViewSet,
    ConstructionProjectViewSet,
    ContractViewSet,
    EquipmentAssignmentViewSet,
    EquipmentViewSet,
    LaborAssignmentViewSet,
    MaterialIssueViewSet,
    QualityInspectionViewSet,
    SafetyIncidentViewSet,
    SiteExpenseViewSet,
    SiteLogViewSet,
)

router = DefaultRouter()
router.register("projects", ConstructionProjectViewSet, basename="construction-project")
router.register("boq-items", BOQItemViewSet, basename="construction-boq-item")
router.register("contracts", ContractViewSet, basename="construction-contract")
router.register("site-logs", SiteLogViewSet, basename="construction-site-log")
router.register("material-issues", MaterialIssueViewSet, basename="construction-material-issue")
router.register("equipment", EquipmentViewSet, basename="construction-equipment")
router.register("equipment-assignments", EquipmentAssignmentViewSet, basename="construction-equipment-assignment")
router.register("labor-assignments", LaborAssignmentViewSet, basename="construction-labor-assignment")
router.register("site-expenses", SiteExpenseViewSet, basename="construction-site-expense")
router.register("change-orders", ChangeOrderViewSet, basename="construction-change-order")
router.register("quality-inspections", QualityInspectionViewSet, basename="construction-quality-inspection")
router.register("safety-incidents", SafetyIncidentViewSet, basename="construction-safety-incident")

urlpatterns = router.urls
