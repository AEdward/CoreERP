from django.conf import settings
from django.db import models

from apps.common.models import TenantModel
from apps.crm.models import Customer

# Section K: Real Estate — designed fresh, no MiranErp/Odoo source ported
# wholesale (neither project has a real-estate reference). See chat: OVID
# Real Estate's actual module list flagged Payment Plans, Collection
# Committee, Loan Management, Construction, and Portfolio Management as
# the standout real needs beyond "leases, units". Payment Plans (as
# PaymentInstallment below) and a thin Construction signal
# (PropertyProject.status) are built; Collection Committee (an approval
# workflow for handling overdue collections) and full Loan/Mortgage
# Management are deliberately deferred — same "no template/automation
# layer without a concrete second requirement" restraint apps.fleet and
# apps.manufacturing both applied, not an oversight.
#
# "Tenants" and "Real Estate CRM" aren't separate models: a tenant/buyer
# is just an apps.crm.Customer (same reuse Section J's Hotel made of
# Customer for guests), and the CRM pipeline (Contact/Lead/Opportunity)
# already covers lead tracking for a property sale — nothing
# real-estate-specific needed there. "Property Documents" is covered by
# registering these models in apps.common.targeting.ALLOWED_TARGETS
# rather than a new Document-like model.


class PropertyProject(TenantModel):
    """A development — "Sunset Towers" — one or more Buildings are
    raised under. Optional: a Building can also stand alone with no
    project (a single existing building a company manages, not
    something it's developing)."""

    class Status(models.TextChoices):
        PLANNING = "planning", "Planning"
        UNDER_CONSTRUCTION = "under_construction", "Under construction"
        COMPLETED = "completed", "Completed"
        ON_HOLD = "on_hold", "On hold"

    name = models.CharField(max_length=255)
    description = models.CharField(max_length=255, blank=True)
    location = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNING)
    start_date = models.DateField(null=True, blank=True)
    expected_completion_date = models.DateField(null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "realestate_projects"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_property_project_name")
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class Building(TenantModel):
    project = models.ForeignKey(
        PropertyProject, on_delete=models.PROTECT, null=True, blank=True, related_name="buildings"
    )
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=255, blank=True)
    floors_count = models.PositiveIntegerField(default=1)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "realestate_buildings"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_realestate_building_name")
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class UnitType(TenantModel):
    """A reusable spec — "2BR Standard" — Units reference for their
    bedroom/bathroom count and default pricing, the same normalization
    Item gives Products (one spec, many physical instances)."""

    name = models.CharField(max_length=100)
    bedrooms = models.PositiveIntegerField(default=0)
    bathrooms = models.PositiveIntegerField(default=0)
    area_sqm = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    base_sale_price_cents = models.BigIntegerField(default=0)
    base_rent_cents_monthly = models.BigIntegerField(default=0)

    class Meta:
        db_table = "realestate_unit_types"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_unit_type_name")
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class Unit(TenantModel):
    class Status(models.TextChoices):
        AVAILABLE = "available", "Available"
        RESERVED = "reserved", "Reserved"
        SOLD = "sold", "Sold"
        RENTED = "rented", "Rented"
        MAINTENANCE = "maintenance", "Under maintenance"

    building = models.ForeignKey(Building, on_delete=models.PROTECT, related_name="units")
    unit_type = models.ForeignKey(UnitType, on_delete=models.PROTECT, null=True, blank=True, related_name="units")
    unit_number = models.CharField(max_length=50)
    floor = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.AVAILABLE)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "realestate_units"
        constraints = [
            models.UniqueConstraint(fields=["building", "unit_number"], name="unique_building_unit_number")
        ]
        ordering = ["building_id", "unit_number"]

    def __str__(self):
        return f"{self.building} — {self.unit_number}"


class PropertyListing(TenantModel):
    class ListingType(models.TextChoices):
        SALE = "sale", "For sale"
        RENT = "rent", "For rent"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        WITHDRAWN = "withdrawn", "Withdrawn"
        CLOSED = "closed", "Closed"

    unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name="listings")
    listing_type = models.CharField(max_length=8, choices=ListingType.choices)
    price_cents = models.BigIntegerField()
    listed_date = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "realestate_listings"
        ordering = ["-listed_date"]

    def __str__(self):
        return f"{self.unit} — {self.get_listing_type_display()}"


class SalesAgent(TenantModel):
    """A commission-earning agent — may or may not be an internal HR
    Employee (external/brokerage agents are common in real estate), so
    `employee` is an optional link rather than a required one."""

    employee = models.ForeignKey(
        "hr.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    commission_rate_percent = models.DecimalField(max_digits=5, decimal_places=2, default=3)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "realestate_sales_agents"
        ordering = ["name"]

    def __str__(self):
        return self.name


class PropertySale(TenantModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    number = models.CharField(max_length=20)
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name="sales")
    buyer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="+")
    agent = models.ForeignKey(SalesAgent, on_delete=models.SET_NULL, null=True, blank=True, related_name="sales")
    sale_price_cents = models.BigIntegerField()
    down_payment_cents = models.BigIntegerField(default=0)
    sale_date = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "realestate_sales"
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_company_property_sale_number")
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return self.number


