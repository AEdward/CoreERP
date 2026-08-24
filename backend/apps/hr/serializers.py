from rest_framework import serializers

from apps.common.serializers import CompanyScopedSerializer

from .models import Department, Employee, EmployeeContract, LeaveRequest, LeaveType, Position


class DepartmentSerializer(CompanyScopedSerializer):
    same_company_fields = ["branch"]

    class Meta:
        model = Department
        fields = ["id", "name", "branch", "created_at"]
        read_only_fields = ["id", "created_at"]


class PositionSerializer(CompanyScopedSerializer):
    same_company_fields = ["department"]

    class Meta:
        model = Position
        fields = ["id", "title", "department", "created_at"]
        read_only_fields = ["id", "created_at"]


class EmployeeSerializer(CompanyScopedSerializer):
    same_company_fields = ["department", "branch", "position"]

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


class EmployeeContractSerializer(CompanyScopedSerializer):
    same_company_fields = ["employee"]

    class Meta:
        model = EmployeeContract
        fields = [
            "id",
            "employee",
            "contract_type",
            "start_date",
            "end_date",
            "salary_cents",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class LeaveTypeSerializer(CompanyScopedSerializer):
    class Meta:
        model = LeaveType
        fields = ["id", "name", "paid", "created_at"]
        read_only_fields = ["id", "created_at"]


class LeaveRequestSerializer(CompanyScopedSerializer):
    same_company_fields = ["employee", "leave_type"]
    days = serializers.IntegerField(read_only=True)

    class Meta:
        model = LeaveRequest
        fields = [
            "id",
            "employee",
            "leave_type",
            "start_date",
            "end_date",
            "reason",
            "status",
            "days",
            "created_at",
        ]
        read_only_fields = ["id", "status", "created_at"]

    def validate(self, attrs):
        employee = attrs.get("employee", getattr(self.instance, "employee", None))
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if employee and start_date and end_date:
            overlapping = LeaveRequest.objects.filter(
                employee=employee,
                status=LeaveRequest.Status.APPROVED,
                start_date__lte=end_date,
                end_date__gte=start_date,
            )
            if self.instance:
                overlapping = overlapping.exclude(pk=self.instance.pk)
            if overlapping.exists():
                raise serializers.ValidationError(
                    "This employee already has an approved leave request overlapping these dates."
                )
        return attrs
