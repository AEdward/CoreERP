"""Ethiopian payroll math — the one place PAYE income tax and pension
get computed, so the brackets/rates live in exactly one spot.

PAYE brackets are Ethiopia's Federal Income Tax (Amendment) Proclamation
No. 1395/2025, effective 7 July 2025: monthly employment income taxed
progressively at 0% to ETB 2,000, 15% to 4,000, 20% to 7,000, 25% to
10,000, 30% to 14,000, 35% above. Pension is 7% employee / 11% employer
of gross salary, uncapped, and does NOT reduce the PAYE taxable base —
both are computed on the same gross figure independently.

Bracket boundaries are stored in cents (ETB * 100) to match every other
money field in this project. Computed bracket-by-bracket (marginal rate
on each band) rather than the equivalent "flat rate minus a lookup
deduction" shortcut some payroll tools use, so the six brackets above
stay the single source of truth with no second deduction-constant table
to keep in sync.
"""

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

PAYE_BRACKETS_CENTS = [
    # (lower_bound_cents, upper_bound_cents or None for the top bracket, rate)
    (0, 200_000, 0.00),
    (200_000, 400_000, 0.15),
    (400_000, 700_000, 0.20),
    (700_000, 1_000_000, 0.25),
    (1_000_000, 1_400_000, 0.30),
    (1_400_000, None, 0.35),
]

PENSION_EMPLOYEE_RATE = 0.07
PENSION_EMPLOYER_RATE = 0.11


def calculate_paye_cents(taxable_income_cents):
    if taxable_income_cents <= 0:
        return 0
    tax = 0.0
    for lower, upper, rate in PAYE_BRACKETS_CENTS:
        if taxable_income_cents <= lower:
            break
        band_top = min(taxable_income_cents, upper) if upper is not None else taxable_income_cents
        band_amount = band_top - lower
        if band_amount > 0:
            tax += band_amount * rate
    return round(tax)


@transaction.atomic
def process_payroll_run(request, run):
    """Computes and freezes a Payslip (+ PayslipLine breakdown) for
    every non-terminated employee in the company, posts the payroll
    journal entry, and flips the run to Processed. Bypasses
    CompanyScopedViewSet.perform_create for each Payslip (this is a
    bulk operation, not a single-record create through a serializer), so
    the audit trail is one UPDATED entry on the PayrollRun itself
    (status + totals) rather than one CREATED entry per Payslip — the
    same "the parent is the auditable event, its lines aren't logged
    individually" shape PurchaseOrderLine/SalesOrderLine already have."""
    from apps.auditlog.models import AuditLog
    from apps.auditlog.services import log_audit
    from apps.hr.models import Employee

    from .models import EmployeeSalaryComponent, Payslip, PayslipLine, SalaryComponent

    if run.status != run.Status.DRAFT:
        raise ValidationError("Only a draft payroll run can be processed.")

    company = run.company
    employees = Employee.objects.filter(company=company).exclude(status=Employee.Status.TERMINATED)

    for employee in employees:
        components = EmployeeSalaryComponent.objects.filter(employee=employee).select_related("component")
        earnings = [c for c in components if c.component.category == SalaryComponent.Category.EARNING]
        deductions = [c for c in components if c.component.category == SalaryComponent.Category.DEDUCTION]

        basic_cents = employee.salary_cents
        gross_cents = basic_cents + sum(c.amount_cents for c in earnings)
        taxable_cents = basic_cents + sum(c.amount_cents for c in earnings if c.component.is_taxable)

        paye_cents = calculate_paye_cents(taxable_cents)
        pension_employee_cents = round(gross_cents * PENSION_EMPLOYEE_RATE)
        pension_employer_cents = round(gross_cents * PENSION_EMPLOYER_RATE)
        other_deductions_cents = sum(c.amount_cents for c in deductions)

        net_pay_cents = gross_cents - paye_cents - pension_employee_cents - other_deductions_cents

        payslip = Payslip.objects.create(
            company=company,
            payroll_run=run,
            employee=employee,
            gross_cents=gross_cents,
            taxable_income_cents=taxable_cents,
            paye_tax_cents=paye_cents,
            pension_employee_cents=pension_employee_cents,
            pension_employer_cents=pension_employer_cents,
            other_deductions_cents=other_deductions_cents,
            net_pay_cents=net_pay_cents,
        )

        PayslipLine.objects.create(
            company=company, payslip=payslip, label="Basic Salary",
            line_type=PayslipLine.LineType.EARNING, amount_cents=basic_cents,
        )
        for c in earnings:
            PayslipLine.objects.create(
                company=company, payslip=payslip, label=c.component.name,
                line_type=PayslipLine.LineType.EARNING, amount_cents=c.amount_cents,
            )
        PayslipLine.objects.create(
            company=company, payslip=payslip, label="PAYE Income Tax",
            line_type=PayslipLine.LineType.DEDUCTION, amount_cents=paye_cents,
        )
        PayslipLine.objects.create(
            company=company, payslip=payslip, label="Pension (Employee 7%)",
            line_type=PayslipLine.LineType.DEDUCTION, amount_cents=pension_employee_cents,
        )
        for c in deductions:
            PayslipLine.objects.create(
                company=company, payslip=payslip, label=c.component.name,
                line_type=PayslipLine.LineType.DEDUCTION, amount_cents=c.amount_cents,
            )

    from apps.accounting.posting import post_payroll_run_journal

    post_payroll_run_journal(run)

    run.status = run.Status.PROCESSED
    run.processed_at = timezone.now()
    run.save(update_fields=["status", "processed_at"])
    log_audit(
        request,
        run,
        AuditLog.Action.UPDATED,
        {"status": ["draft", "processed"], "employees_paid": [None, employees.count()]},
    )


@transaction.atomic
def mark_payroll_run_paid(request, run):
    """Posts the cash-disbursement entry for a Processed run's net pay
    and flips it to Paid — the payroll mirror of a Payment clearing a
    Bill."""
    from apps.accounting.posting import post_payroll_payment_journal
    from apps.auditlog.models import AuditLog
    from apps.auditlog.services import log_audit

    if run.status != run.Status.PROCESSED:
        raise ValidationError("Only a processed payroll run can be marked paid.")

    post_payroll_payment_journal(run)

    run.status = run.Status.PAID
    run.paid_at = timezone.now()
    run.save(update_fields=["status", "paid_at"])
    log_audit(request, run, AuditLog.Action.UPDATED, {"status": ["processed", "paid"]})
