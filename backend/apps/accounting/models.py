from django.conf import settings
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
        RETAINED_EARNINGS = "retained_earnings", "Retained Earnings"
        DEPRECIATION_EXPENSE = "depreciation_expense", "Depreciation Expense"
        ACCUMULATED_DEPRECIATION = "accumulated_depreciation", "Accumulated Depreciation"
        SALARY_EXPENSE = "salary_expense", "Salary Expense"
        PENSION_EXPENSE = "pension_expense", "Pension Expense (Employer)"
        PAYROLL_PAYABLE = "payroll_payable", "Payroll Payable"
        PAYE_PAYABLE = "paye_payable", "PAYE Payable"
        PENSION_PAYABLE = "pension_payable", "Pension Payable"
        PAYROLL_DEDUCTIONS_PAYABLE = "payroll_deductions_payable", "Other Payroll Deductions Payable"
        EMPLOYEE_LOAN_RECEIVABLE = "employee_loan_receivable", "Employee Loan Receivable"

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
    a payment also updates the linked Invoice/Bill/Expense status once
    fully paid (see signals.py) — full payment only for now, no partial-
    payment tracking yet.
    """

    class Direction(models.TextChoices):
        RECEIVED = "received", "Received (from a customer)"
        PAID = "paid", "Paid (to a supplier or employee)"

    class Method(models.TextChoices):
        CASH = "cash", "Cash"
        BANK_TRANSFER = "bank_transfer", "Bank transfer"
        MOBILE_MONEY = "mobile_money", "Mobile money"
        CARD = "card", "Card"

    direction = models.CharField(max_length=16, choices=Direction.choices)
    amount_cents = models.BigIntegerField()
    method = models.CharField(max_length=16, choices=Method.choices, default=Method.CASH)
    reference = models.CharField(max_length=255, blank=True)
    # Set once, right after creation, from apps.common.numbering — same
    # two-step-save pattern as Invoice.invoice_number/Bill.bill_number.
    # Backs the printable receipt (/dashboard/accounting/receipts/[id]).
    receipt_number = models.CharField(max_length=32, blank=True)
    invoice = models.ForeignKey(
        "sales.Invoice", on_delete=models.PROTECT, null=True, blank=True, related_name="payments"
    )
    bill = models.ForeignKey(
        "procurement.Bill", on_delete=models.PROTECT, null=True, blank=True, related_name="payments"
    )
    # An approved Expense reimbursement clears through Payment exactly
    # like a Bill does — same Accounts Payable account, same "paid"
    # direction (see post_payment_journal, which doesn't even need to
    # branch on which of the two it is).
    expense = models.ForeignKey(
        "expenses.Expense", on_delete=models.PROTECT, null=True, blank=True, related_name="payments"
    )

    class Meta:
        db_table = "payments"
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(invoice__isnull=False, bill__isnull=True, expense__isnull=True)
                    | models.Q(invoice__isnull=True, bill__isnull=False, expense__isnull=True)
                    | models.Q(invoice__isnull=True, bill__isnull=True, expense__isnull=False)
                ),
                name="payment_exactly_one_of_invoice_bill_expense",
            ),
        ]

    def __str__(self):
        if self.invoice_id:
            target = f"invoice {self.invoice_id}"
        elif self.bill_id:
            target = f"bill {self.bill_id}"
        else:
            target = f"expense {self.expense_id}"
        return f"{self.direction} {self.amount_cents} ({target})"


class FinancialPeriod(TenantModel):
    """A named stretch of time (a month, a quarter, a year — whatever the
    company uses) that gets closed exactly once, via
    posting.post_period_close_journal. start_date/end_date are labels for
    what real-world period this represents, not a filter the close itself
    applies: nothing in CoreERP supports backdating a JournalEntry (there's
    no transaction-date field separate from created_at), so "everything
    currently sitting in revenue/expense accounts" and "everything as of
    end_date" are the same set in practice. Periods close in order — you
    can't close one while an earlier one for the same company is still
    open — so the sweep is always unambiguous.
    """

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        CLOSED = "closed", "Closed"

    label = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    # Snapshotted at close time — the closing journal entry is the real
    # source of truth, this is just for a fast "what happened" summary.
    net_income_cents = models.BigIntegerField(null=True, blank=True)

    class Meta:
        db_table = "financial_periods"
        ordering = ["-start_date"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "start_date", "end_date"], name="unique_company_period"
            )
        ]

    def __str__(self):
        return self.label


class BankAccount(TenantModel):
    """A real bank/cash account as its own entity — distinct from the
    single generic Cash-role Account every company gets by default. Wraps
    a specific ledger `account` so its balance is always the real GL
    balance, never a second number to keep in sync.

    Known scope boundary: Payment always posts through the single
    Account.Role.CASH account (see posting.py) — there's no per-payment
    "which bank account did this move through" yet. A BankAccount wrapping
    that one Cash account reflects real activity; a second BankAccount
    wrapping a different ledger account only ever changes via manual
    Journal Entries until Payment routing is extended to support more
    than one.
    """

    name = models.CharField(max_length=100)
    bank_name = models.CharField(max_length=100, blank=True)
    account_number = models.CharField(max_length=50, blank=True)
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="bank_accounts")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "bank_accounts"
        ordering = ["name"]

    def __str__(self):
        return self.name


class BankStatementLine(TenantModel):
    """One line from a real bank statement, entered by hand — no file
    import/parsing, which would pull in a new dependency this project
    doesn't otherwise need. Reconciliation here is a manual tick, not an
    auto-matcher: the user marks a line reconciled once they've confirmed
    it against the books themselves. `is_reconciled` is the entire
    reconciliation state; the "outstanding difference" a reconciliation
    view shows is just the book balance minus the sum of reconciled lines.
    """

    bank_account = models.ForeignKey(BankAccount, on_delete=models.CASCADE, related_name="statement_lines")
    date = models.DateField()
    description = models.CharField(max_length=255, blank=True)
    amount_cents = models.BigIntegerField()  # positive = deposit, negative = withdrawal
    is_reconciled = models.BooleanField(default=False)

    class Meta:
        db_table = "bank_statement_lines"
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.date} {self.description} ({self.amount_cents})"


class PettyCashFund(TenantModel):
    """A small imprest cash fund — its own dedicated ledger `account`
    (the user creates a normal Asset account for it via the existing
    Accounts screen and picks it here), a custodian responsible for it,
    and the fixed float amount it should always total back up to after a
    replenishment."""

    name = models.CharField(max_length=100)
    custodian = models.ForeignKey("hr.Employee", on_delete=models.PROTECT, related_name="petty_cash_funds")
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="petty_cash_funds")
    imprest_amount_cents = models.BigIntegerField()
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "petty_cash_funds"
        ordering = ["name"]

    def __str__(self):
        return self.name


class PettyCashTransaction(TenantModel):
    """A disbursement out of a petty cash fund (Dr Default Expense, Cr
    the fund's account) or a replenishment back up to its imprest amount
    (Dr the fund's account, Cr the company's main Cash account) — see
    posting.post_petty_cash_transaction_journal."""

    class Type(models.TextChoices):
        DISBURSEMENT = "disbursement", "Disbursement"
        REPLENISHMENT = "replenishment", "Replenishment"

    fund = models.ForeignKey(PettyCashFund, on_delete=models.PROTECT, related_name="transactions")
    type = models.CharField(max_length=16, choices=Type.choices)
    category = models.CharField(max_length=100, blank=True)
    description = models.CharField(max_length=255, blank=True)
    amount_cents = models.BigIntegerField()
    date = models.DateField()

    class Meta:
        db_table = "petty_cash_transactions"
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.get_type_display()} {self.amount_cents} ({self.fund})"


class Budget(TenantModel):
    """A budgeted amount for one account over one labeled period —
    `period_label` is free text (e.g. "FY2026", "Jan 2026") for the same
    reason FinancialPeriod.label is: nothing else in CoreERP filters the
    ledger by date range yet, so "actual" in the budget-vs-actual report
    means all-time activity on that account, same documented limitation
    as the other reports. Pairing a budget's period_label with a real
    FinancialPeriod is left to the user's own naming discipline, not
    enforced here."""

    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="budgets")
    period_label = models.CharField(max_length=100)
    amount_cents = models.BigIntegerField()

    class Meta:
        db_table = "budgets"
        constraints = [
            models.UniqueConstraint(
                fields=["company", "account", "period_label"], name="unique_company_account_period_budget"
            )
        ]
        ordering = ["period_label", "account__code"]

    def __str__(self):
        return f"{self.account} — {self.period_label}"


class FixedAsset(TenantModel):
    """A depreciable asset. Straight-line only — the simplest method and
    the one every other computed figure in this app already favors
    (correct, simple, no configurable schedules). `last_depreciated_on`
    guards against double-running the same calendar month twice; see
    posting.post_depreciation_journal."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        DISPOSED = "disposed", "Disposed"

    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, blank=True)
    purchase_date = models.DateField()
    cost_cents = models.BigIntegerField()
    salvage_value_cents = models.BigIntegerField(default=0)
    useful_life_months = models.PositiveIntegerField()
    accumulated_depreciation_cents = models.BigIntegerField(default=0)
    last_depreciated_on = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)

    class Meta:
        db_table = "fixed_assets"
        ordering = ["-purchase_date"]

    def __str__(self):
        return self.name

    @property
    def monthly_depreciation_cents(self):
        if not self.useful_life_months:
            return 0
        depreciable_base = self.cost_cents - self.salvage_value_cents
        return depreciable_base // self.useful_life_months

    @property
    def book_value_cents(self):
        return self.cost_cents - self.accumulated_depreciation_cents
