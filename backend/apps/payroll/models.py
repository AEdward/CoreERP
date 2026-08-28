from decimal import Decimal

from django.db import models

from apps.common.models import TenantModel
from apps.hr.models import Employee


class TaxBracket(TenantModel):
    """A configurable PAYE income-tax bracket — the same "company-editable
    reference table" shape apps.tax.TaxRate already establishes for VAT,
    just for payroll's own tax domain. Seeded with Ethiopia's actual
    current bands (Proclamation No. 1395/2025) for every company (see
    apps.payroll.seed), not placeholders — a company can edit or replace
    them afterwards. `upper_bound_cents` is null for the open-ended top
    bracket. apps.payroll.engine.calculate_paye_cents sums marginal tax
    band-by-band across these (not the equivalent "flat rate minus a
    lookup deduction" shortcut some payroll tools use), so a company
    entering arbitrary custom brackets doesn't also have to correctly
    compute a matching deduction constant — one less way to get this
    wrong. Brackets aren't validated against overlapping/gaps — same
    trust-the-configured-data stance TaxRate already takes."""

    lower_bound_cents = models.BigIntegerField()
    upper_bound_cents = models.BigIntegerField(null=True, blank=True)
    rate_percent = models.DecimalField(max_digits=5, decimal_places=2)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "payroll_tax_brackets"
        ordering = ["lower_bound_cents"]

    def __str__(self):
        upper = str(self.upper_bound_cents) if self.upper_bound_cents is not None else "∞"
        return f"{self.lower_bound_cents}–{upper} @ {self.rate_percent}%"


class PensionSettings(TenantModel):
    """One row per company — the statutory pension withholding rates
    payroll applies to every payslip's basic salary: a share withheld
    from the employee (a PayslipLine deduction, like PAYE) and a share
    the company itself contributes on top (never deducted from the
    employee). Defaults match Ethiopia's Pension Proclamation No.
    715/2011 (as amended) for private-sector employers — 7% employee /
    11% employer of basic salary — but kept as a real per-company
    settings row rather than a hardcoded constant since the applicable
    rate depends on employer type and can change by amendment. Seeded
    for every company (see apps.payroll.seed); apps.payroll.engine
    falls back to 0/0 if a company somehow has none, rather than
    erroring, the same "opt in, no forced number" shape TaxBracket's
    own per-company opt-in follows."""

    employee_rate_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("7.00"))
    employer_rate_percent = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("11.00"))

    class Meta:
        db_table = "payroll_pension_settings"

    def __str__(self):
        return f"{self.employee_rate_percent}% employee / {self.employer_rate_percent}% employer"


class SalaryComponent(TenantModel):
    """A reusable pay component a company defines once and assigns to
    employees with an amount — e.g. "Transport Allowance" (earning) or
    "Uniform Deduction" (deduction). Basic Salary itself isn't one of
    these; it stays Employee.salary_cents, the one "current payroll
    figure" HR already keeps up to date (see EmployeeContract's
    docstring). PAYE income tax and pension aren't SalaryComponents
    either — they're computed automatically by apps.payroll.engine from
    the statutory Ethiopian formulas, not something a company edits."""

    class Category(models.TextChoices):
        EARNING = "earning", "Earning"
        DEDUCTION = "deduction", "Deduction"

    name = models.CharField(max_length=100)
    category = models.CharField(max_length=16, choices=Category.choices)
    is_taxable = models.BooleanField(
        default=True,
        help_text="Only meaningful for Earning components — whether this amount counts toward PAYE taxable income.",
    )

    class Meta:
        db_table = "salary_components"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_salary_component_name")
        ]
        ordering = ["category", "name"]

    def __str__(self):
        return self.name


class EmployeeSalaryComponent(TenantModel):
    """Assigns a SalaryComponent to an Employee with a recurring amount
    — the "Salary Structure" for that employee, one row per component."""

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="salary_components")
    component = models.ForeignKey(SalaryComponent, on_delete=models.PROTECT, related_name="+")
    amount_cents = models.BigIntegerField()

    class Meta:
        db_table = "employee_salary_components"
        constraints = [
            models.UniqueConstraint(
                fields=["employee", "component"], name="unique_employee_salary_component"
            )
        ]
        ordering = ["component__category", "component__name"]

    def __str__(self):
        return f"{self.employee} — {self.component} ({self.amount_cents / 100:.2f})"


