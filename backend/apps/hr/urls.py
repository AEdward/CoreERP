from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AttendanceRecordViewSet,
    DepartmentViewSet,
    EmployeeContractViewSet,
    EmployeeDocumentViewSet,
    EmployeePickerView,
    EmployeeViewSet,
    LeaveRequestViewSet,
    LeaveTypeViewSet,
    OffboardingViewSet,
    PositionViewSet,
    SalaryStructureViewSet,
    ShiftAssignmentViewSet,
    ShiftSwapRequestViewSet,
    ShiftTemplateViewSet,
)

router = DefaultRouter()
router.register("departments", DepartmentViewSet, basename="department")
router.register("positions", PositionViewSet, basename="position")
router.register("shifts", ShiftTemplateViewSet, basename="shift")
router.register("shift-assignments", ShiftAssignmentViewSet, basename="shift-assignment")
router.register("shift-swap-requests", ShiftSwapRequestViewSet, basename="shift-swap-request")
router.register("salary-structures", SalaryStructureViewSet, basename="salary-structure")
router.register("employees", EmployeeViewSet, basename="employee")
router.register("employee-contracts", EmployeeContractViewSet, basename="employee-contract")
router.register("employee-documents", EmployeeDocumentViewSet, basename="employee-document")
router.register("leave-types", LeaveTypeViewSet, basename="leave-type")
router.register("leave-requests", LeaveRequestViewSet, basename="leave-request")
router.register("attendance", AttendanceRecordViewSet, basename="attendance")
router.register("offboarding", OffboardingViewSet, basename="offboarding")

urlpatterns = router.urls + [
    path("employee-picker/", EmployeePickerView.as_view(), name="employee-picker"),
]
