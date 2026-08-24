from django.core.validators import MaxValueValidator
from django.db import models

from apps.catalog.models import Item
from apps.common.models import TenantModel
from apps.crm.models import Customer


class Quotation(TenantModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SENT = "sent", "Sent"
        ACCEPTED = "accepted", "Accepted"
        REJECTED = "rejected", "Rejected"
        EXPIRED = "expired", "Expired"

    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="quotations")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)

    class Meta:
        db_table = "quotations"
        ordering = ["-created_at"]

    @property
    def total_cents(self):
        return sum(line.line_total_cents for line in self.lines.all())

    def __str__(self):
        return f"Q-{self.id} ({self.customer})"


class QuotationLine(TenantModel):
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    quantity = models.PositiveIntegerField()
    unit_price_cents = models.BigIntegerField()
    # Closes the module map's "(partial) Discounts" gap: a formal,
    # auditable field instead of just editing unit_price_cents down by
    # hand with no record of what the "real" price was. A flat
    # percentage, not a per-line flat-cents discount or a whole-document
    # one — the simplest shape that still gives every line its own
    # discount and survives a partial reorder.
    discount_percent = models.PositiveIntegerField(default=0, validators=[MaxValueValidator(100)])

    class Meta:
        db_table = "quotation_lines"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(discount_percent__lte=100), name="quotation_line_discount_max_100"
            )
        ]

    @property
    def line_total_cents(self):
        gross = self.quantity * self.unit_price_cents
        return gross - (gross * self.discount_percent // 100)


class SalesOrder(TenantModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        FULFILLED = "fulfilled", "Fulfilled"
        CANCELLED = "cancelled", "Cancelled"

    class PaymentStatus(models.TextChoices):
        UNPAID = "unpaid", "Unpaid"
        PARTIALLY_PAID = "partially_paid", "Partially paid"
        PAID = "paid", "Paid"

    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="sales_orders")
    quotation = models.ForeignKey(
        Quotation, on_delete=models.SET_NULL, null=True, blank=True, related_name="sales_orders"
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    payment_status = models.CharField(
        max_length=16, choices=PaymentStatus.choices, default=PaymentStatus.UNPAID
    )

    class Meta:
        db_table = "sales_orders"
        ordering = ["-created_at"]

    @property
    def total_cents(self):
        return sum(line.line_total_cents for line in self.lines.all())

    def __str__(self):
        return f"SO-{self.id} ({self.customer})"


class SalesOrderLine(TenantModel):
    sales_order = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    quantity = models.PositiveIntegerField()
    unit_price_cents = models.BigIntegerField()
    discount_percent = models.PositiveIntegerField(default=0, validators=[MaxValueValidator(100)])

    class Meta:
        db_table = "sales_order_lines"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(discount_percent__lte=100), name="sales_order_line_discount_max_100"
            )
        ]

    @property
    def line_total_cents(self):
        gross = self.quantity * self.unit_price_cents
        return gross - (gross * self.discount_percent // 100)


class Invoice(TenantModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SENT = "sent", "Sent"
        PAID = "paid", "Paid"
        OVERDUE = "overdue", "Overdue"
        VOID = "void", "Void"

    sales_order = models.ForeignKey(
        SalesOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name="invoices"
    )
    # Set once, right after creation, from company_id + id — see
    # serializer. Left blank at the model level rather than derived via a
    # separate per-company counter table, which is more machinery than an
    # MVP invoicing flow needs.
    invoice_number = models.CharField(max_length=32, blank=True)
    # Snapshotted from sales_order.total_cents at creation time when tied
    # to an order — later line changes on that order never retroactively
    # change an already-issued invoice (same locking principle ClipBirr
    # uses for CPM).
    amount_cents = models.BigIntegerField()
    tax_amount_cents = models.BigIntegerField(default=0)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)

    class Meta:
        db_table = "invoices"
        constraints = [
            models.UniqueConstraint(
                fields=["company", "invoice_number"], name="unique_company_invoice_number"
            )
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return self.invoice_number or f"Invoice #{self.pk}"


class CreditNote(TenantModel):
    """Reduces an already-issued Invoice — a refund, a pricing error, a
    partial return — without touching the invoice's own append-only
    history. Deliberately financial-only, no stock-restocking side
    effect: apps.sales has no path today where issuing an Invoice or
    SalesOrder moves Inventory stock in the first place, so a "Sales
    Return" that restocks goods has no existing mechanism to hook into
    yet — that's a bigger prerequisite (deciding when/how Sales debits
    Stock at all), not something to bolt on here speculatively.

    Same two-step create-then-number pattern as Invoice/Bill, a fourth
    real consumer of apps.common.numbering after Invoice/Bill/Payment's
    receipt_number. Posts the exact reverse of Invoice's own entry: Dr
    Sales Revenue, Dr Tax Payable (if any), Cr Accounts Receivable —
    apps.accounting.signals keys posting on "number is set and nothing's
    posted against it yet", identical to Invoice/Bill.
    """

    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="credit_notes")
    credit_note_number = models.CharField(max_length=32, blank=True)
    amount_cents = models.BigIntegerField()
    tax_amount_cents = models.BigIntegerField(default=0)
    reason = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "credit_notes"
        constraints = [
            models.UniqueConstraint(
                fields=["company", "credit_note_number"], name="unique_company_credit_note_number"
            )
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return self.credit_note_number or f"Credit Note #{self.pk}"
