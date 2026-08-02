from django.db import models

from apps.catalog.models import Item
from apps.common.models import TenantModel


class Warehouse(TenantModel):
    name = models.CharField(max_length=100)
    location = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "warehouses"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_warehouse_name")
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


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

    class Meta:
        db_table = "stock_movements"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.type} {self.quantity} x {self.item} @ {self.warehouse}"
