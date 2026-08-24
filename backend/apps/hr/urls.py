from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    DepartmentViewSet,
    EmployeeContractViewSet,
    EmployeePickerView,
    EmployeeViewSet,
    LeaveRequestViewSet,
    LeaveTypeViewSet,
    PositionViewSet,
)

router = DefaultRouter()
router.register("departments", DepartmentViewSet, basename="department")
router.register("positions", PositionViewSet, basename="position")
router.register("employees", EmployeeViewSet, basename="employee")
router.register("employee-contracts", EmployeeContractViewSet, basename="employee-contract")
router.register("leave-types", LeaveTypeViewSet, basename="leave-type")
router.register("leave-requests", LeaveRequestViewSet, basename="leave-request")

urlpatterns = router.urls + [
    path("employee-picker/", EmployeePickerView.as_view(), name="employee-picker"),
]
