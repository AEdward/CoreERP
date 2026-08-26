from django.conf import settings
from django.db import models

from apps.catalog.models import Item
from apps.common.models import TenantModel
from apps.crm.models import Customer
from apps.hotel.models import Reservation


class SpaBooking(TenantModel):
    """The billing container — one guest checkout, potentially covering
    several treatments (a "package"). Mirrors apps.laundry.LaundryOrder /
    apps.pos.Order: booking-level `status` is billing only, each
    SpaBookingLine carries its own scheduling/treatment-progress state,
    same split as Order/OrderLine's kitchen_status."""

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        PAID = "paid", "Paid"
        CHARGED_TO_ROOM = "charged_to_room", "Charged to room"
        CANCELLED = "cancelled", "Cancelled"

    reservation = models.ForeignKey(
        Reservation, on_delete=models.SET_NULL, null=True, blank=True, related_name="spa_bookings"
    )
    guest = models.ForeignKey(
        Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name="spa_bookings"
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    # Same "blank until issued" pattern as apps.pos.Order.receipt_number.
    receipt_number = models.CharField(max_length=32, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "spa_bookings"
        constraints = [
            models.UniqueConstraint(
                fields=["company", "receipt_number"],
                name="unique_company_spa_receipt_number",
                condition=~models.Q(receipt_number=""),
            )
        ]
        ordering = ["-created_at"]

    @property
    def total_cents(self):
        return sum(line.quantity * line.unit_price_cents for line in self.lines.all())

    def __str__(self):
        return f"Spa booking #{self.pk} ({self.status})"


class SpaBookingLine(TenantModel):
    """One treatment within a booking — Packages are just a booking with
    more than one line. `treatment` reuses apps.catalog.Item (type=service)
    rather than a new Treatment model, same "extend don't duplicate"
    principle apps.pos uses for its menu."""

    class TreatmentStatus(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    booking = models.ForeignKey(SpaBooking, on_delete=models.CASCADE, related_name="lines")
    treatment = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    therapist = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    scheduled_at = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(default=60)
    quantity = models.PositiveIntegerField(default=1)
    # Snapshotted from treatment.price_cents at booking time, same
    # reasoning as every other line-item model in this codebase.
    unit_price_cents = models.BigIntegerField()
    status = models.CharField(
        max_length=16, choices=TreatmentStatus.choices, default=TreatmentStatus.SCHEDULED
    )

    class Meta:
        db_table = "spa_booking_lines"
        ordering = ["scheduled_at", "created_at"]

    @property
    def line_total_cents(self):
        return self.quantity * self.unit_price_cents

    def __str__(self):
        return f"{self.treatment} ({self.status})"
