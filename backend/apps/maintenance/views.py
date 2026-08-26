from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.common.views import CompanyScopedViewSet
from apps.hotel.models import Room, RoomStatusLog
from apps.inventory.models import StockMovement
from apps.inventory.serializers import StockMovementSerializer

from .models import Asset, MaintenanceSchedule, WorkOrder, WorkOrderPart
from .serializers import AssetSerializer, MaintenanceScheduleSerializer, WorkOrderPartSerializer, WorkOrderSerializer


class WorkOrderViewSet(CompanyScopedViewSet):
    queryset = WorkOrder.objects.select_related("room", "asset", "reported_by", "assigned_to").prefetch_related(
        "parts_used__item", "parts_used__warehouse"
    )
    serializer_class = WorkOrderSerializer
    permission_module = "maintenance"

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        work_order = self.get_object()
        if work_order.status not in (WorkOrder.Status.OPEN, WorkOrder.Status.IN_PROGRESS):
            raise ValidationError({"status": "Only an open or in-progress work order can be resolved."})

        with transaction.atomic():
            work_order.status = WorkOrder.Status.COMPLETED
            work_order.resolved_at = timezone.now()
            work_order.save(update_fields=["status", "resolved_at"])

            # Fixed, not just reopened — still needs housekeeping before
            # it's sellable again, same as check-out (apps.hotel.views).
            room = work_order.room
            room.status = Room.Status.DIRTY
            room.save(update_fields=["status"])
            RoomStatusLog.objects.create(
                company=room.company, room=room, status=Room.Status.DIRTY, changed_by=request.user
            )
        return Response(WorkOrderSerializer(work_order).data)

    @action(detail=True, methods=["post"])
    def use_part(self, request, pk=None):
        """Records a spare part consumed on this ticket. Goes through
        StockMovementSerializer exactly the way Inventory's own
        stock-movements endpoint does — same quantity validation, same
        stock decrement — so a part used here isn't a separate, weaker
        stock system, just this ticket's view onto a real OUT movement."""
        work_order = self.get_object()
        movement_serializer = StockMovementSerializer(
            data={
                "item": request.data.get("item"),
                "warehouse": request.data.get("warehouse"),
                "type": StockMovement.MovementType.OUT,
                "quantity": request.data.get("quantity"),
                "reference": f"Work order #{work_order.id}: {work_order.title}",
            },
            context={"request": request},
        )
        movement_serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            movement = movement_serializer.save(company=work_order.company)
            part = WorkOrderPart.objects.create(
                company=work_order.company,
                work_order=work_order,
                item=movement.item,
                warehouse=movement.warehouse,
                quantity=movement.quantity,
                movement=movement,
            )

        return Response(WorkOrderPartSerializer(part).data, status=201)


class MaintenanceScheduleViewSet(CompanyScopedViewSet):
    queryset = MaintenanceSchedule.objects.select_related("room").all()
    serializer_class = MaintenanceScheduleSerializer
    permission_module = "maintenance"

    @action(detail=False, methods=["get"])
    def due(self, request):
        today = timezone.localdate()
        qs = self.get_queryset().filter(is_active=True, next_due_date__lte=today)
        return Response(MaintenanceScheduleSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"])
    def generate_work_order(self, request, pk=None):
        schedule = self.get_object()
        if not schedule.is_active:
            raise ValidationError({"is_active": "This schedule is inactive."})
        today = timezone.localdate()
        if schedule.next_due_date > today:
            raise ValidationError({"next_due_date": "This schedule isn't due yet."})

        with transaction.atomic():
            # Reuses WorkOrderSerializer.create() rather than
            # WorkOrder.objects.create() directly, so a generated ticket
            # gets the exact same room-status-flip side effect a manually
            # opened one does — one creation path, not two.
            work_order = WorkOrderSerializer(context={"request": request}).create(
                {
                    "company": schedule.company,
                    "room": schedule.room,
                    "title": schedule.title,
                    "description": schedule.description,
                    "priority": schedule.priority,
                    "schedule": schedule,
                }
            )
            schedule.next_due_date = schedule.next_due_date + timedelta(days=schedule.frequency_days)
            schedule.save(update_fields=["next_due_date"])

        return Response(WorkOrderSerializer(work_order).data, status=201)


class AssetViewSet(CompanyScopedViewSet):
    queryset = Asset.objects.select_related("room").all()
    serializer_class = AssetSerializer
    permission_module = "maintenance"
