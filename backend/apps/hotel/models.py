from django.conf import settings
from django.db import models

from apps.branches.models import Branch
from apps.common.models import TenantModel
from apps.crm.models import Customer, TravelAgency


class Building(TenantModel):
    name = models.CharField(max_length=100)
    branch = models.ForeignKey(
        Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name="buildings"
    )

    class Meta:
        db_table = "hotel_buildings"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_building_name")
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class Floor(TenantModel):
    building = models.ForeignKey(Building, on_delete=models.CASCADE, related_name="floors")
    name = models.CharField(max_length=50)
    # Sort/display order — not physical altitude, so e.g. a basement can
    # be -1 and still sort before Ground Floor at 0.
    level = models.IntegerField(default=0)

    class Meta:
        db_table = "hotel_floors"
        constraints = [
            models.UniqueConstraint(fields=["building", "name"], name="unique_building_floor_name")
        ]
        ordering = ["building_id", "level"]

    def __str__(self):
        return f"{self.building} — {self.name}"


class RoomType(TenantModel):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    base_rate_cents = models.BigIntegerField()
    max_occupancy = models.PositiveIntegerField(default=2)
    # Free-text list for v1 (e.g. one per line) — a dedicated Amenity
    # model is future work if/when amenities need their own icons,
    # filtering, or per-amenity pricing; not needed to book a room yet.
    amenities = models.TextField(blank=True)

    class Meta:
        db_table = "hotel_room_types"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_room_type_name")
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class SeasonalRate(TenantModel):
    """A calendar override for RoomType.base_rate_cents — "Christmas
    peak", "low season", etc. Deliberately no overlap validation: unlike
    a room booking, two seasonal rates covering the same night for the
    same room type aren't a real conflict, just an ambiguous rate card a
    revenue manager should tidy up themselves. apps.hotel.pricing picks
    the one with the latest start_date when more than one matches, so
    the result is always deterministic even if the calendar is untidy."""

    room_type = models.ForeignKey(RoomType, on_delete=models.CASCADE, related_name="seasonal_rates")
    name = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    rate_cents = models.BigIntegerField()

    class Meta:
        db_table = "hotel_seasonal_rates"
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.name} ({self.room_type})"


class Room(TenantModel):
    class Status(models.TextChoices):
        AVAILABLE = "available", "Available"
        OCCUPIED = "occupied", "Occupied"
        DIRTY = "dirty", "Dirty"
        CLEAN = "clean", "Clean"
        INSPECTED = "inspected", "Inspected"
        OUT_OF_ORDER = "out_of_order", "Out of order"
        MAINTENANCE = "maintenance", "Maintenance"

    # PROTECT, not SET_NULL: a room always belongs to exactly one floor
    # and has exactly one type — reassign it explicitly rather than
    # silently orphaning it by deleting the floor/type out from under it.
    floor = models.ForeignKey(Floor, on_delete=models.PROTECT, related_name="rooms")
    room_type = models.ForeignKey(RoomType, on_delete=models.PROTECT, related_name="rooms")
    number = models.CharField(max_length=20)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.AVAILABLE)

    class Meta:
        db_table = "hotel_rooms"
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_company_room_number")
        ]
        ordering = ["number"]

    def __str__(self):
        return f"Room {self.number}"


class RoomStatusLog(TenantModel):
    """Audit trail for Room.status changes — same principle as
    apps.inventory.StockMovement: the live field (Room.status) is mutated
    directly for simplicity, but every change is expected to also write
    one of these, so there's always a record of who changed what and
    when. created_at (from TenantModel) is the log's timestamp."""

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="status_logs")
    status = models.CharField(max_length=16, choices=Room.Status.choices)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "hotel_room_status_logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.room} -> {self.status}"


class RoomBlock(TenantModel):
    """A room held out of the bookable pool for a future date range —
    renovation, a VIP hold, a long maintenance job — distinct from
    Room.status (which is *live* state, not a schedule). Deliberately no
    overlap validation against other blocks or reservations, same
    reasoning as SeasonalRate's own docstring: a revenue/ops manager
    reconciling an untidy calendar is a acceptable v1 tradeoff over the
    complexity of enforcing it here.
    """

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="blocks")
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "hotel_room_blocks"
        constraints = [
            models.CheckConstraint(
                check=models.Q(end_date__gte=models.F("start_date")),
                name="room_block_end_after_start",
            )
        ]
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.room} blocked {self.start_date} → {self.end_date}"


