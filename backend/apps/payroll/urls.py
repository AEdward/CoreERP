from rest_framework.routers import DefaultRouter

from .views import (
    EmployeeSalaryComponentViewSet,
    LoanViewSet,
    PayrollRunViewSet,
    PayslipViewSet,
    SalaryComponentViewSet,
)

router = DefaultRouter()
router.register("salary-components", SalaryComponentViewSet, basename="salary-component")
router.register(
    "employee-salary-components", EmployeeSalaryComponentViewSet, basename="employee-salary-component"
)
router.register("runs", PayrollRunViewSet, basename="payroll-run")
router.register("payslips", PayslipViewSet, basename="payslip")
router.register("loans", LoanViewSet, basename="loan")

urlpatterns = router.urls
