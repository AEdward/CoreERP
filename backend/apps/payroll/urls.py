from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    EmployeeSalaryComponentViewSet,
    LoanViewSet,
    OvertimeSettingsView,
    PayrollRunViewSet,
    PayslipViewSet,
    PensionSettingsView,
    SalaryComponentViewSet,
    TaxBracketViewSet,
)

router = DefaultRouter()
router.register("salary-components", SalaryComponentViewSet, basename="salary-component")
router.register(
    "employee-salary-components", EmployeeSalaryComponentViewSet, basename="employee-salary-component"
)
router.register("runs", PayrollRunViewSet, basename="payroll-run")
router.register("payslips", PayslipViewSet, basename="payslip")
router.register("loans", LoanViewSet, basename="loan")
router.register("tax-brackets", TaxBracketViewSet, basename="tax-bracket")

urlpatterns = router.urls + [
    path("pension-settings/", PensionSettingsView.as_view(), name="pension-settings"),
    path("overtime-settings/", OvertimeSettingsView.as_view(), name="overtime-settings"),
]
