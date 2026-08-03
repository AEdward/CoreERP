from apps.common.serializers import CompanyScopedSerializer

from .models import Department, Employee


class DepartmentSerializer(CompanyScopedSerializer):
    same_company_fields = ["branch"]

    class Meta:
        model = Department
        fields = ["id", "name", "branch", "created_at"]
        read_only_fields = ["id", "created_at"]


class EmployeeSerializer(CompanyScopedSerializer):
    same_company_fields = ["department", "branch"]

    class Meta:
        model = Employee
        fields = [
            "id",
            "first_name",
            "last_name",
            "email",
            "phone",
            "position",
            "department",
            "branch",
            "salary_cents",
            "joining_date",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
