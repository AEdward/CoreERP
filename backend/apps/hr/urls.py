from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AttendanceRecordViewSet,
    DepartmentViewSet,
    EmployeeContractViewSet,
    EmployeePickerView,
    EmployeeViewSet,
    LeaveRequestViewSet,
    LeaveTypeViewSet,
    PositionViewSet,
    ShiftTemplateViewSet,
)

router = DefaultRouter()
router.register("departments", DepartmentViewSet, basename="department")
router.register("positions", PositionViewSet, basename="position")
router.register("shifts", ShiftTemplateViewSet, basename="shift")
router.register("employees", EmployeeViewSet, basename="employee")
router.register("employee-contracts", EmployeeContractViewSet, basename="employee-contract")
router.register("leave-types", LeaveTypeViewSet, basename="leave-type")
router.register("leave-requests", LeaveRequestViewSet, basename="leave-request")
router.register("attendance", AttendanceRecordViewSet, basename="attendance")

urlpatterns = router.urls + [
    path("employee-picker/", EmployeePickerView.as_view(), name="employee-picker"),
]