class GroupReservation(TenantModel):
    """A booking made under one name for multiple rooms at once — a
    wedding party, a tour group, a corporate block — not a separate
    booking flow, just a label tying several ordinary `Reservation` rows
    together (`Reservation.group`) plus the bulk check-in/check-out
    convenience that's the actual point of grouping them (see
    GroupReservationViewSet). Each member reservation still gets its own
    real confirmation number, folio, and status — a group has no status
    of its own, it's derived from its members, same "derive, don't
    duplicate" principle as GuestFolio.balance_cents.
    """

    name = models.CharField(max_length=150)
    organizer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="organized_groups")
    check_in_date = models.DateField()
    check_out_date = models.DateField()
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "hotel_group_reservations"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class Reservation(TenantModel):
    class Source(models.TextChoices):
        WEBSITE = "website", "Website"
        WALK_IN = "walk_in", "Walk-in"
        PHONE = "phone", "Phone"
        TRAVEL_AGENCY = "travel_agency", "Travel Agency"
        GROUP = "group", "Group Booking"

    class Status(models.TextChoices):
        CONFIRMED = "confirmed", "Confirmed"
        CHECKED_IN = "checked_in", "Checked in"
        CHECKED_OUT = "checked_out", "Checked out"
        CANCELLED = "cancelled", "Cancelled"
        NO_SHOW = "no_show", "No-show"

    # Guest = a CRM Customer, not a separate model — extends the existing
    # Business Core rather than duplicating it (docs/ARCHITECTURE.md §12.1).
    guest = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="reservations")
    room_type = models.ForeignKey(RoomType, on_delete=models.PROTECT, related_name="reservations")
    # Null until a specific room is assigned — booking a room *type* and
    # assigning the actual room happen at different points in the
    # reservation lifecycle (docs/ARCHITECTURE.md §12.3).
    room = models.ForeignKey(
        Room, on_delete=models.SET_NULL, null=True, blank=True, related_name="reservations"
    )
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.WALK_IN)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.CONFIRMED)
    check_in_date = models.DateField()
    check_out_date = models.DateField()
    adults = models.PositiveIntegerField(default=1)
    children = models.PositiveIntegerField(default=0)
    # Nightly rate agreed at booking time, snapshotted from room_type's
    # base_rate_cents — later rate changes on the room type never
    # retroactively change an already-confirmed reservation (same
    # locking principle as apps.sales.Invoice.amount_cents).
    rate_cents = models.BigIntegerField()
    # Populated via apps.common.numbering.next_number (see the API layer)
    # once there's a real create endpoint — blank at the model level like
    # Invoice.invoice_number, not derived here.
    confirmation_number = models.CharField(max_length=32, blank=True)
    # Set together — see ReservationSerializer.validate — only meaningful
    # when source=TRAVEL_AGENCY. commission_cents is computed once, at
    # check-out (see ReservationViewSet.check_out), from the folio's
    # final balance and the agency's rate at that moment — a later rate
    # change never retroactively rewrites an already-closed stay's
    # commission, same locking principle rate_cents itself follows.
    travel_agency = models.ForeignKey(
        TravelAgency, on_delete=models.SET_NULL, null=True, blank=True, related_name="reservations"
    )
    commission_cents = models.BigIntegerField(default=0)
    # Only meaningful when source=GROUP — set by
    # GroupReservationSerializer.create(), not client-writable on a plain
    # reservation create (see ReservationSerializer).
    group = models.ForeignKey(
        GroupReservation, on_delete=models.SET_NULL, null=True, blank=True, related_name="reservations"
    )
    # Set only through ReservationViewSet.approve_late_checkout /
    # approve_early_checkin (see there for the optional fee side effect)
    # — plain flags, not a request/approval workflow, since front desk
    # staff grant these directly rather than a guest submitting a ticket.
    late_checkout_approved = models.BooleanField(default=False)
    early_checkin_approved = models.BooleanField(default=False)

    class Meta:
        db_table = "hotel_reservations"
        constraints = [
            models.UniqueConstraint(
                fields=["company", "confirmation_number"],
                name="unique_company_reservation_confirmation_number",
            ),
            models.CheckConstraint(
                check=models.Q(check_out_date__gt=models.F("check_in_date")),
                name="reservation_checkout_after_checkin",
            ),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return self.confirmation_number or f"Reservation #{self.pk}"


class RoomTransfer(TenantModel):
    """Audit trail for a checked-in guest moving rooms mid-stay — same
    "log every change, mutate the live field directly" principle
    RoomStatusLog already documents. `from_room` is PROTECT'd since it's
    history, not a live pointer, the same as Reservation locking its
    rate at booking time — a room being decommissioned later shouldn't
    silently break an old transfer record.
    """

    reservation = models.ForeignKey(Reservation, on_delete=models.CASCADE, related_name="room_transfers")
    from_room = models.ForeignKey(Room, on_delete=models.PROTECT, related_name="+")
    to_room = models.ForeignKey(Room, on_delete=models.PROTECT, related_name="+")
    reason = models.CharField(max_length=255, blank=True)
    transferred_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "hotel_room_transfers"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.reservation} — {self.from_room} to {self.to_room}"


