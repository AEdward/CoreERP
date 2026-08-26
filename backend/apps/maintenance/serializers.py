from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.common.serializers import CompanyScopedSerializer
from apps.hotel.models import Room, RoomStatusLog

from .models import Asset, MaintenanceSchedule, WorkOrder, WorkOrderPart


class WorkOrderPartSerializer(CompanyScopedSerializer):
    # Entirely created via WorkOrderViewSet.use_part, which also builds
    # the paired StockMovement — never a plain client POST, so every
    # field is read-only here.
    item_name = serializers.CharField(source="item.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = WorkOrderPart
        fields = [
            "id",
            "work_order",
            "item",
            "item_name",
            "warehouse",
            "warehouse_name",
            "quantity",
            "movement",
            "created_at",
        ]
        read_only_fields = fields


class WorkOrderSerializer(CompanyScopedSerializer):
    # status/resolved_at are read-only — the resolve action is the only
    # way a work order completes, since that's also what puts the room
    # back into service (see create()/resolve() below). reported_by and
    # schedule are set from the request/generate action, not client-writable.
    same_company_fields = ["room", "asset"]
    room_number = serializers.CharField(source="room.number", read_only=True)
    reported_by_name = serializers.CharField(source="reported_by.full_name", read_only=True)
    assigned_to_name = serializers.CharField(source="assigned_to.full_name", read_only=True)
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    parts_used = WorkOrderPartSerializer(many=True, read_only=True)

    class Meta:
        model = WorkOrder
        fields = [
            "id",
            "room",
            "room_number",
            "asset",
            "asset_name",
            "title",
            "description",
            "priority",
            "status",
            "reported_by",
            "reported_by_name",
            "assigned_to",
            "assigned_to_name",
            "resolved_at",
            "schedule",
            "parts_used",
            "created_at",
        ]
        read_only_fields = ["id", "status", "reported_by", "resolved_at", "schedule", "created_at"]

    def create(self, validated_data):
        # Opening a work order takes the room out of service — a
        # deliberate MVP simplification (docs/TODO.md §4.2): a real
        # deployment might not want every minor issue to close a room,
        # but that nuance needs a real trigger to design around, not a
        # guess now.
        request = self.context["request"]
        with transaction.atomic():
            work_order = WorkOrder.objects.create(reported_by=request.user, **validated_data)
            room = work_order.room
            room.status = Room.Status.MAINTENANCE
            room.save(update_fields=["status"])
            RoomStatusLog.objects.create(
                company=work_order.company,
                room=room,
                status=Room.Status.MAINTENANCE,
                changed_by=request.user,
            )
        return work_order


class MaintenanceScheduleSerializer(CompanyScopedSerializer):
    same_company_fields = ["room"]
    room_number = serializers.CharField(source="room.number", read_only=True)
    is_due = serializers.SerializerMethodField()

    class Meta:
        model = MaintenanceSchedule
        fields = [
            "id",
            "room",
            "room_number",
            "title",
            "description",
            "priority",
            "frequency_days",
            "next_due_date",
            "is_active",
            "is_due",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_is_due(self, obj):
        return obj.is_active and obj.next_due_date <= timezone.localdate()


class AssetSerializer(CompanyScopedSerializer):
    same_company_fields = ["room"]
    room_number = serializers.CharField(source="room.number", read_only=True)

    class Meta:
        model = Asset
        fields = [
            "id",
            "name",
            "category",
            "room",
            "room_number",
            "location",
            "serial_number",
            "purchase_date",
            "purchase_cost_cents",
            "useful_life_years",
            "warranty_expiry_date",
            "status",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