class PayrollRun(TenantModel):
    """One payroll cycle (typically a month). `process` computes and
    freezes a Payslip per active employee and posts the payroll journal
    entry (Dr Salary/Pension Expense, Cr Payroll/PAYE/Pension Payable);
    `mark_paid` posts the actual cash disbursement of net pay (Dr Payroll
    Payable, Cr Cash) — the same two-step "book the obligation, then pay
    it" shape Bill->Payment already uses. PAYE Payable and Pension
    Payable are deliberately left as standing liabilities afterward, not
    auto-remitted to the tax authority/pension fund — this project
    doesn't build a "remit sales tax" flow for Invoice's Tax Payable
    either, same honest scope limit."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PROCESSED = "processed", "Processed"
        PAID = "paid", "Paid"

    label = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    processed_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "payroll_runs"
        ordering = ["-start_date"]

    @property
    def total_net_pay_cents(self):
        return sum(p.net_pay_cents for p in self.payslips.all())

    def __str__(self):
        return f"{self.label} ({self.get_status_display()})"


class Payslip(TenantModel):
    """One employee's frozen pay computation for one PayrollRun — frozen
    at process() time, so later changes to salary/components don't
    retroactively change an already-processed payslip, the same
    "snapshot at the moment that mattered" shape Purchase Order lines
    already use for received_quantity."""

    payroll_run = models.ForeignKey(PayrollRun, on_delete=models.CASCADE, related_name="payslips")
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="payslips")
    gross_cents = models.BigIntegerField(default=0)
    taxable_income_cents = models.BigIntegerField(default=0)
    paye_tax_cents = models.BigIntegerField(default=0)
    pension_employee_cents = models.BigIntegerField(default=0)
    pension_employer_cents = models.BigIntegerField(default=0)
    other_deductions_cents = models.BigIntegerField(default=0)
    loan_repayment_cents = models.BigIntegerField(default=0)
    net_pay_cents = models.BigIntegerField(default=0)

    class Meta:
        db_table = "payslips"
        constraints = [
            models.UniqueConstraint(fields=["payroll_run", "employee"], name="unique_payroll_run_employee")
        ]
        ordering = ["employee__last_name", "employee__first_name"]

    def __str__(self):
        return f"{self.employee} — {self.payroll_run}"


class PayslipLine(TenantModel):
    """Itemized breakdown of a Payslip — Basic Salary, each allowance,
    PAYE tax, pension, each deduction — for transparency on the printed
    payslip, the same reasoning PurchaseOrderLine/SalesOrderLine give a
    line-by-line breakdown instead of just a total."""

    class LineType(models.TextChoices):
        EARNING = "earning", "Earning"
        DEDUCTION = "deduction", "Deduction"

    payslip = models.ForeignKey(Payslip, on_delete=models.CASCADE, related_name="lines")
    label = models.CharField(max_length=100)
    line_type = models.CharField(max_length=16, choices=LineType.choices)
    amount_cents = models.BigIntegerField()
    source_loan = models.ForeignKey(
        "Loan", on_delete=models.PROTECT, null=True, blank=True, related_name="repayment_lines",
        help_text="Set only for a deduction line generated by a Loan repayment installment.",
    )

    class Meta:
        db_table = "payslip_lines"
        ordering = ["id"]

    def __str__(self):
        return f"{self.label}: {self.amount_cents / 100:.2f}"


class Loan(TenantModel):
    """An employee loan/advance, disbursed once (Dr Employee Loan
    Receivable, Cr Cash — see apps.accounting.posting.post_loan_disbursement_journal)
    and recovered via a fixed monthly installment automatically deducted
    by process_payroll_run, same amount each run except the final one
    (capped at whatever balance remains). Repayment credits the same
    Employee Loan Receivable account rather than a liability — the loan
    was always an asset, repaying it just shrinks that asset back toward
    zero, unlike a generic other_deductions_cents deduction which has no
    asset of its own to reduce."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        PAID_OFF = "paid_off", "Paid off"
        CANCELLED = "cancelled", "Cancelled"

    loan_number = models.CharField(max_length=32, blank=True)
    employee = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name="loans")
    principal_cents = models.BigIntegerField()
    term_months = models.PositiveIntegerField()
    start_date = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "loans"
        constraints = [
            models.UniqueConstraint(fields=["company", "loan_number"], name="unique_company_loan_number")
        ]
        ordering = ["-start_date"]

    @property
    def monthly_installment_cents(self):
        return self.principal_cents // self.term_months

    @property
    def repaid_cents(self):
        return sum(line.amount_cents for line in self.repayment_lines.all())

    @property
    def remaining_balance_cents(self):
        return self.principal_cents - self.repaid_cents

    def __str__(self):
        return f"{self.loan_number or self.pk} — {self.employee}"
