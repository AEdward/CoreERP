from django.db import models
from django.utils import timezone

from apps.catalog.models import Item
from apps.common.models import TenantModel
from apps.crm.models import Customer
from apps.hr.models import Employee
from apps.inventory.models import StockMovement, Warehouse
from apps.suppliers.models import Supplier

# Section N: Construction — designed fresh, no MiranErp/Odoo source
# ported (neither project has a construction reference). Deliberately a
# thin real vertical slice, not a full project-management/ERP-for-
# builders system: no CPM/Gantt critical-path scheduling, no drawing/
# BIM management, no payment-certificate/retention-release workflow
# beyond a flat retention percent — those are genuine specialist
# subsystems this project has no business half-building. What's here is
# real and wired end to end: a project's Bill of Quantities feeds a real
# budget, materials issued against it actually decrement
# apps.inventory stock, and a Change Order actually adjusts the
# project's budget rather than just being a note.
#
# ConstructionProject reuses apps.crm.Customer for the client — the
# same "reuse the core Customer concept" pattern Section J's Hotel
# guest, Section K's tenant/buyer, and Section L's retail customer all
# used (Section M's Patient was this series' one deliberate exception,
# for a real PHI reason that doesn't apply here). "Site Management"
# isn't a separate model — it's just `ConstructionProject.site_manager`
# and `site_address` fields, the same "a field, not a model" shape
# Section L's "Multi-store Management" used for `Register.branch`.
# "BOQ" and "Cost Estimation" are the same checklist item under two
# names in construction practice — one `BOQItem` model, not two.
# "Contracts" and "Subcontractors" fold into one `Contract` model via
# `contract_type`, the same way `Appointment.visit_type` folded four
# Section M checklist items into one field. "Construction Procurement"
# is deliberately left unbuilt — see docs/MODULE_MAP.md Section N's own
# note on why bolting a project tag onto the shared apps.procurement.
# PurchaseOrder wasn't a clean call for one vertical's benefit.


class ConstructionProject(TenantModel):
    class Status(models.TextChoices):
        PLANNING = "planning", "Planning"
        IN_PROGRESS = "in_progress", "In progress"
        ON_HOLD = "on_hold", "On hold"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    number = models.CharField(max_length=20)
    name = models.CharField(max_length=255)
    client = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    site_address = models.CharField(max_length=255, blank=True)
    site_manager = models.ForeignKey(
        Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    budget_cents = models.BigIntegerField(default=0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PLANNING)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "construction_projects"
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_company_construction_project_number")
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.number} — {self.name}"


class BOQItem(TenantModel):
    """Bill of Quantities line — also *is* the project's cost
    estimation, not a separate model (see this module's own
    docstring)."""

    project = models.ForeignKey(ConstructionProject, on_delete=models.CASCADE, related_name="boq_items")
    category = models.CharField(max_length=100, blank=True)
    description = models.CharField(max_length=255)
    unit = models.CharField(max_length=32, blank=True)
    quantity = models.DecimalField(max_digits=12, decimal_places=2, default=1)
    unit_cost_cents = models.BigIntegerField(default=0)

    class Meta:
        db_table = "construction_boq_items"
        ordering = ["category", "description"]

    @property
    def estimated_cost_cents(self):
        return int(self.quantity * self.unit_cost_cents)

    def __str__(self):
        return f"{self.description} ({self.project})"


class Contract(TenantModel):
    """Folds "Contracts" (the main agreement with the client) and
    "Subcontractors" (a scope of work handed to a supplier) into one
    model via `contract_type` — see this module's own docstring.
    `customer` is set for MAIN, `supplier` for SUBCONTRACT, never
    both."""

    class Type(models.TextChoices):
        MAIN = "main", "Main contract"
        SUBCONTRACT = "subcontract", "Subcontract"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"
        TERMINATED = "terminated", "Terminated"

    number = models.CharField(max_length=20)
    project = models.ForeignKey(ConstructionProject, on_delete=models.CASCADE, related_name="contracts")
    contract_type = models.CharField(max_length=16, choices=Type.choices, default=Type.MAIN)
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    scope_of_work = models.CharField(max_length=255, blank=True)
    contract_value_cents = models.BigIntegerField(default=0)
    retention_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)

    class Meta:
        db_table = "construction_contracts"
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_company_contract_number")
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return self.number


class SiteLog(TenantModel):
    """Daily "Work Progress" entry. `site_manager`/other roster info
    lives on the project itself ("Site Management" — see this module's
    own docstring), so this is purely the day-to-day progress record."""

    project = models.ForeignKey(ConstructionProject, on_delete=models.CASCADE, related_name="site_logs")
    log_date = models.DateField()
    percent_complete = models.PositiveIntegerField(default=0)
    work_summary = models.TextField(blank=True)
    weather = models.CharField(max_length=100, blank=True)
    logged_by = models.ForeignKey(
        Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "construction_site_logs"
        ordering = ["-log_date", "-created_at"]

    def __str__(self):
        return f"{self.project} — {self.log_date}"


class MaterialIssue(TenantModel):
    """"Materials" — issuing material to a project. `movement` is a
    real OUT apps.inventory.StockMovement created immediately at
    creation time (see MaterialIssueSerializer.create), the same "only
    exists once the real event happened, never deferred" shape
    apps.manufacturing.MaterialConsumption follows for the identical
    reason. `unit_cost_cents` snapshots Item.cost_cents at issue time,
    same reasoning MaterialConsumption gives: a later price change
    shouldn't rewrite the cost of material already issued when the
    project costing report sums it up."""

    project = models.ForeignKey(ConstructionProject, on_delete=models.CASCADE, related_name="material_issues")
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="+")
    quantity = models.PositiveIntegerField()
    unit_cost_cents = models.BigIntegerField(default=0)
    movement = models.ForeignKey(StockMovement, on_delete=models.PROTECT, related_name="+")

    class Meta:
        db_table = "construction_material_issues"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.quantity} x {self.item} for {self.project}"


