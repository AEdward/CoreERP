from rest_framework import serializers

from apps.common.serializers import CompanyScopedSerializer

from .models import Vehicle, VehicleAssignment


class VehicleSerializer(CompanyScopedSerializer):
    current_assignee_name = serializers.SerializerMethodField()

    class Meta:
        model = Vehicle
        fields = [
            "id",
            "registration_number",
            "make",
            "model",
            "year",
            "status",
            "notes",
            "current_assignee_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_current_assignee_name(self, obj):
        assignment = obj.current_assignment
        return str(assignment.employee) if assignment else ""


class VehicleAssignmentSerializer(CompanyScopedSerializer):
    same_company_fields = ["vehicle", "employee"]
    vehicle_registration = serializers.CharField(source="vehicle.registration_number", read_only=True)
    employee_name = serializers.CharField(source="employee.__str__", read_only=True)

    class Meta:
        model = VehicleAssignment
        fields = [
            "id",
            "vehicle",
            "vehicle_registration",
            "employee",
            "employee_name",
            "start_date",
            "end_date",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        vehicle = attrs.get("vehicle", getattr(self.instance, "vehicle", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if vehicle and end_date is None:
            open_assignments = VehicleAssignment.objects.filter(vehicle=vehicle, end_date__isnull=True)
            if self.instance:
                open_assignments = open_assignments.exclude(pk=self.instance.pk)
            if open_assignments.exists():
                raise serializers.ValidationError(
                    {"vehicle": "This vehicle already has an open assignment — end it first."}
                )
        return attrs