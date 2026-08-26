from rest_framework import serializers

from apps.common.serializers import CompanyScopedSerializer

from .models import HousekeepingTask


class HousekeepingTaskSerializer(CompanyScopedSerializer):
    # status is read-only — transitions go through the start/complete/cancel
    # actions (apps.hotel.views), same reasoning as Room.status and
    # Reservation.status: completing a cleaning/inspection task also
    # changes the room's status, and a plain PATCH can't be trusted to
    # remember that.
    same_company_fields = ["room"]
    room_number = serializers.CharField(source="room.number", read_only=True)
    assigned_to_name = serializers.CharField(source="assigned_to.full_name", read_only=True)

    class Meta:
        model = HousekeepingTask
        fields = [
            "id",
            "room",
            "room_number",
            "task_type",
            "status",
            "assigned_to",
            "assigned_to_name",
            "notes",
            "scheduled_date",
            "created_at",
        ]
        read_only_fields = ["id", "status", "created_at"]
