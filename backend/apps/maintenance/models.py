from django.conf import settings
from django.db import models

from apps.catalog.models import Item
from apps.common.models import TenantModel
from apps.hotel.models import Room
from apps.inventory.models import StockMovement, Warehouse


class WorkOrder(TenantModel):
    """Room is still required — a work order is always raised against a
    room, same as before Asset Management existed. `asset` is an optional
    tag on top of that, for when the ticket is really about one specific
    piece of equipment in the room (the minibar, not "the room"). Assets
    that live outside any room (lobby AC, an elevator) can't be ticketed
    through this model yet — MaintenanceSchedule has the same room-only
    constraint, and neither is loosened here; see Asset.room's own
    docstring for why.
    """

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    room = models.ForeignKey(Room, on_delete=models.PROTECT, related_name="work_orders")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    priority = models.CharField(max_length=16, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    # Set only by MaintenanceScheduleViewSet.generate_work_order — never
    # client-writable on a plain WorkOrder create (see WorkOrderSerializer).
    # Lets a generated ticket be traced back to the recurring schedule
    # that produced it without the schedule needing to guess or search.
    schedule = models.ForeignKey(
        "MaintenanceSchedule", on_delete=models.SET_NULL, null=True, blank=True, related_name="generated_work_orders"
    )
    asset = models.ForeignKey(
        "Asset", on_delete=models.SET_NULL, null=True, blank=True, related_name="work_orders"
    )

    class Meta:
        db_table = "maintenance_work_orders"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} — {self.room} ({self.status})"


class MaintenanceSchedule(TenantModel):
    """A recurring preventive-maintenance reminder — "check the AC filter
    every 90 days" — not a ticket itself. MaintenanceScheduleViewSet
    .generate_work_order turns a due schedule into a real WorkOrder (going
    through the same WorkOrderSerializer.create() every other work order
    does, so it gets the same room-status-flip side effect) and advances
    next_due_date by frequency_days. Nothing here runs on a timer — there's
    no background job infrastructure in this project — so a schedule only
    produces a work order when someone reviews the due list and generates
    it, the same way every other cross-cutting action in this app is
    explicitly triggered rather than silently automatic.
    """

    room = models.ForeignKey(Room, on_delete=models.PROTECT, related_name="maintenance_schedules")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    priority = models.CharField(max_length=16, choices=WorkOrder.Priority.choices, default=WorkOrder.Priority.MEDIUM)
    frequency_days = models.PositiveIntegerField()
    next_due_date = models.DateField()
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "maintenance_schedules"
        ordering = ["next_due_date"]

    def __str__(self):
        return f"{self.title} — {self.room} (every {self.frequency_days}d)"


class Asset(TenantModel):
    """The general equipment registry WorkOrder's own history docstring
    used to point at as future work. `room` is nullable on purpose —
    plenty of real equipment (lobby AC, the elevator, a generator) isn't
    inside any guest room, so `location` is free text for exactly that
    case. WorkOrder and MaintenanceSchedule still require a room (their
    own room-status-flip side effects depend on it), so a ticket about a
    room-less asset still needs some room picked on the ticket itself —
    a known rough edge, not fixed here; loosening that would touch
    tested, working create() logic and deserves its own pass rather than
    a rushed edit alongside a new model.
    """

    class Category(models.TextChoices):
        FURNITURE = "furniture", "Furniture"
        ELECTRONICS = "electronics", "Electronics"
        HVAC = "hvac", "HVAC"
        KITCHEN_EQUIPMENT = "kitchen_equipment", "Kitchen Equipment"
        VEHICLE = "vehicle", "Vehicle"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        IN_SERVICE = "in_service", "In service"
        UNDER_MAINTENANCE = "under_maintenance", "Under maintenance"
        RETIRED = "retired", "Retired"

    name = models.CharField(max_length=255)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    room = models.ForeignKey(Room, on_delete=models.SET_NULL, null=True, blank=True, related_name="assets")
    location = models.CharField(max_length=255, blank=True)
    serial_number = models.CharField(max_length=100, blank=True)
    purchase_date = models.DateField(null=True, blank=True)
    purchase_cost_cents = models.BigIntegerField(null=True, blank=True)
    # Straight-line depreciation input for Finance's Asset Depreciation
    # page — null means "not depreciated" (e.g. an asset with no known
    # purchase cost/date yet), not "depreciates over 0 years".
    useful_life_years = models.PositiveIntegerField(null=True, blank=True)
    warranty_expiry_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.IN_SERVICE)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "maintenance_assets"
        ordering = ["name"]

    def __str__(self):
        return self.name


class WorkOrderPart(TenantModel):
    """A spare part consumed while resolving a work order. Not a new
    stock system — a thin link between an existing apps.catalog.Item and
    the ticket that used it. Every row here is created alongside a real
    OUT apps.inventory.StockMovement (see WorkOrderViewSet.use_part,
    which builds both through StockMovementSerializer so quantity
    validation and the stock decrement are the exact same code path
    Inventory's own movement endpoint uses — this model never mutates
    Stock itself). `movement` is the audit trail of the stock change;
    this model is the "which ticket was it for" side of that same event.
    """

    work_order = models.ForeignKey(WorkOrder, on_delete=models.CASCADE, related_name="parts_used")
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="+")
    quantity = models.PositiveIntegerField()
    movement = models.ForeignKey(StockMovement, on_delete=models.PROTECT, related_name="+")

    class Meta:
        db_table = "maintenance_work_order_parts"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.quantity} x {self.item} for {self.work_order}"
