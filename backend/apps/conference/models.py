from django.db import models

from apps.catalog.models import Item
from apps.common.models import TenantModel
from apps.crm.models import Customer
from apps.hotel.models import Reservation


class ConferenceHall(TenantModel):
    """The bookable venue (docs: covers both "Conference Hall" and
    "Wedding Hall" — one physical space, `ConferenceBooking.event_type`
    is what distinguishes a corporate booking from a wedding, not a
    separate hall type)."""

    name = models.CharField(max_length=100)
    capacity = models.PositiveIntegerField()
    day_rate_cents = models.BigIntegerField(default=0)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "conference_halls"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_conference_hall_name")
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class ConferenceBooking(TenantModel):
    """One hall booking for a date/time range — billing container, same
    open/paid/charged_to_room/cancelled `status` as Order/LaundryOrder/
    SpaBooking/GymBooking. Catering + equipment are `ConferenceBookingLine`
    add-ons (reusing apps.catalog.Item, same as every other module's menu/
    treatment/activity)."""

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        PAID = "paid", "Paid"
        CHARGED_TO_ROOM = "charged_to_room", "Charged to room"
        CANCELLED = "cancelled", "Cancelled"

    class EventType(models.TextChoices):
        CORPORATE = "corporate", "Corporate"
        WEDDING = "wedding", "Wedding"
        OTHER = "other", "Other"

    class SeatingPlan(models.TextChoices):
        THEATER = "theater", "Theater"
        CLASSROOM = "classroom", "Classroom"
        BANQUET = "banquet", "Banquet"
        U_SHAPE = "u_shape", "U-shape"
        BOARDROOM = "boardroom", "Boardroom"

    hall = models.ForeignKey(ConferenceHall, on_delete=models.PROTECT, related_name="bookings")
    reservation = models.ForeignKey(
        Reservation, on_delete=models.SET_NULL, null=True, blank=True, related_name="conference_bookings"
    )
    guest = models.ForeignKey(
        Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name="conference_bookings"
    )
    event_name = models.CharField(max_length=200)
    event_type = models.CharField(max_length=16, choices=EventType.choices, default=EventType.CORPORATE)
    seating_plan = models.CharField(max_length=16, choices=SeatingPlan.choices, default=SeatingPlan.THEATER)
    attendees = models.PositiveIntegerField(default=1)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    receipt_number = models.CharField(max_length=32, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "conference_bookings"
        constraints = [
            models.CheckConstraint(condition=models.Q(end_at__gt=models.F("start_at")), name="conference_end_after_start"),
            models.UniqueConstraint(
                fields=["company", "receipt_number"],
                name="unique_company_conference_receipt_number",
                condition=~models.Q(receipt_number=""),
            ),
        ]
        ordering = ["-start_at"]

    @property
    def hall_rate_cents(self):
        return self.hall.day_rate_cents

    @property
    def total_cents(self):
        return self.hall_rate_cents + sum(line.quantity * line.unit_price_cents for line in self.lines.all())

    def __str__(self):
        return f"{self.event_name} ({self.hall}, {self.status})"


class ConferenceBookingLine(TenantModel):
    """Catering / equipment add-on — reuses apps.catalog.Item, same
    "extend don't duplicate" principle as every other module's line items."""

    booking = models.ForeignKey(ConferenceBooking, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    quantity = models.PositiveIntegerField(default=1)
    unit_price_cents = models.BigIntegerField()

    class Meta:
        db_table = "conference_booking_lines"
        ordering = ["created_at"]

    @property
    def line_total_cents(self):
        return self.quantity * self.unit_price_cents

    def __str__(self):
        return f"{self.quantity} x {self.item}"
