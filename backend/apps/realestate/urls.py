from rest_framework.routers import DefaultRouter

from .views import (
    AgentCommissionViewSet,
    BuildingViewSet,
    LeaseContractViewSet,
    PaymentInstallmentViewSet,
    PropertyExpenseViewSet,
    PropertyListingViewSet,
    PropertyMaintenanceRequestViewSet,
    PropertyProjectViewSet,
    PropertySaleViewSet,
    RentPaymentViewSet,
    SalesAgentViewSet,
    UnitTypeViewSet,
    UnitViewSet,
)

router = DefaultRouter()
router.register("projects", PropertyProjectViewSet, basename="realestate-project")
router.register("buildings", BuildingViewSet, basename="realestate-building")
router.register("unit-types", UnitTypeViewSet, basename="realestate-unit-type")
router.register("units", UnitViewSet, basename="realestate-unit")
router.register("listings", PropertyListingViewSet, basename="realestate-listing")
router.register("sales-agents", SalesAgentViewSet, basename="realestate-sales-agent")
router.register("sales", PropertySaleViewSet, basename="realestate-sale")
router.register("installments", PaymentInstallmentViewSet, basename="realestate-installment")
router.register("commissions", AgentCommissionViewSet, basename="realestate-commission")
router.register("leases", LeaseContractViewSet, basename="realestate-lease")
router.register("rent-payments", RentPaymentViewSet, basename="realestate-rent-payment")
router.register("maintenance-requests", PropertyMaintenanceRequestViewSet, basename="realestate-maintenance-request")
router.register("expenses", PropertyExpenseViewSet, basename="realestate-expense")

urlpatterns = router.urls
