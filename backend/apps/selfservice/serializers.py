from rest_framework import serializers

from apps.hr.models import LeaveRequest
from apps.recruitment.models import OnboardingTask


class MyLeaveRequestSerializer(serializers.ModelSerializer):
    """Employee-facing mirror of apps.hr.serializers.LeaveRequestSerializer
    — `employee` isn't a client-writable field here (MyLeaveRequestViewSet
    forces it to the caller's own linked Employee), which is the whole
    point of this being a separate serializer rather than reusing that
    one with an override."""

    leave_type_name = serializers.CharField(source="leave_type.name", read_only=True)
    days = serializers.IntegerField(read_only=True)

    class Meta:
        model = LeaveRequest
        fields = [
            "id",
            "leave_type",
            "leave_type_name",
            "start_date",
            "end_date",
            "reason",
            "status",
            "days",
            "created_at",
        ]
        read_only_fields = ["id", "status", "created_at"]

    def validate_leave_type(self, value):
        request = self.context.get("request")
        company = getattr(request, "company", None)
        if company and value.company_id != company.id:
            raise serializers.ValidationError("Must belong to the active company.")
        return value

    def validate(self, attrs):
        employee = self.context["employee"]
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start_date and end_date:
            overlapping = LeaveRequest.objects.filter(
                employee=employee,
                status=LeaveRequest.Status.APPROVED,
                start_date__lte=end_date,
                end_date__gte=start_date,
            )
            if overlapping.exists():
                raise serializers.ValidationError(
                    "You already have an approved leave request overlapping these dates."
                )
        return attrs


class MyOnboardingTaskSerializer(serializers.ModelSerializer):
    """Read + toggle-only from the employee's side — creating/deleting
    checklist items stays an HR action (apps.recruitment.OnboardingTaskViewSet)."""

    class Meta:
        model = OnboardingTask
        fields = ["id", "title", "is_complete", "due_date", "created_at"]
        read_only_fields = ["id", "title", "due_date", "created_at"]
