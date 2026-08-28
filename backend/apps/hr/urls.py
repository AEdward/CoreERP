from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AttendanceRecordViewSet,
    DepartmentViewSet,
    EmployeeContractViewSet,
    EmployeeDocumentViewSet,
    EmployeePickerView,
    EmployeeSkillViewSet,
    EmployeeViewSet,
    LeaveRequestViewSet,
    LeaveTypeViewSet,
    OffboardingViewSet,
    PositionViewSet,
    PublicHolidayViewSet,
    SalaryStructureViewSet,
    ShiftAssignmentViewSet,
    ShiftSwapRequestViewSet,
    ShiftTemplateViewSet,
    SkillViewSet,
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
router.register("skills", SkillViewSet, basename="skill")
router.register("employee-skills", EmployeeSkillViewSet, basename="employee-skill")
router.register("leave-types", LeaveTypeViewSet, basename="leave-type")
router.register("public-holidays", PublicHolidayViewSet, basename="public-holiday")
router.register("leave-requests", LeaveRequestViewSet, basename="leave-request")
router.register("attendance", AttendanceRecordViewSet, basename="attendance")
router.register("offboarding", OffboardingViewSet, basename="offboarding")

urlpatterns = router.urls + [
    path("employee-picker/", EmployeePickerView.as_view(), name="employee-picker"),
]
