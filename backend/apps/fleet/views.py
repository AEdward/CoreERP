from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.common.views import CompanyScopedViewSet

from .models import Vehicle, VehicleAssignment
from .serializers import VehicleAssignmentSerializer, VehicleSerializer


class VehicleViewSet(CompanyScopedViewSet):
    queryset = Vehicle.objects.prefetch_related("assignments").all()
    serializer_class = VehicleSerializer
    permission_module = "hr"


class VehicleAssignmentViewSet(CompanyScopedViewSet):
    queryset = VehicleAssignment.objects.select_related("vehicle", "employee").all()
    serializer_class = VehicleAssignmentSerializer
    permission_module = "hr"

    def get_queryset(self):
        qs = super().get_queryset()
        vehicle_id = self.request.query_params.get("vehicle")
        if vehicle_id:
            qs = qs.filter(vehicle_id=vehicle_id)
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        return qs

    @action(detail=True, methods=["post"])
    def end(self, request, pk=None):
        assignment = self.get_object()
        if assignment.end_date is not None:
            raise ValidationError("This assignment has already ended.")
        assignment.end_date = timezone.localdate()
        assignment.save(update_fields=["end_date"])
        return Response(VehicleAssignmentSerializer(assignment).data)
