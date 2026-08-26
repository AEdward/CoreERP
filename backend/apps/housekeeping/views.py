from django.db import transaction
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.common.views import CompanyScopedViewSet
from apps.hotel.models import Room, RoomStatusLog

from .models import HousekeepingTask
from .serializers import HousekeepingTaskSerializer

# What finishing a task does to the room it's for — cleaning hands the
# room back to housekeeping's own "clean" state, and completing an
# inspection is what actually puts a room back up for sale. Linen and
# lost & found tasks don't affect room status at all.
COMPLETION_ROOM_STATUS = {
    HousekeepingTask.TaskType.CLEANING: Room.Status.CLEAN,
    HousekeepingTask.TaskType.INSPECTION: Room.Status.AVAILABLE,
}


class HousekeepingTaskViewSet(CompanyScopedViewSet):
    queryset = HousekeepingTask.objects.select_related("room", "assigned_to").all()
    serializer_class = HousekeepingTaskSerializer
    permission_module = "housekeeping"

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        task = self.get_object()
        if task.status != HousekeepingTask.Status.PENDING:
            raise ValidationError({"status": "Only a pending task can be started."})
        task.status = HousekeepingTask.Status.IN_PROGRESS
        task.save(update_fields=["status"])
        return Response(HousekeepingTaskSerializer(task).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        task = self.get_object()
        if task.status not in (HousekeepingTask.Status.PENDING, HousekeepingTask.Status.IN_PROGRESS):
            raise ValidationError({"status": "Only a pending or in-progress task can be completed."})

        with transaction.atomic():
            task.status = HousekeepingTask.Status.DONE
            task.save(update_fields=["status"])

            new_room_status = COMPLETION_ROOM_STATUS.get(task.task_type)
            if new_room_status:
                room = task.room
                room.status = new_room_status
                room.save(update_fields=["status"])
                RoomStatusLog.objects.create(
                    company=room.company, room=room, status=new_room_status, changed_by=request.user
                )
        return Response(HousekeepingTaskSerializer(task).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        task = self.get_object()
        if task.status not in (HousekeepingTask.Status.PENDING, HousekeepingTask.Status.IN_PROGRESS):
            raise ValidationError({"status": "Only a pending or in-progress task can be cancelled."})
        task.status = HousekeepingTask.Status.CANCELLED
        task.save(update_fields=["status"])
        return Response(HousekeepingTaskSerializer(task).data)
