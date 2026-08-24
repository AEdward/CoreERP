from django.db import models

from apps.branches.models import Branch
from apps.catalog.models import Item
from apps.common.models import TenantModel


class Warehouse(TenantModel):
    name = models.CharField(max_length=100)
    location = models.CharField(max_length=255, blank=True)
    branch = models.ForeignKey(
        Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name="warehouses"
    )

    class Meta:
        db_table = "warehouses"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_warehouse_name")
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class StorageLocation(TenantModel):
    """A sub-warehouse bin/aisle — an addressable list scoped to one
    Warehouse. Deliberately doesn't make Stock itself location-granular
    (the same item split across several bins within a warehouse is a
    bigger design decision — changing Stock's (item, warehouse)
    uniqueness to include location, and rethinking every place that
    reads/writes Stock.quantity). This is the safe, additive version:
    StockMovement can optionally note which location goods came
    from/went to, for locating things within a warehouse, without
    redesigning how quantities are tracked."""

    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="storage_locations")
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = "storage_locations"
        constraints = [
            models.UniqueConstraint(fields=["warehouse", "name"], name="unique_warehouse_location_name")
        ]
        ordering = ["warehouse_id", "name"]

    def __str__(self):
        return f"{self.name} @ {self.warehouse}"


class Stock(TenantModel):
    """Live materialized quantity per (item, warehouse) — mutated only
    through StockMovement.apply(), never edited directly, so every
    quantity change has an audit-trail row explaining it."""

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="stock_records")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="stock_records")
    quantity = models.IntegerField(default=0)
    minimum_stock = models.IntegerField(default=0)

    class Meta:
        db_table = "stock"
        constraints = [
            models.UniqueConstraint(fields=["item", "warehouse"], name="unique_item_warehouse_stock")
        ]
        ordering = ["item_id", "warehouse_id"]

    def __str__(self):
        return f"{self.item} @ {self.warehouse}: {self.quantity}"


class StockMovement(TenantModel):
    class MovementType(models.TextChoices):
        IN = "in", "In"
        OUT = "out", "Out"
        TRANSFER = "transfer", "Transfer"
        ADJUSTMENT = "adjustment", "Adjustment"

    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="movements")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="movements")
    to_warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="incoming_transfers",
        help_text="Required for type=transfer only.",
    )
    type = models.CharField(max_length=16, choices=MovementType.choices)
    # Magnitude for in/out/transfer (must be positive); signed delta for
    # adjustment (positive or negative, never zero) — see serializer.
    quantity = models.IntegerField()
    reference = models.CharField(max_length=255, blank=True)
    # Optional — which bin within `warehouse` this movement is against.
    # Purely descriptive metadata (see StorageLocation's docstring);
    # Stock quantities stay tracked per-warehouse, not per-location.
    location = models.ForeignKey(
        StorageLocation, on_delete=models.SET_NULL, null=True, blank=True, related_name="movements"
    )

    class Meta:
        db_table = "stock_movements"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.type} {self.quantity} x {self.item} @ {self.warehouse}"


class StockCount(TenantModel):
    """A physical/cycle count session for one warehouse. Created with a
    snapshot of every current Stock row for that warehouse as a
    StockCountLine (system_quantity); staff fill in counted_quantity per
    line, then `finalize` (StockCountViewSet) posts one adjustment
    StockMovement per line that differs, through the same
    StockMovementSerializer every other stock-moving feature goes
    through — so a count's corrections show up in the same audit trail
    and low-stock notifications as any other movement."""

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        COMPLETED = "completed", "Completed"

    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="stock_counts")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "stock_counts"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Count #{self.pk} — {self.warehouse}"


class StockCountLine(TenantModel):
    stock_count = models.ForeignKey(StockCount, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    system_quantity = models.IntegerField()
    counted_quantity = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = "stock_count_lines"
        constraints = [
            models.UniqueConstraint(fields=["stock_count", "item"], name="unique_stock_count_item")
        ]
        ordering = ["item__name"]

    @property
    def variance(self):
        return None if self.counted_quantity is None else self.counted_quantity - self.system_quantity

    def __str__(self):
        return f"{self.item} — system {self.system_quantity}, counted {self.counted_quantity}"
