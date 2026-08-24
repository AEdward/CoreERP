from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.views import CompanyScopedViewSet

from .models import (
    AttendanceRecord,
    Department,
    Employee,
    EmployeeContract,
    LeaveRequest,
    LeaveType,
    Position,
    ShiftTemplate,
)
from .serializers import (
    AttendanceRecordSerializer,
    DepartmentSerializer,
    EmployeeContractSerializer,
    EmployeeSerializer,
    LeaveRequestSerializer,
    LeaveTypeSerializer,
    PositionSerializer,
    ShiftTemplateSerializer,
)


class DepartmentViewSet(CompanyScopedViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_module = "hr"


class PositionViewSet(CompanyScopedViewSet):
    queryset = Position.objects.select_related("department").all()
    serializer_class = PositionSerializer
    permission_module = "hr"


class ShiftTemplateViewSet(CompanyScopedViewSet):
    queryset = ShiftTemplate.objects.all()
    serializer_class = ShiftTemplateSerializer
    permission_module = "hr"


class EmployeeViewSet(CompanyScopedViewSet):
    queryset = Employee.objects.select_related("department", "position", "shift").all()
    serializer_class = EmployeeSerializer
    permission_module = "hr"


class EmployeeContractViewSet(CompanyScopedViewSet):
    queryset = EmployeeContract.objects.select_related("employee").all()
    serializer_class = EmployeeContractSerializer
    permission_module = "hr"

    def get_queryset(self):
        qs = super().get_queryset()
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        return qs


class LeaveTypeViewSet(CompanyScopedViewSet):
    queryset = LeaveType.objects.all()
    serializer_class = LeaveTypeSerializer
    permission_module = "hr"


class LeaveRequestViewSet(CompanyScopedViewSet):
    queryset = LeaveRequest.objects.select_related("employee", "leave_type").all()
    serializer_class = LeaveRequestSerializer
    permission_module = "hr"

    def get_queryset(self):
        qs = super().get_queryset()
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        return qs


class AttendanceRecordViewSet(CompanyScopedViewSet):
    queryset = AttendanceRecord.objects.select_related("employee").all()
    serializer_class = AttendanceRecordSerializer
    permission_module = "hr"

    def get_queryset(self):
        qs = super().get_queryset()
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        date = self.request.query_params.get("date")
        if date:
            qs = qs.filter(date=date)
        return qs

    @action(detail=False, methods=["post"])
    def import_records(self, request):
        """Bulk-create attendance records — the realistic "biometric
        device" integration point: a real fingerprint/face-recognition
        terminal exports a batch of clock events, which lands here rather
        than one-by-one through the normal create endpoint. Each row is
        tagged source=device_import automatically, and validated/created
        through the same serializer (so same_company_fields, the unique
        (employee, date) constraint, etc. all still apply)."""
        rows = request.data.get("records")
        if not isinstance(rows, list) or not rows:
            raise ValidationError({"records": "A non-empty list is required."})

        created = []
        for row in rows:
            serializer = AttendanceRecordSerializer(
                data={**row, "source": AttendanceRecord.Source.DEVICE_IMPORT},
                context={"request": request},
            )
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            created.append(serializer.data)

        return Response(created, status=201)


class EmployeePickerView(APIView):
    """Just enough (id, name) to populate a picker elsewhere — Expenses
    needs "which employee is this claim for" without requiring hr.view,
    the same reasoning apps.companies.CompanyMembersView already applies
    to Tasks' assignee picker: seeing coworkers' names for a dropdown
    isn't as sensitive as the full HR record, so this only requires
    being an active member of the company, no extra permission."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.company:
            raise NotFound("Select an active company first (POST /api/companies/active/).")
        employees = Employee.objects.filter(
            company=request.company, status=Employee.Status.ACTIVE
        ).order_by("first_name", "last_name")
        data = [
            {"id": e.id, "name": f"{e.first_name} {e.last_name}".strip()} for e in employees
        ]
        return Response(data)
