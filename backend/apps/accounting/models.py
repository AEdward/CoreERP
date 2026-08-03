from django.db import models

from apps.common.models import TenantModel


class Account(TenantModel):
    """One row in the chart of accounts.

    `role` marks the handful of "well-known" accounts the posting engine
    (see posting.py) looks up by meaning rather than by name — Cash,
    Accounts Receivable, and so on. Every other account (most of them)
    has role=None and exists purely for the company's own bookkeeping;
    the posting engine never touches those directly.
    """

    class Type(models.TextChoices):
        ASSET = "asset", "Asset"
        LIABILITY = "liability", "Liability"
        EQUITY = "equity", "Equity"
        REVENUE = "revenue", "Revenue"
        EXPENSE = "expense", "Expense"

    class Role(models.TextChoices):
        CASH = "cash", "Cash"
        ACCOUNTS_RECEIVABLE = "accounts_receivable", "Accounts Receivable"
        ACCOUNTS_PAYABLE = "accounts_payable", "Accounts Payable"
        SALES_REVENUE = "sales_revenue", "Sales Revenue"
        TAX_PAYABLE = "tax_payable", "Tax Payable"
        DEFAULT_EXPENSE = "default_expense", "Default Expense"

    code = models.CharField(max_length=20)
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=16, choices=Type.choices)
    parent = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="children"
    )
    role = models.CharField(max_length=32, choices=Role.choices, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "accounts"
        constraints = [
            models.UniqueConstraint(fields=["company", "code"], name="unique_company_account_code"),
            # Only one account per company can claim a given well-known
            # role — the posting engine assumes exactly one Cash account
            # etc. per company, not "pick any".
            models.UniqueConstraint(
                fields=["company", "role"],
                name="unique_company_account_role",
                condition=models.Q(role__isnull=False),
            ),
        ]
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} {self.name}"


class JournalEntry(TenantModel):
    """A balanced set of debit/credit lines — append-only. Correcting a
    mistake means posting a reversing entry, never editing history; see
    JournalEntryViewSet's restricted http_method_names."""

    reference = models.CharField(max_length=255, blank=True)
    memo = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "journal_entries"
        ordering = ["-created_at"]

    def __str__(self):
        return self.reference or f"Journal Entry #{self.pk}"


class JournalLine(TenantModel):
    journal_entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name="lines")
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="journal_lines")
    debit_cents = models.BigIntegerField(default=0)
    credit_cents = models.BigIntegerField(default=0)

    class Meta:
        db_table = "journal_lines"
        constraints = [
            # A line is a debit OR a credit, never both — and never
            # neither (a zero/zero line carries no meaning).
            models.CheckConstraint(
                check=(
                    models.Q(debit_cents__gt=0, credit_cents=0)
                    | models.Q(credit_cents__gt=0, debit_cents=0)
                ),
                name="journal_line_debit_xor_credit",
            ),
        ]

    def __str__(self):
        return f"{self.account}: {self.debit_cents or -self.credit_cents}"


class Payment(TenantModel):
    """Actual cash movement — the one thing in accounting that isn't
    itself a journal entry, it *causes* one (see posting.py). Recording
    a payment also updates the linked Invoice/Bill status once fully
    paid (see signals.py) — full payment only for now, no partial-
    payment tracking on Invoice/Bill yet.
    """

    class Direction(models.TextChoices):
        RECEIVED = "received", "Received (from a customer)"
        PAID = "paid", "Paid (to a supplier)"

    class Method(models.TextChoices):
        CASH = "cash", "Cash"
        BANK_TRANSFER = "bank_transfer", "Bank transfer"
        MOBILE_MONEY = "mobile_money", "Mobile money"
        CARD = "card", "Card"

    direction = models.CharField(max_length=16, choices=Direction.choices)
    amount_cents = models.BigIntegerField()
    method = models.CharField(max_length=16, choices=Method.choices, default=Method.CASH)
    reference = models.CharField(max_length=255, blank=True)
    invoice = models.ForeignKey(
        "sales.Invoice", on_delete=models.PROTECT, null=True, blank=True, related_name="payments"
    )
    bill = models.ForeignKey(
        "procurement.Bill", on_delete=models.PROTECT, null=True, blank=True, related_name="payments"
    )

    class Meta:
        db_table = "payments"
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(invoice__isnull=False, bill__isnull=True)
                    | models.Q(invoice__isnull=True, bill__isnull=False)
                ),
                name="payment_exactly_one_of_invoice_or_bill",
            ),
        ]

    def __str__(self):
        target = self.invoice_id and f"invoice {self.invoice_id}" or f"bill {self.bill_id}"
        return f"{self.direction} {self.amount_cents} ({target})"
