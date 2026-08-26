from django.db import models

from apps.catalog.models import Item
from apps.common.models import TenantModel
from apps.crm.models import Customer
from apps.hotel.models import Reservation


class LaundryOrder(TenantModel):
    """Guest Laundry and Hotel Linen (docs) are one model, distinguished by
    `category` — same "one generic model, not one table per concept"
    precedent as HousekeepingTask. Billing (status/receipt_number,
    charge_to_room/mark_paid) only applies to guest orders; hotel_linen is
    an internal batch with nobody to bill — see LaundryOrderViewSet."""

    class Category(models.TextChoices):
        GUEST = "guest", "Guest laundry"
        HOTEL_LINEN = "hotel_linen", "Hotel linen"

    class TrackingStatus(models.TextChoices):
        RECEIVED = "received", "Received"
        WASHING = "washing", "Washing"
        READY = "ready", "Ready"
        DELIVERED = "delivered", "Delivered"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        PAID = "paid", "Paid"
        CHARGED_TO_ROOM = "charged_to_room", "Charged to room"
        CANCELLED = "cancelled", "Cancelled"

    category = models.CharField(max_length=16, choices=Category.choices, default=Category.GUEST)
    reservation = models.ForeignKey(
        Reservation, on_delete=models.SET_NULL, null=True, blank=True, related_name="laundry_orders"
    )
    guest = models.ForeignKey(
        Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name="laundry_orders"
    )
    tracking_status = models.CharField(
        max_length=16, choices=TrackingStatus.choices, default=TrackingStatus.RECEIVED
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    # Same "blank until issued" pattern as apps.pos.Order.receipt_number —
    # only set once a guest order is closed (paid or charged to room).
    receipt_number = models.CharField(max_length=32, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "laundry_orders"
        constraints = [
            models.UniqueConstraint(
                fields=["company", "receipt_number"],
                name="unique_company_laundry_receipt_number",
                condition=~models.Q(receipt_number=""),
            )
        ]
        ordering = ["-created_at"]

    @property
    def total_cents(self):
        return sum(line.quantity * line.unit_price_cents for line in self.lines.all())

    def __str__(self):
        return f"Laundry #{self.pk} ({self.get_category_display()}, {self.tracking_status})"


class LaundryOrderLine(TenantModel):
    order = models.ForeignKey(LaundryOrder, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    quantity = models.PositiveIntegerField()
    # Snapshotted from item.price_cents at order time — same reasoning as
    # every other line-item model in this codebase.
    unit_price_cents = models.BigIntegerField()

    class Meta:
        db_table = "laundry_order_lines"
        ordering = ["created_at"]

    @property
    def line_total_cents(self):
        return self.quantity * self.unit_price_cents

    def __str__(self):
        return f"{self.quantity} x {self.item}"
