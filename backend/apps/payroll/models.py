from django.db import models

from apps.common.models import TenantModel
from apps.hr.models import Employee


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

    class Meta:
        db_table = "payslip_lines"
        ordering = ["id"]

    def __str__(self):
        return f"{self.label}: {self.amount_cents / 100:.2f}"
