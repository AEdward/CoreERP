from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.views import CompanyScopedViewSet

from .models import Department, Employee
from .serializers import DepartmentSerializer, EmployeeSerializer


class DepartmentViewSet(CompanyScopedViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_module = "hr"


class EmployeeViewSet(CompanyScopedViewSet):
    queryset = Employee.objects.select_related("department").all()
    serializer_class = EmployeeSerializer
    permission_module = "hr"


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