class GuestFolio(TenantModel):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        CLOSED = "closed", "Closed"

    reservation = models.OneToOneField(Reservation, on_delete=models.CASCADE, related_name="folio")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)

    class Meta:
        db_table = "hotel_guest_folios"
        ordering = ["-created_at"]

    @property
    def balance_cents(self):
        total_charges = sum(charge.amount_cents for charge in self.charges.all())
        total_payments = sum(payment.amount_cents for payment in self.payments.all())
        total_refunds = sum(refund.amount_cents for refund in self.refunds.all())
        return total_charges - total_payments + total_refunds

    def __str__(self):
        return f"Folio for {self.reservation}"


class FolioCharge(TenantModel):
    class SourceModule(models.TextChoices):
        ROOM = "room", "Room"
        RESTAURANT = "restaurant", "Restaurant"
        BAR = "bar", "Bar"
        SPA = "spa", "Spa"
        LAUNDRY = "laundry", "Laundry"
        GYM = "gym", "Gym"
        CONFERENCE = "conference", "Conference"
        MISC = "misc", "Miscellaneous"

    folio = models.ForeignKey(GuestFolio, on_delete=models.CASCADE, related_name="charges")
    source_module = models.CharField(max_length=16, choices=SourceModule.choices)
    description = models.CharField(max_length=255)
    amount_cents = models.BigIntegerField()
    # Reporting breakdown only, computed at creation from the company's
    # configured apps.tax.TaxRate rows (VAT on everything, the Tourism
    # Development Levy on ROOM charges specifically) — the portion of
    # `amount_cents` that is tax, extracted from what's already a
    # guest-facing, tax-inclusive total. Never added on top: balance_cents
    # and the loyalty engine both keep reading amount_cents unchanged.
    tax_amount_cents = models.BigIntegerField(default=0)

    class Meta:
        db_table = "hotel_folio_charges"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.source_module}: {self.description} ({self.amount_cents})"


class GuestPayment(TenantModel):
    """Money received against a folio — cash at the desk, a card swipe, a
    mobile-money transfer, a bank transfer. Append-only, same reasoning as
    FolioCharge: correcting an over-recorded payment means a GuestRefund,
    not editing history. GuestFolio.balance_cents nets this against
    charges (and refunds) — see there.
    """

    class Method(models.TextChoices):
        CASH = "cash", "Cash"
        CARD = "card", "Card"
        MOBILE_MONEY = "mobile_money", "Mobile Money"
        BANK_TRANSFER = "bank_transfer", "Bank Transfer"

    folio = models.ForeignKey(GuestFolio, on_delete=models.CASCADE, related_name="payments")
    method = models.CharField(max_length=16, choices=Method.choices)
    amount_cents = models.BigIntegerField()
    reference = models.CharField(max_length=255, blank=True)
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "hotel_guest_payments"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.method}: {self.amount_cents} for {self.folio}"


class GuestRefund(TenantModel):
    """Money returned to a guest — against a specific GuestPayment when
    one is named (the common case: refunding an overpayment or a
    card swipe), or standalone against the folio itself (e.g. waiving a
    disputed charge already paid). Append-only, same reasoning as
    GuestPayment.
    """

    folio = models.ForeignKey(GuestFolio, on_delete=models.CASCADE, related_name="refunds")
    payment = models.ForeignKey(
        GuestPayment, on_delete=models.SET_NULL, null=True, blank=True, related_name="refunds"
    )
    amount_cents = models.BigIntegerField()
    reason = models.CharField(max_length=255, blank=True)
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "hotel_guest_refunds"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Refund {self.amount_cents} for {self.folio}"