class Equipment(TenantModel):
    class Status(models.TextChoices):
        AVAILABLE = "available", "Available"
        IN_USE = "in_use", "In use"
        MAINTENANCE = "maintenance", "Under maintenance"
        RETIRED = "retired", "Retired"

    name = models.CharField(max_length=150)
    equipment_type = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.AVAILABLE)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "construction_equipment"
        ordering = ["name"]

    @property
    def current_assignment(self):
        return self.assignments.filter(end_date__isnull=True).order_by("-start_date").first()

    def __str__(self):
        return self.name


class EquipmentAssignment(TenantModel):
    """One stretch of an Equipment unit working on one Project.
    `end_date` null means still ongoing — the same "open until closed"
    shape apps.fleet.VehicleAssignment already established for the
    identical resource-on-a-job problem, just equipment-on-a-project
    instead of employee-on-a-vehicle. Serializer-level validation keeps
    at most one open assignment per equipment unit at a time, the same
    non-DB-constraint call VehicleAssignment makes for the same
    reason."""

    equipment = models.ForeignKey(Equipment, on_delete=models.CASCADE, related_name="assignments")
    project = models.ForeignKey(ConstructionProject, on_delete=models.CASCADE, related_name="equipment_assignments")
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    daily_rate_cents = models.BigIntegerField(default=0)

    class Meta:
        db_table = "construction_equipment_assignments"
        ordering = ["-start_date"]

    @property
    def cost_cents(self):
        """Cost to date (or, once closed, total cost): inclusive day
        count from start_date to end_date-or-today times daily_rate_cents.
        Feeds the project costing report — see
        ConstructionProjectViewSet.costing."""
        end = self.end_date or timezone.localdate()
        days = max((end - self.start_date).days + 1, 0)
        return days * self.daily_rate_cents

    def __str__(self):
        return f"{self.equipment} — {self.project}"


class LaborAssignment(TenantModel):
    """"Labor" — one Employee's stretch of working on one Project. Same
    open-until-closed shape as EquipmentAssignment/VehicleAssignment."""

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="construction_assignments")
    project = models.ForeignKey(ConstructionProject, on_delete=models.CASCADE, related_name="labor_assignments")
    role = models.CharField(max_length=100, blank=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    daily_rate_cents = models.BigIntegerField(default=0)

    class Meta:
        db_table = "construction_labor_assignments"
        ordering = ["-start_date"]

    @property
    def cost_cents(self):
        """Same inclusive-day-count shape as EquipmentAssignment.cost_cents."""
        end = self.end_date or timezone.localdate()
        days = max((end - self.start_date).days + 1, 0)
        return days * self.daily_rate_cents

    def __str__(self):
        return f"{self.employee} — {self.project}"


class SiteExpense(TenantModel):
    """Same shape as apps.realestate.PropertyExpense — a project-scoped
    expense record, not routed through apps.expenses' employee-claim
    approval workflow (that workflow is for individual reimbursement,
    this is direct site spend)."""

    project = models.ForeignKey(ConstructionProject, on_delete=models.CASCADE, related_name="expenses")
    category = models.CharField(max_length=100, blank=True)
    description = models.CharField(max_length=255, blank=True)
    amount_cents = models.BigIntegerField()
    expense_date = models.DateField()

    class Meta:
        db_table = "construction_site_expenses"
        ordering = ["-expense_date", "-created_at"]

    def __str__(self):
        return f"{self.description or self.category} — {self.project}"


class ChangeOrder(TenantModel):
    """A scope/budget change to a project. `amount_cents` can be
    negative (a scope reduction). `approve` actually adjusts
    `ConstructionProject.budget_cents` by `amount_cents` — a real
    effect, not just a status flag."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    number = models.CharField(max_length=20)
    project = models.ForeignKey(ConstructionProject, on_delete=models.CASCADE, related_name="change_orders")
    description = models.CharField(max_length=255)
    amount_cents = models.BigIntegerField()
    requested_date = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)

    class Meta:
        db_table = "construction_change_orders"
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_company_change_order_number")
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return self.number


class QualityInspection(TenantModel):
    class Result(models.TextChoices):
        PASS = "pass", "Pass"
        FAIL = "fail", "Fail"
        CONDITIONAL = "conditional", "Conditional pass"

    project = models.ForeignKey(ConstructionProject, on_delete=models.CASCADE, related_name="quality_inspections")
    inspected_by = models.ForeignKey(
        Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    inspection_date = models.DateField()
    result = models.CharField(max_length=16, choices=Result.choices)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "construction_quality_inspections"
        ordering = ["-inspection_date", "-created_at"]

    def __str__(self):
        return f"{self.project} — {self.inspection_date} ({self.result})"


class SafetyIncident(TenantModel):
    class Severity(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        CRITICAL = "critical", "Critical"

    project = models.ForeignKey(ConstructionProject, on_delete=models.CASCADE, related_name="safety_incidents")
    incident_date = models.DateField()
    description = models.TextField()
    severity = models.CharField(max_length=16, choices=Severity.choices, default=Severity.LOW)
    reported_by = models.ForeignKey(
        Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    corrective_action = models.TextField(blank=True)

    class Meta:
        db_table = "construction_safety_incidents"
        ordering = ["-incident_date", "-created_at"]

    def __str__(self):
        return f"{self.project} — {self.incident_date} ({self.severity})"
