import datetime

from django.conf import settings
from django.db import models

from apps.catalog.models import Item
from apps.common.models import TenantModel
from apps.crm.models import Customer
from apps.hotel.models import Reservation


class BillingStatus(models.TextChoices):
    OPEN = "open", "Open"
    PAID = "paid", "Paid"
    CHARGED_TO_ROOM = "charged_to_room", "Charged to room"
    CANCELLED = "cancelled", "Cancelled"


class GymMembership(TenantModel):
    """Membership (docs: "Membership") — a date-ranged pass, billed once
    like a single-line sale rather than the Order+Line shape Daily
    Access/Personal Trainers use below, since a membership doesn't
    decompose into treatments/items. `membership_status` is derived from
    `status` + today vs `end_date` rather than a second stored state
    machine — see the property below."""

    class PlanType(models.TextChoices):
        MONTHLY = "monthly", "Monthly"
        ANNUAL = "annual", "Annual"

    guest = models.ForeignKey(
        Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name="gym_memberships"
    )
    reservation = models.ForeignKey(
        Reservation, on_delete=models.SET_NULL, null=True, blank=True, related_name="gym_memberships"
    )
    plan_type = models.CharField(max_length=16, choices=PlanType.choices, default=PlanType.MONTHLY)
    start_date = models.DateField()
    end_date = models.DateField()
    price_cents = models.BigIntegerField()
    status = models.CharField(max_length=16, choices=BillingStatus.choices, default=BillingStatus.OPEN)
    receipt_number = models.CharField(max_length=32, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "gym_memberships"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(end_date__gt=models.F("start_date")), name="gym_membership_end_after_start"
            ),
            models.UniqueConstraint(
                fields=["company", "receipt_number"],
                name="unique_company_gym_membership_receipt_number",
                condition=~models.Q(receipt_number=""),
            ),
        ]
        ordering = ["-created_at"]

    @property
    def membership_status(self):
        if self.status == BillingStatus.CANCELLED:
            return "cancelled"
        if self.status == BillingStatus.OPEN:
            return "pending"
        return "expired" if self.end_date < datetime.date.today() else "active"

    def __str__(self):
        return f"Gym membership #{self.pk} ({self.get_plan_type_display()})"


class GymBooking(TenantModel):
    """Daily Access + Personal Trainer sessions — same Order+Line shape as
    apps.spa.SpaBooking/SpaBookingLine (booking = billing container, each
    line one activity with its own trainer/schedule/status), `trainer`
    standing in for spa's `therapist`. A day pass is just a line with no
    trainer assigned."""

    reservation = models.ForeignKey(
        Reservation, on_delete=models.SET_NULL, null=True, blank=True, related_name="gym_bookings"
    )
    guest = models.ForeignKey(
        Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name="gym_bookings"
    )
    status = models.CharField(max_length=16, choices=BillingStatus.choices, default=BillingStatus.OPEN)
    receipt_number = models.CharField(max_length=32, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "gym_bookings"
        constraints = [
            models.UniqueConstraint(
                fields=["company", "receipt_number"],
                name="unique_company_gym_booking_receipt_number",
                condition=~models.Q(receipt_number=""),
            )
        ]
        ordering = ["-created_at"]

    @property
    def total_cents(self):
        return sum(line.quantity * line.unit_price_cents for line in self.lines.all())

    def __str__(self):
        return f"Gym booking #{self.pk} ({self.status})"


class GymBookingLine(TenantModel):
    class ActivityStatus(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    booking = models.ForeignKey(GymBooking, on_delete=models.CASCADE, related_name="lines")
    activity = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    trainer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    scheduled_at = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.PositiveIntegerField(default=60)
    quantity = models.PositiveIntegerField(default=1)
    unit_price_cents = models.BigIntegerField()
    status = models.CharField(max_length=16, choices=ActivityStatus.choices, default=ActivityStatus.SCHEDULED)

    class Meta:
        db_table = "gym_booking_lines"
        ordering = ["scheduled_at", "created_at"]

    @property
    def line_total_cents(self):
        return self.quantity * self.unit_price_cents

    def __str__(self):
        return f"{self.activity} ({self.status})"
