from rest_framework.routers import DefaultRouter

from .views import (
    EmployeeSalaryComponentViewSet,
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

urlpatterns = router.urls