class PaymentInstallment(TenantModel):
    """One scheduled payment of a PropertySale's payment plan — the
    "Installment Management" checklist item. Generated in a batch by
    PropertySaleViewSet.generate_installments (equal monthly amounts
    over the remaining balance after down_payment_cents), then tracked
    individually as each one is paid."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        OVERDUE = "overdue", "Overdue"

    sale = models.ForeignKey(PropertySale, on_delete=models.CASCADE, related_name="installments")
    installment_number = models.PositiveIntegerField()
    due_date = models.DateField()
    amount_cents = models.BigIntegerField()
    paid_amount_cents = models.BigIntegerField(default=0)
    paid_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)

    class Meta:
        db_table = "realestate_payment_installments"
        constraints = [
            models.UniqueConstraint(fields=["sale", "installment_number"], name="unique_sale_installment_number")
        ]
        ordering = ["sale_id", "installment_number"]

    def __str__(self):
        return f"{self.sale} — #{self.installment_number}"


class AgentCommission(TenantModel):
    """Computed once when a PropertySale is marked completed (see
    PropertySaleViewSet.complete) from the agent's commission_rate_percent
    at that moment — snapshotted onto rate_percent/amount_cents rather
    than recomputed later, the same locking principle
    apps.hotel.Reservation.commission_cents uses for TravelAgency
    referrals."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"

    sale = models.ForeignKey(PropertySale, on_delete=models.CASCADE, related_name="commissions")
    agent = models.ForeignKey(SalesAgent, on_delete=models.PROTECT, related_name="commissions")
    rate_percent = models.DecimalField(max_digits=5, decimal_places=2)
    amount_cents = models.BigIntegerField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    paid_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "realestate_agent_commissions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.agent} — {self.sale}"


class LeaseContract(TenantModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        TERMINATED = "terminated", "Terminated"
        EXPIRED = "expired", "Expired"

    number = models.CharField(max_length=20)
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name="leases")
    tenant = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="+")
    start_date = models.DateField()
    end_date = models.DateField()
    monthly_rent_cents = models.BigIntegerField()
    deposit_cents = models.BigIntegerField(default=0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "realestate_lease_contracts"
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_company_lease_number")
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return self.number


class RentPayment(TenantModel):
    """One period's rent against a LeaseContract — "Rent Collection".
    Generated the same way PaymentInstallment is: in a batch covering
    the lease's date range (see LeaseContractViewSet.generate_rent_schedule),
    then tracked individually as each period is collected."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PAID = "paid", "Paid"
        OVERDUE = "overdue", "Overdue"

    lease = models.ForeignKey(LeaseContract, on_delete=models.CASCADE, related_name="rent_payments")
    period_start = models.DateField()
    period_end = models.DateField()
    due_date = models.DateField()
    amount_cents = models.BigIntegerField()
    paid_amount_cents = models.BigIntegerField(default=0)
    paid_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)

    class Meta:
        db_table = "realestate_rent_payments"
        ordering = ["lease_id", "period_start"]

    def __str__(self):
        return f"{self.lease} — {self.period_start}"


class PropertyMaintenanceRequest(TenantModel):
    """A repair ticket against a Unit. Deliberately its own model, not a
    retrofit of apps.maintenance's WorkOrder — that model is hard-wired
    to a hotel Room (see its own docstring on why generalizing it is out
    of scope), the same reasoning apps.manufacturing.MachineMaintenanceLog
    already applied to the same underlying constraint."""

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

    unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name="maintenance_requests")
    title = models.CharField(max_length=255)
    description = models.CharField(max_length=255, blank=True)
    priority = models.CharField(max_length=16, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "realestate_maintenance_requests"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} — {self.unit}"


class PropertyExpense(TenantModel):
    """An operational cost against a Building — utilities, security,
    landscaping, repairs not tied to one ticket. `unit` is an optional
    narrowing for a cost specific to one unit rather than the whole
    building."""

    building = models.ForeignKey(Building, on_delete=models.PROTECT, related_name="expenses")
    unit = models.ForeignKey(Unit, on_delete=models.SET_NULL, null=True, blank=True, related_name="expenses")
    category = models.CharField(max_length=100)
    description = models.CharField(max_length=255, blank=True)
    amount_cents = models.BigIntegerField()
    expense_date = models.DateField()

    class Meta:
        db_table = "realestate_property_expenses"
        ordering = ["-expense_date", "-created_at"]

    def __str__(self):
        return f"{self.building} — {self.category} ({self.amount_cents / 100:.2f})"
