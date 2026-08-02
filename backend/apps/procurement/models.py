from django.db import models

from apps.catalog.models import Item
from apps.common.models import TenantModel
from apps.suppliers.models import Supplier


class PurchaseOrder(TenantModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"
        RECEIVED = "received", "Received"
        CANCELLED = "cancelled", "Cancelled"

    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="purchase_orders")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)

    class Meta:
        db_table = "purchase_orders"
        ordering = ["-created_at"]

    def __str__(self):
        return f"PO-{self.id} ({self.supplier})"

    @property
    def total_cents(self):
        return sum(line.quantity * line.unit_cost_cents for line in self.lines.all())


class PurchaseOrderLine(TenantModel):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    quantity = models.PositiveIntegerField()
    unit_cost_cents = models.BigIntegerField()

    class Meta:
        db_table = "purchase_order_lines"

    @property
    def line_total_cents(self):
        return self.quantity * self.unit_cost_cents

    def __str__(self):
        return f"{self.quantity} x {self.item}"
