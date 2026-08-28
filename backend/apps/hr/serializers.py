from rest_framework import serializers

from apps.common.serializers import CompanyScopedSerializer

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


class ShiftTemplateSerializer(CompanyScopedSerializer):
    scheduled_hours = serializers.FloatField(read_only=True)

    class Meta:
        model = ShiftTemplate
        fields = ["id", "name", "start_time", "end_time", "break_minutes", "scheduled_hours", "created_at"]
        read_only_fields = ["id", "created_at"]


class EmployeeSerializer(CompanyScopedSerializer):
    same_company_fields = ["department", "branch", "position", "shift", "cost_center", "manager"]
    user_name = serializers.SerializerMethodField()
    manager_name = serializers.SerializerMethodField()

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
            "shift",
            "cost_center",
            "manager",
            "manager_name",
            "salary_cents",
            "joining_date",
            "status",
            "user",
            "user_name",
            "payment_method",
            "bank_name",
            "bank_account_number",
            "bank_account_name",
            "national_id",
            "passport_number",
            "date_of_birth",
            "gender",
            "marital_status",
            "address",
            "emergency_contact_name",
            "emergency_contact_phone",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_user_name(self, obj):
        return obj.user.full_name if obj.user_id else ""

    def get_manager_name(self, obj):
        return str(obj.manager) if obj.manager_id else ""

    def validate_manager(self, value):
        if value is not None and self.instance is not None and value.pk == self.instance.pk:
            raise serializers.ValidationError("An employee can't be their own manager.")
        return value

    def validate_user(self, value):
        if value is None:
            return value
        request = self.context.get("request")
        company = getattr(request, "company", None)
        if company and not company.memberships.filter(user=value, status="active").exists():
            raise serializers.ValidationError("Must be an active member of this company.")
        return value


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


class AttendanceRecordSerializer(CompanyScopedSerializer):
    same_company_fields = ["employee"]
    worked_hours = serializers.FloatField(read_only=True)
    overtime_hours = serializers.FloatField(read_only=True)

    class Meta:
        model = AttendanceRecord
        fields = [
            "id",
            "employee",
            "date",
            "clock_in",
            "clock_out",
            "status",
            "source",
            "notes",
            "worked_hours",
            "overtime_hours",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
