from django.conf import settings
from django.db import models

from apps.catalog.models import Item
from apps.common.models import TenantModel
from apps.inventory.models import StockMovement, Warehouse

# Section I: Manufacturing — designed fresh, no MiranErp/Odoo source ported
# wholesale the way Section J was (no manufacturing reference exists in
# either project). Deliberately thin, same restraint apps.fleet applied:
# a real BOM -> Production Order -> stock consumption/production loop with
# honest costing, not a scheduling optimizer or a generic template engine.
# "Raw Materials" / "Finished Goods" / "Work in Progress" from the module
# map checklist aren't separate models here — they're all just
# apps.catalog.Item (a company's items are raw materials if some BOM
# consumes them, finished goods if some BOM produces them, nothing stops
# an item being both), and "in progress" is a ProductionOrder whose
# status is in_progress. Modeling them as distinct tables would just be
# the same Item rows tagged twice.


class WorkCenter(TenantModel):
    """A production area/station — "Assembly Line 1", "Paint Booth 2" —
    that Machines belong to and WorkOrders are scheduled against.
    hourly_rate_cents is the blended labor+overhead rate charged to a
    production order for time spent at this work center (see
    WorkOrder.actual_hours), the same flat-rate simplification a real
    system would eventually split into separate labor/overhead rates —
    not needed until a company actually asks for that breakdown.
    """

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=32, blank=True)
    hourly_rate_cents = models.BigIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "manufacturing_work_centers"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_work_center_name")
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class Machine(TenantModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        MAINTENANCE = "maintenance", "In maintenance"
        RETIRED = "retired", "Retired"

    work_center = models.ForeignKey(WorkCenter, on_delete=models.PROTECT, related_name="machines")
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=32, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "manufacturing_machines"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_machine_name")
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class MachineMaintenanceLog(TenantModel):
    """One serviced-on-this-date entry for a Machine — the "Manufacturing
    Maintenance" checklist item. Deliberately just a log, not a ported
    copy of apps.maintenance's WorkOrder/MaintenanceSchedule pair: that
    model is hard-wired to a hotel Room (see its own docstring), and
    generalizing it to non-room assets is called out there as a known
    rough edge left for its own pass, not something to retrofit here.
    """

    machine = models.ForeignKey(Machine, on_delete=models.CASCADE, related_name="maintenance_logs")
    performed_at = models.DateField()
    description = models.CharField(max_length=255)
    cost_cents = models.BigIntegerField(default=0)
    downtime_hours = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = "manufacturing_machine_maintenance_logs"
        ordering = ["-performed_at"]

    def __str__(self):
        return f"{self.machine} — {self.performed_at}"


class BillOfMaterial(TenantModel):
    """A recipe: 1 unit of output_item requires BOMLine.quantity_per_unit
    of each component_item. No batch-size/output_quantity field — every
    BOM is normalized to "per 1 unit of output", so a ProductionOrder's
    required-component math is just quantity_per_unit * order.quantity,
    no batch scaling to get wrong. A company can have more than one BOM
    for the same output_item (alternate formulations); is_active just
    flags which one is the current default — nothing enforces "only one
    active BOM per item", the same light touch StockCount's own status
    field uses instead of a DB constraint.
    """

    output_item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="boms")
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "manufacturing_boms"
        constraints = [
            models.UniqueConstraint(
                fields=["company", "output_item", "name"], name="unique_company_bom_output_name"
            )
        ]
        ordering = ["output_item__name", "name"]

    def __str__(self):
        return f"{self.name} ({self.output_item})"


class BOMLine(TenantModel):
    bom = models.ForeignKey(BillOfMaterial, on_delete=models.CASCADE, related_name="lines")
    component_item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    quantity_per_unit = models.PositiveIntegerField()

    class Meta:
        db_table = "manufacturing_bom_lines"
        constraints = [
            models.UniqueConstraint(fields=["bom", "component_item"], name="unique_bom_component")
        ]
        ordering = ["component_item__name"]

    def __str__(self):
        return f"{self.quantity_per_unit} x {self.component_item} for {self.bom}"


class BOMByproduct(TenantModel):
    """Odoo's mrp.bom.byproduct_ids: a BOM can yield more than just its
    main output_item — offcuts, packaging shells, a secondary grade of
    the same output — that get received into stock alongside the main
    product when a production order is produced (see
    ProductionOrderViewSet.produce). Unlike ScrapEntry, a byproduct has
    real value and lands in stock rather than being written off.
    """

    bom = models.ForeignKey(BillOfMaterial, on_delete=models.CASCADE, related_name="byproducts")
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    quantity_per_unit = models.PositiveIntegerField()

    class Meta:
        db_table = "manufacturing_bom_byproducts"
        constraints = [
            models.UniqueConstraint(fields=["bom", "item"], name="unique_bom_byproduct_item")
        ]
        ordering = ["item__name"]

    def __str__(self):
        return f"{self.quantity_per_unit} x {self.item} (byproduct of {self.bom})"


