from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.views import CompanyScopedViewSet

from .leave_balance import compute_leave_balance
from .models import (
    AttendanceRecord,
    Department,
    Employee,
    EmployeeContract,
    LeaveRequest,
    LeaveType,
    Offboarding,
    Position,
    SalaryStructure,
    ShiftTemplate,
)
from .serializers import (
    AttendanceRecordSerializer,
    DepartmentSerializer,
    EmployeeContractSerializer,
    EmployeeSerializer,
    LeaveRequestSerializer,
    LeaveTypeSerializer,
    OffboardingSerializer,
    PositionSerializer,
    SalaryStructureSerializer,
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


class SalaryStructureViewSet(CompanyScopedViewSet):
    queryset = SalaryStructure.objects.all()
    serializer_class = SalaryStructureSerializer
    permission_module = "hr"


class EmployeeViewSet(CompanyScopedViewSet):
    queryset = Employee.objects.select_related(
        "department", "position", "shift", "cost_center", "manager", "salary_structure"
    ).all()
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


class OffboardingViewSet(CompanyScopedViewSet):
    queryset = Offboarding.objects.select_related("employee").all()
    serializer_class = OffboardingSerializer
    permission_module = "hr"

    def get_queryset(self):
        qs = super().get_queryset()
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        return qs

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        offboarding = self.get_object()
        if offboarding.status == Offboarding.Status.COMPLETED:
            raise ValidationError({"status": "Already completed."})
        if not (offboarding.clearance_it and offboarding.clearance_finance and offboarding.clearance_admin):
            raise ValidationError({"detail": "All three clearances (IT, Finance, Admin) must be checked first."})
        with transaction.atomic():
            offboarding.status = Offboarding.Status.COMPLETED
            offboarding.completed_at = timezone.now()
            offboarding.save(update_fields=["status", "completed_at"])
            offboarding.employee.status = Employee.Status.TERMINATED
            offboarding.employee.save(update_fields=["status"])
        return Response(OffboardingSerializer(offboarding).data)


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

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return _cancel_leave_request(self.get_object())

    @action(detail=False, methods=["get"])
    def balances(self, request):
        """Per-leave-type balance (allocated/used/remaining) for one
        employee in one calendar year — the same computation
        LeaveRequestSerializer could enforce, exposed read-only so the UI
        can show it before a request is even submitted."""
        employee_id = request.query_params.get("employee")
        if not employee_id:
            raise ValidationError({"employee": "Required."})
        year = int(request.query_params.get("year") or timezone.localdate().year)
        employee = Employee.objects.filter(id=employee_id, company=request.company).first()
        if employee is None:
            raise ValidationError({"employee": "Not found."})
        return Response(_leave_balances_for(request.company, employee, year))


def _cancel_leave_request(leave):
    if leave.status not in (LeaveRequest.Status.SUBMITTED, LeaveRequest.Status.APPROVED):
        raise ValidationError({"status": "Only a submitted or approved request can be cancelled."})
    today = timezone.localdate()
    was_approved_and_active = (
        leave.status == LeaveRequest.Status.APPROVED and leave.start_date <= today <= leave.end_date
    )
    leave.status = LeaveRequest.Status.CANCELLED
    leave.save(update_fields=["status"])
    if was_approved_and_active and leave.employee.status == Employee.Status.ON_LEAVE:
        leave.employee.status = Employee.Status.ACTIVE
        leave.employee.save(update_fields=["status"])
    return Response(LeaveRequestSerializer(leave).data)


def _leave_balances_for(company, employee, year):
    results = []
    for leave_type in LeaveType.objects.filter(company=company):
        balance = compute_leave_balance(employee, leave_type, year)
        results.append({"leave_type": leave_type.id, "leave_type_name": leave_type.name, "year": year, **balance})
    return results


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
