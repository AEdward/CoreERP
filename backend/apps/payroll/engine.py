"""Ethiopian payroll math — the one place PAYE income tax and pension get
computed, so the computation logic lives in exactly one spot. The actual
brackets/rates are per-company configurable data now (apps.payroll.{TaxBracket,
PensionSettings}, seeded per apps.payroll.seed with Ethiopia's real defaults —
Federal Income Tax (Amendment) Proclamation No. 1395/2025 and Pension
Proclamation No. 715/2011), not hardcoded constants — a company can edit or
replace them without a code change. Pension does NOT reduce the PAYE taxable
base — both are computed on the same gross figure independently.

Bracket boundaries are stored in cents (ETB * 100) to match every other
money field in this project. Computed bracket-by-bracket (marginal rate on
each band) rather than the equivalent "flat rate minus a lookup deduction"
shortcut some payroll tools use, so a company entering arbitrary custom
brackets doesn't also have to correctly compute a matching deduction
constant — one less way to misconfigure this.
"""

from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import PensionSettings, TaxBracket


def calculate_paye_cents(company, taxable_income_cents):
    if taxable_income_cents <= 0:
        return 0
    tax = Decimal(0)
    for bracket in TaxBracket.objects.filter(company=company, is_active=True).order_by("lower_bound_cents"):
        if taxable_income_cents <= bracket.lower_bound_cents:
            break
        upper = bracket.upper_bound_cents
        band_top = min(taxable_income_cents, upper) if upper is not None else taxable_income_cents
        band_amount = band_top - bracket.lower_bound_cents
        if band_amount > 0:
            tax += Decimal(band_amount) * bracket.rate_percent / Decimal("100")
    return int(tax.to_integral_value(rounding=ROUND_HALF_UP))


def calculate_pension_cents(base_salary_cents, rate_percent):
    """rate_percent is a PensionSettings rate (e.g. Decimal('7.00')).
    Shared by both the employee-withheld share and the employer's own
    contribution — same `rate% of basic salary` formula, just different
    rates and destinations (see process_payroll_run)."""
    if base_salary_cents <= 0 or not rate_percent:
        return 0
    amount = Decimal(base_salary_cents) * rate_percent / Decimal("100")
    return int(amount.to_integral_value(rounding=ROUND_HALF_UP))


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

    from .models import EmployeeSalaryComponent, Loan, Payslip, PayslipLine, SalaryComponent

    if run.status != run.Status.DRAFT:
        raise ValidationError("Only a draft payroll run can be processed.")

    company = run.company
    employees = Employee.objects.filter(company=company).exclude(status=Employee.Status.TERMINATED)
    pension_settings = PensionSettings.objects.filter(company=company).first()
    pension_employee_rate = pension_settings.employee_rate_percent if pension_settings else 0
    pension_employer_rate = pension_settings.employer_rate_percent if pension_settings else 0

    for employee in employees:
        components = EmployeeSalaryComponent.objects.filter(employee=employee).select_related("component")
        earnings = [c for c in components if c.component.category == SalaryComponent.Category.EARNING]
        deductions = [c for c in components if c.component.category == SalaryComponent.Category.DEDUCTION]

        basic_cents = employee.effective_salary_cents
        gross_cents = basic_cents + sum(c.amount_cents for c in earnings)
        taxable_cents = basic_cents + sum(c.amount_cents for c in earnings if c.component.is_taxable)

        paye_cents = calculate_paye_cents(company, taxable_cents)
        pension_employee_cents = calculate_pension_cents(gross_cents, pension_employee_rate)
        pension_employer_cents = calculate_pension_cents(gross_cents, pension_employer_rate)
        other_deductions_cents = sum(c.amount_cents for c in deductions)

        # Installments are computed from each loan's remaining_balance_cents
        # (principal minus every repayment line posted by an *earlier* run)
        # before this run creates any new repayment lines of its own — a
        # stale read here would double-count or overshoot the balance.
        active_loans = list(Loan.objects.filter(employee=employee, status=Loan.Status.ACTIVE))
        loan_installments = [
            (loan, loan.remaining_balance_cents, min(loan.monthly_installment_cents, loan.remaining_balance_cents))
            for loan in active_loans
        ]
        loan_repayment_cents = sum(amount for _, _, amount in loan_installments)

        net_pay_cents = (
            gross_cents - paye_cents - pension_employee_cents - other_deductions_cents - loan_repayment_cents
        )

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
            loan_repayment_cents=loan_repayment_cents,
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
        for loan, pre_run_balance, amount in loan_installments:
            if amount <= 0:
                continue
            PayslipLine.objects.create(
                company=company, payslip=payslip, label=f"Loan Repayment ({loan.loan_number})",
                line_type=PayslipLine.LineType.DEDUCTION, amount_cents=amount, source_loan=loan,
            )
            if amount >= pre_run_balance:
                loan.status = Loan.Status.PAID_OFF
                loan.save(update_fields=["status"])

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
