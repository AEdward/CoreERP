from django.conf import settings
from django.db import models

from apps.catalog.models import Item
from apps.common.models import TenantModel
from apps.suppliers.models import Supplier


class PurchaseRequest(TenantModel):
    """The internal "we need to buy this" step before a PurchaseOrder
    exists — no supplier yet, just what's needed and why. Goes through
    apps.approvals the identical way PurchaseOrder does (a third real
    consumer, after PurchaseOrder and Expense — see that registry's own
    docstring), and `convert()` is the one bridge from an approved
    request into a real Draft PurchaseOrder against a chosen supplier,
    the same "convert" shape apps.crm.Lead uses for prospect -> Customer.
    """

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CONVERTED = "converted", "Converted"

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    justification = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    converted_purchase_order = models.ForeignKey(
        "PurchaseOrder", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "purchase_requests"
        ordering = ["-created_at"]

    @property
    def total_cents(self):
        return sum(line.quantity * line.estimated_unit_cost_cents for line in self.lines.all())

    def __str__(self):
        return f"PR-{self.id}"


class PurchaseRequestLine(TenantModel):
    purchase_request = models.ForeignKey(PurchaseRequest, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    quantity = models.PositiveIntegerField()
    estimated_unit_cost_cents = models.BigIntegerField(default=0)

    class Meta:
        db_table = "purchase_request_lines"

    def __str__(self):
        return f"{self.quantity} x {self.item}"


class PurchaseOrder(TenantModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        # SUBMITTED/APPROVED/REJECTED are set only by apps.approvals now
        # (see apps/procurement/apps.py's ready() hook registration) —
        # PurchaseOrderSerializer.validate_status() blocks a client from
        # setting them directly.
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
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
    # Closes the "(partial) Goods Receipt" gap — cumulative quantity
    # actually received against this line, via PurchaseOrderViewSet.receive.
    # Partial receipts are allowed (a delivery can arrive in batches);
    # the PO as a whole flips to RECEIVED once every line's outstanding
    # quantity reaches zero.
    received_quantity = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "purchase_order_lines"

    @property
    def line_total_cents(self):
        return self.quantity * self.unit_cost_cents

    @property
    def outstanding_quantity(self):
        return self.quantity - self.received_quantity

    def __str__(self):
        return f"{self.quantity} x {self.item}"


class Bill(TenantModel):
    """A supplier's invoice to us — the AP counterpart to apps.sales.Invoice.
    Creating one auto-posts a journal entry (see apps.accounting.signals);
    bill_number is set the same way invoice_number is, right after
    creation, from company_id + id.
    """

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        RECEIVED = "received", "Received"
        PAID = "paid", "Paid"
        OVERDUE = "overdue", "Overdue"
        VOID = "void", "Void"

    purchase_order = models.ForeignKey(
        PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name="bills"
    )
    bill_number = models.CharField(max_length=32, blank=True)
    amount_cents = models.BigIntegerField()
    tax_amount_cents = models.BigIntegerField(default=0)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)

    class Meta:
        db_table = "bills"
        constraints = [
            models.UniqueConstraint(fields=["company", "bill_number"], name="unique_company_bill_number")
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return self.bill_number or f"Bill #{self.pk}"
