from django.conf import settings
from django.db import models

from apps.catalog.models import Item
from apps.common.models import TenantModel
from apps.crm.models import Customer
from apps.hotel.models import Reservation


class Table(TenantModel):
    """Restaurant and Bar POS are one module (docs/ARCHITECTURE.md §12.2),
    not two — `area` is what distinguishes them, same as `FolioCharge`
    already distinguishes a `restaurant` charge from a `bar` one."""

    class Area(models.TextChoices):
        RESTAURANT = "restaurant", "Restaurant"
        BAR = "bar", "Bar"
        OUTDOOR = "outdoor", "Outdoor"

    class Status(models.TextChoices):
        AVAILABLE = "available", "Available"
        OCCUPIED = "occupied", "Occupied"
        RESERVED = "reserved", "Reserved"

    name = models.CharField(max_length=50)
    area = models.CharField(max_length=16, choices=Area.choices, default=Area.RESTAURANT)
    capacity = models.PositiveIntegerField(default=2)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.AVAILABLE)

    class Meta:
        db_table = "pos_tables"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_table_name")
        ]
        ordering = ["area", "name"]

    def __str__(self):
        return f"{self.get_area_display()} — {self.name}"


class Order(TenantModel):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        PAID = "paid", "Paid"
        CHARGED_TO_ROOM = "charged_to_room", "Charged to room"
        CANCELLED = "cancelled", "Cancelled"

    # Null table = takeaway or room service ordered without sitting down.
    table = models.ForeignKey(
        Table, on_delete=models.SET_NULL, null=True, blank=True, related_name="orders"
    )
    # Set to charge this order to a guest's room folio — see
    # OrderSerializer.charge_to_room. Independent of `table`: room
    # service has no table but still needs this.
    reservation = models.ForeignKey(
        Reservation, on_delete=models.SET_NULL, null=True, blank=True, related_name="pos_orders"
    )
    guest = models.ForeignKey(
        Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name="pos_orders"
    )
    # A bar tab needs a name on the till even when the patron isn't a
    # registered CRM Customer — most walk-up bar patrons aren't. Distinct
    # from `guest`: this is just free-text ("Sarah", "Blue jacket guy"),
    # not a lookup into anything, and never required.
    tab_name = models.CharField(max_length=100, blank=True)
    server = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    discount_cents = models.BigIntegerField(default=0)
    # Set only by OrderViewSet.split — when a table's bill needs to be
    # split into separate checks, the moved lines land on a brand-new
    # Order rather than a "sub-bill" bolted onto the existing one, so
    # every order still closes (pay/charge_to_room/cancel) exactly the
    # same single way regardless of whether it was ever split. This FK
    # is just the "which check did this come from" trail.
    split_from = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="split_children"
    )
    # Set only by OrderViewSet.apply_promotion — a manually-applied,
    # order-level discount (a promo code, a manager comp), distinct from
    # Happy Hour's automatic per-line pricing at add-time. discount_cents
    # itself was already a plain client-writable field before this; the
    # FK just makes an applied promotion traceable instead of an
    # unexplained number on the receipt.
    promotion = models.ForeignKey(
        "Promotion", on_delete=models.SET_NULL, null=True, blank=True, related_name="orders"
    )
    # Populated via apps.common.numbering.next_number once the order is
    # closed (paid or charged to room) — same "blank until issued" pattern
    # as Invoice.invoice_number/Reservation.confirmation_number. Not a
    # fiscalized IRN (see docs/ARCHITECTURE.md §12.7 — confirmed a real
    # legal requirement under Directive 1142/2026, not yet built since it
    # needs real Ministry of Revenues registration to integrate against)
    # — just a sequential internal reference for now.
    receipt_number = models.CharField(max_length=32, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "pos_orders"
        constraints = [
            models.UniqueConstraint(
                fields=["company", "receipt_number"],
                name="unique_company_pos_receipt_number",
                condition=~models.Q(receipt_number=""),
            )
        ]
        ordering = ["-created_at"]

    @property
    def subtotal_cents(self):
        return sum(line.quantity * line.unit_price_cents for line in self.lines.all())

    @property
    def total_cents(self):
        return max(self.subtotal_cents - self.discount_cents, 0)

    def __str__(self):
        return f"Order #{self.pk} ({self.status})"


class OrderLine(TenantModel):
    class KitchenStatus(models.TextChoices):
        QUEUED = "queued", "Queued"
        PREPARING = "preparing", "Preparing"
        READY = "ready", "Ready"
        SERVED = "served", "Served"

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    quantity = models.PositiveIntegerField()
    # Snapshotted from item.price_cents at order time, same reasoning as
    # every other line-item model in this codebase (QuotationLine,
    # SalesOrderLine, ...) — a later menu price change never retroactively
    # changes an order already rung in.
    unit_price_cents = models.BigIntegerField()
    kitchen_status = models.CharField(
        max_length=16, choices=KitchenStatus.choices, default=KitchenStatus.QUEUED
    )
    # Manually flagged via OrderLineViewSet.mark_rush/unmark_rush — a
    # kitchen-facing priority signal independent of kitchen_status. The
    # Kitchen Display sorts rush lines (then VIP-guest orders, derived
    # from Order.guest.type, see OrderSerializer.is_vip_guest) ahead of
    # plain FIFO within each column; nothing here reorders the queue
    # automatically based on wait time — that's estimated-time scope
    # (see the Preparation Time backlog item), not priority.
    is_rush = models.BooleanField(default=False)
    # Set automatically by OrderLineViewSet._transition when the line
    # actually moves into that stage — created_at already covers "queued
    # since", so these two are the only stage-start timestamps genuinely
    # missing. Together they let the Kitchen Display show real elapsed
    # time per stage instead of just a single age-since-created number,
    # and compare it against Item.prep_time_minutes.
    started_preparing_at = models.DateTimeField(null=True, blank=True)
    ready_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "pos_order_lines"
        ordering = ["created_at"]

    @property
    def line_total_cents(self):
        return self.quantity * self.unit_price_cents

    def __str__(self):
        return f"{self.quantity} x {self.item} ({self.kitchen_status})"


class HappyHourRule(TenantModel):
    """A recurring per-item-category discount window — "20% off drinks,
    5-7pm" — not a ticket or a discount applied to anything by itself.
    apps.pos.pricing.compute_happy_hour_price_cents checks the active
    rules and returns a discounted price a bartender can use when adding
    a line; nothing here changes a price automatically the way a
    database trigger would — see that function's own docstring for why.
    """

    name = models.CharField(max_length=100)
    # Blank category = applies to every item, same "blank means
    # unrestricted" convention Item.category itself already uses.
    category = models.CharField(max_length=100, blank=True)
    # Null day_of_week = every day. 0=Monday..6=Sunday, matching Python's
    # own date.weekday() so the pricing check needs no translation table.
    day_of_week = models.PositiveSmallIntegerField(null=True, blank=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "pos_happy_hour_rules"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Promotion(TenantModel):
    """A manually-applied, order-level discount — a promo code, a
    manager comp, a "Weekend Special" — as opposed to Happy Hour's
    automatic per-line pricing. Applying one (OrderViewSet.apply_promotion)
    computes discount_cents from the order's current subtotal and sets
    Order.promotion for traceability; it doesn't touch individual lines
    or their prices."""

    name = models.CharField(max_length=100)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "pos_promotions"
        ordering = ["-start_date"]

    def __str__(self):
        return self.name