class BOMOperation(TenantModel):
    """A standard operation on a BOM's routing — Odoo's mrp.bom now
    keeps operations directly on the BOM (operation_ids) rather than a
    separate routing model, and that's what this mirrors: define
    "Cutting" then "Assembly" once on the BOM, and every ProductionOrder
    created against it gets matching WorkOrder rows auto-generated in
    sequence (see ProductionOrderViewSet.perform_create), instead of
    someone re-typing the same steps by hand on every single run.
    duration_minutes is the planned time for 1 unit of output; a
    WorkOrder's planned_hours scales it by the order's quantity.
    """

    bom = models.ForeignKey(BillOfMaterial, on_delete=models.CASCADE, related_name="operations")
    work_center = models.ForeignKey(WorkCenter, on_delete=models.PROTECT, related_name="+")
    name = models.CharField(max_length=100)
    sequence = models.PositiveIntegerField(default=10)
    duration_minutes = models.DecimalField(max_digits=6, decimal_places=2, default=0)

    class Meta:
        db_table = "manufacturing_bom_operations"
        ordering = ["bom_id", "sequence"]

    def __str__(self):
        return f"{self.name} — {self.bom}"


class ProductionOrder(TenantModel):
    """One run of "make `quantity` units of bom.output_item". Raw
    materials are consumed from, and finished goods received into, the
    same single `warehouse` — a real system would eventually let those
    differ (a separate raw-materials store vs. a finished-goods store),
    but nothing in this project routes stock across more than one
    warehouse per document yet (Goods Receipt/Dispatch don't either), so
    this follows the same one-warehouse-per-document shape rather than
    inventing multi-warehouse routing for a need nobody's hit.
    """

    class Status(models.TextChoices):
        PLANNED = "planned", "Planned"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    number = models.CharField(max_length=20)
    bom = models.ForeignKey(BillOfMaterial, on_delete=models.PROTECT, related_name="production_orders")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="production_orders")
    quantity = models.PositiveIntegerField()
    produced_quantity = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PLANNED)
    planned_start_date = models.DateField(null=True, blank=True)
    planned_end_date = models.DateField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "manufacturing_production_orders"
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_company_production_order_number")
        ]
        ordering = ["-created_at"]

    @property
    def total_material_cost_cents(self):
        return sum(
            (c.quantity * c.unit_cost_cents for c in self.material_consumptions.all()), 0
        )

    @property
    def total_labor_cost_cents(self):
        total = 0
        for wo in self.work_orders.all():
            if wo.actual_hours is not None:
                total += int(wo.actual_hours * wo.work_center.hourly_rate_cents)
        return total

    @property
    def total_scrap_cost_cents(self):
        return sum((s.quantity * s.unit_cost_cents for s in self.scrap_entries.all()), 0)

    @property
    def total_cost_cents(self):
        return self.total_material_cost_cents + self.total_labor_cost_cents + self.total_scrap_cost_cents

    def __str__(self):
        return self.number


class WorkOrder(TenantModel):
    """One operation/step of a ProductionOrder performed at a WorkCenter
    — "Cutting", "Assembly", "Packing" — ordered by `sequence`. Distinct
    from apps.maintenance.WorkOrder (a hotel repair ticket): same generic
    name, different app/table, no relationship between them, matching
    how Section J's own models never tried to share names with Core just
    because the concepts are loosely similar.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"

    production_order = models.ForeignKey(ProductionOrder, on_delete=models.CASCADE, related_name="work_orders")
    work_center = models.ForeignKey(WorkCenter, on_delete=models.PROTECT, related_name="work_orders")
    operation_name = models.CharField(max_length=100)
    sequence = models.PositiveIntegerField(default=10)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    planned_hours = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    actual_hours = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "manufacturing_work_orders"
        ordering = ["production_order_id", "sequence"]

    def __str__(self):
        return f"{self.operation_name} — {self.production_order}"


class MaterialConsumption(TenantModel):
    """A raw-material issue against a ProductionOrder. Same shape as
    apps.maintenance.WorkOrderPart: created alongside a real OUT
    apps.inventory.StockMovement through the shared StockMovementSerializer
    (see ProductionOrderViewSet.consume), never mutates Stock itself.
    unit_cost_cents snapshots Item.cost_cents at consumption time so a
    later price change doesn't rewrite the cost of production runs
    already booked — the same reason accounting entries snapshot amounts
    rather than re-deriving them from current master data.
    """

    production_order = models.ForeignKey(
        ProductionOrder, on_delete=models.CASCADE, related_name="material_consumptions"
    )
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    quantity = models.PositiveIntegerField()
    unit_cost_cents = models.BigIntegerField(default=0)
    movement = models.ForeignKey(StockMovement, on_delete=models.PROTECT, related_name="+")

    class Meta:
        db_table = "manufacturing_material_consumptions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.quantity} x {self.item} for {self.production_order}"


class ScrapEntry(TenantModel):
    """Logged production loss — spoiled output or a wasted component —
    for the "Waste / Scrap Management" checklist item. Purely a cost/
    quantity record, not itself a StockMovement: scrapped output never
    reached finished-goods stock (it's short-counted at `produce` time
    instead) and a scrapped component was already decremented from stock
    by the MaterialConsumption that issued it.
    """

    production_order = models.ForeignKey(ProductionOrder, on_delete=models.CASCADE, related_name="scrap_entries")
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    quantity = models.PositiveIntegerField()
    unit_cost_cents = models.BigIntegerField(default=0)
    reason = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "manufacturing_scrap_entries"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.quantity} x {self.item} scrapped on {self.production_order}"


class QualityCheck(TenantModel):
    class Result(models.TextChoices):
        PASS = "pass", "Pass"
        FAIL = "fail", "Fail"
        REWORK = "rework", "Rework"

    production_order = models.ForeignKey(ProductionOrder, on_delete=models.CASCADE, related_name="quality_checks")
    result = models.CharField(max_length=16, choices=Result.choices)
    checked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "manufacturing_quality_checks"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_result_display()} — {self.production_order}"
