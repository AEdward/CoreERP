"""The one place a business event turns into a journal entry.

Called from signals.py (Invoice/Bill/Payment creation) — never called
directly by a serializer or view, so the posting rules live in exactly
one place regardless of which module triggered the event.
"""

from django.db import transaction
from django.db.models import Sum

from .models import Account, JournalEntry, JournalLine


class PostingError(Exception):
    """A required well-known account (Cash, AR, AP, ...) isn't
    configured for this company — the default chart of accounts seed
    (apps.accounting.seed) should have created it at company creation
    time; this only fires if that step was skipped or the account was
    since deleted."""


def _get_account(company, role):
    try:
        return Account.objects.get(company=company, role=role)
    except Account.DoesNotExist as exc:
        raise PostingError(
            f"No account with role={role!r} configured for {company} — "
            "run apps.accounting.seed.create_default_accounts_for_company."
        ) from exc


@transaction.atomic
def post_invoice_journal(invoice):
    """Issuing an invoice books the sale and the receivable at once:
    Dr Accounts Receivable (amount + tax), Cr Sales Revenue (amount),
    Cr Tax Payable (tax, if any)."""
    company = invoice.company
    ar = _get_account(company, Account.Role.ACCOUNTS_RECEIVABLE)
    revenue = _get_account(company, Account.Role.SALES_REVENUE)

    entry = JournalEntry.objects.create(
        company=company, reference=invoice.invoice_number, memo=f"Invoice {invoice.invoice_number}"
    )
    JournalLine.objects.create(
        company=company,
        journal_entry=entry,
        account=ar,
        debit_cents=invoice.amount_cents + invoice.tax_amount_cents,
    )
    JournalLine.objects.create(
        company=company, journal_entry=entry, account=revenue, credit_cents=invoice.amount_cents
    )
    if invoice.tax_amount_cents:
        tax_payable = _get_account(company, Account.Role.TAX_PAYABLE)
        JournalLine.objects.create(
            company=company,
            journal_entry=entry,
            account=tax_payable,
            credit_cents=invoice.tax_amount_cents,
        )


@transaction.atomic
def post_credit_note_journal(credit_note):
    """A Credit Note is the exact reverse of the Invoice entry it's
    against: Dr Sales Revenue, Dr Tax Payable (if any), Cr Accounts
    Receivable — the sale is partly un-booked and what's owed drops."""
    company = credit_note.company
    ar = _get_account(company, Account.Role.ACCOUNTS_RECEIVABLE)
    revenue = _get_account(company, Account.Role.SALES_REVENUE)

    entry = JournalEntry.objects.create(
        company=company,
        reference=credit_note.credit_note_number,
        memo=f"Credit Note {credit_note.credit_note_number} (against {credit_note.invoice})",
    )
    JournalLine.objects.create(
        company=company, journal_entry=entry, account=revenue, debit_cents=credit_note.amount_cents
    )
    if credit_note.tax_amount_cents:
        tax_payable = _get_account(company, Account.Role.TAX_PAYABLE)
        JournalLine.objects.create(
            company=company,
            journal_entry=entry,
            account=tax_payable,
            debit_cents=credit_note.tax_amount_cents,
        )
    JournalLine.objects.create(
        company=company,
        journal_entry=entry,
        account=ar,
        credit_cents=credit_note.amount_cents + credit_note.tax_amount_cents,
    )


@transaction.atomic
def post_bill_journal(bill):
    """Receiving a supplier bill books the expense and the payable:
    Dr Default Expense (amount + tax — MVP simplification, doesn't
    split out input-tax as a separate recoverable asset), Cr Accounts
    Payable."""
    company = bill.company
    ap = _get_account(company, Account.Role.ACCOUNTS_PAYABLE)
    expense = _get_account(company, Account.Role.DEFAULT_EXPENSE)

    entry = JournalEntry.objects.create(
        company=company, reference=bill.bill_number, memo=f"Bill {bill.bill_number}"
    )
    JournalLine.objects.create(
        company=company,
        journal_entry=entry,
        account=expense,
        debit_cents=bill.amount_cents + bill.tax_amount_cents,
    )
    JournalLine.objects.create(
        company=company,
        journal_entry=entry,
        account=ap,
        credit_cents=bill.amount_cents + bill.tax_amount_cents,
    )


@transaction.atomic
def post_purchase_return_journal(purchase_return):
    """A Purchase Return (Debit Note) is the exact reverse of the Bill
    entry it's against: Dr Accounts Payable, Cr Default Expense — the
    same combined amount+tax treatment post_bill_journal uses (no
    separate input-tax split), so the reversal matches it line for
    line."""
    company = purchase_return.company
    ap = _get_account(company, Account.Role.ACCOUNTS_PAYABLE)
    expense = _get_account(company, Account.Role.DEFAULT_EXPENSE)
    total = purchase_return.amount_cents + purchase_return.tax_amount_cents

    entry = JournalEntry.objects.create(
        company=company,
        reference=purchase_return.debit_note_number,
        memo=f"Debit Note {purchase_return.debit_note_number} (against {purchase_return.bill})",
    )
    JournalLine.objects.create(company=company, journal_entry=entry, account=ap, debit_cents=total)
    JournalLine.objects.create(company=company, journal_entry=entry, account=expense, credit_cents=total)


@transaction.atomic
def post_expense_journal(expense):
    """An approved employee expense claim books exactly like a supplier
    Bill — Dr Default Expense, Cr Accounts Payable — since it's the same
    kind of obligation (money owed to someone outside the cash account),
    just owed to an employee instead of a supplier. Clearing it later
    (a Payment with `expense` set) reuses post_payment_journal's existing
    "paid" branch unchanged, which already just debits Accounts Payable
    regardless of what it's against."""
    company = expense.company
    ap = _get_account(company, Account.Role.ACCOUNTS_PAYABLE)
    expense_account = _get_account(company, Account.Role.DEFAULT_EXPENSE)

    entry = JournalEntry.objects.create(
        company=company,
        reference=f"EXP-{expense.pk}",
        memo=f"Expense: {expense.employee} — {expense.category}",
    )
    JournalLine.objects.create(
        company=company, journal_entry=entry, account=expense_account, debit_cents=expense.amount_cents
    )
    JournalLine.objects.create(
        company=company, journal_entry=entry, account=ap, credit_cents=expense.amount_cents
    )


@transaction.atomic
def post_payment_journal(payment):
    """Cash actually moving clears the receivable/payable it's against:
    - received: Dr Cash, Cr Accounts Receivable
    - paid: Dr Accounts Payable, Cr Cash
    """
    company = payment.company
    cash = _get_account(company, Account.Role.CASH)

    entry = JournalEntry.objects.create(
        company=company,
        reference=payment.reference or f"Payment #{payment.id}",
        memo=f"Payment {payment.get_direction_display()}",
    )
    if payment.direction == payment.Direction.RECEIVED:
        ar = _get_account(company, Account.Role.ACCOUNTS_RECEIVABLE)
        JournalLine.objects.create(
            company=company, journal_entry=entry, account=cash, debit_cents=payment.amount_cents
        )
        JournalLine.objects.create(
            company=company, journal_entry=entry, account=ar, credit_cents=payment.amount_cents
        )
    else:
        ap = _get_account(company, Account.Role.ACCOUNTS_PAYABLE)
        JournalLine.objects.create(
            company=company, journal_entry=entry, account=ap, debit_cents=payment.amount_cents
        )
        JournalLine.objects.create(
            company=company, journal_entry=entry, account=cash, credit_cents=payment.amount_cents
        )


def _account_balance(account):
    totals = account.journal_lines.aggregate(debit=Sum("debit_cents"), credit=Sum("credit_cents"))
    return totals["debit"] or 0, totals["credit"] or 0


@transaction.atomic
def post_period_close_journal(period):
    """The standard closing-entry mechanism: zero every Revenue/Expense
    account's current balance into Retained Earnings in one entry. Skips
    an account with no activity — JournalLine's debit-xor-credit
    constraint doesn't allow a zero/zero line — and skips the whole entry
    if there's nothing to close at all (a brand new company's first
    period, say). Returns the net income that was closed, so the caller
    can snapshot it onto the period.
    """
    company = period.company
    retained_earnings = _get_account(company, Account.Role.RETAINED_EARNINGS)

    zeroing_lines = []
    total_revenue = 0
    total_expense = 0
    for account in Account.objects.filter(
        company=company, type__in=[Account.Type.REVENUE, Account.Type.EXPENSE]
    ):
        debit, credit = _account_balance(account)
        if account.type == Account.Type.REVENUE:
            balance = credit - debit
            if balance:
                total_revenue += balance
                zeroing_lines.append((account, balance, 0))  # debit it down to zero
        else:
            balance = debit - credit
            if balance:
                total_expense += balance
                zeroing_lines.append((account, 0, balance))  # credit it down to zero

    net_income = total_revenue - total_expense
    if not zeroing_lines:
        return 0

    entry = JournalEntry.objects.create(
        company=company, reference=f"CLOSE-{period.pk}", memo=f"Period close: {period.label}"
    )
    for account, debit_cents, credit_cents in zeroing_lines:
        JournalLine.objects.create(
            company=company,
            journal_entry=entry,
            account=account,
            debit_cents=debit_cents,
            credit_cents=credit_cents,
        )
    if net_income > 0:
        JournalLine.objects.create(
            company=company, journal_entry=entry, account=retained_earnings, credit_cents=net_income
        )
    elif net_income < 0:
        JournalLine.objects.create(
            company=company, journal_entry=entry, account=retained_earnings, debit_cents=-net_income
        )

    return net_income


@transaction.atomic
def post_petty_cash_transaction_journal(txn):
    """Disbursement: Dr Default Expense, Cr the fund's own account.
    Replenishment: Dr the fund's account, Cr the company's main Cash
    account — topping the float back up to its imprest amount."""
    company = txn.company
    fund_account = txn.fund.account

    entry = JournalEntry.objects.create(
        company=company, reference=f"PETTY-{txn.pk}", memo=f"{txn.get_type_display()}: {txn.fund.name}"
    )
    if txn.type == txn.Type.DISBURSEMENT:
        expense = _get_account(company, Account.Role.DEFAULT_EXPENSE)
        JournalLine.objects.create(
            company=company, journal_entry=entry, account=expense, debit_cents=txn.amount_cents
        )
        JournalLine.objects.create(
            company=company, journal_entry=entry, account=fund_account, credit_cents=txn.amount_cents
        )
    else:
        cash = _get_account(company, Account.Role.CASH)
        JournalLine.objects.create(
            company=company, journal_entry=entry, account=fund_account, debit_cents=txn.amount_cents
        )
        JournalLine.objects.create(
            company=company, journal_entry=entry, account=cash, credit_cents=txn.amount_cents
        )


@transaction.atomic
def post_depreciation_journal(asset, *, on_date):
    """One month's straight-line depreciation: Dr Depreciation Expense,
    Cr Accumulated Depreciation, capped so accumulated depreciation never
    runs past cost minus salvage value. The caller (FixedAssetViewSet's
    `depreciate` action) is responsible for the once-per-calendar-month
    guard via `last_depreciated_on` — this function just posts whatever
    amount it's given room to post. Returns the amount actually posted
    (0 if the asset is already fully depreciated)."""
    company = asset.company
    depreciation_expense = _get_account(company, Account.Role.DEPRECIATION_EXPENSE)
    accumulated_depreciation = _get_account(company, Account.Role.ACCUMULATED_DEPRECIATION)

    remaining = asset.cost_cents - asset.salvage_value_cents - asset.accumulated_depreciation_cents
    amount = min(asset.monthly_depreciation_cents, remaining)
    if amount <= 0:
        return 0

    entry = JournalEntry.objects.create(
        company=company,
        reference=f"DEPR-{asset.pk}-{on_date.strftime('%Y-%m')}",
        memo=f"Depreciation: {asset.name}",
    )
    JournalLine.objects.create(
        company=company, journal_entry=entry, account=depreciation_expense, debit_cents=amount
    )
    JournalLine.objects.create(
        company=company, journal_entry=entry, account=accumulated_depreciation, credit_cents=amount
    )
    return amount


@transaction.atomic
def post_payroll_run_journal(run):
    """Processing a payroll run books the whole cycle's obligation in
    one entry, aggregated across every employee's Payslip rather than
    one entry per employee (same "one entry for the whole sweep"
    reasoning post_period_close_journal uses): Dr Salary Expense (total
    gross), Dr Pension Expense (total employer 11% — a real additional
    cost to the company, not deducted from anyone's pay), Cr Payroll
    Payable (total net pay — what's actually owed to employees until
    paid), Cr PAYE Payable (withheld income tax owed to the tax
    authority), Cr Pension Payable (both employee 7% and employer 11%,
    owed to the pension fund), Cr Other Payroll Deductions Payable (any
    custom SalaryComponent deduction — a company-defined recovery/
    deduction with no more specific destination), Cr Employee Loan
    Receivable (loan installments collected via payroll this run — this
    one reduces an *asset*, not a liability, since the loan itself was
    money owed *to* the company; see post_loan_disbursement_journal).

    Every deduction subtracted from gross to reach net_pay needs a real
    credit destination or this entry doesn't balance — a real bug this
    project shipped with initially and only caught while building Loans:
    other_deductions_cents was silently dropped, leaving every run with
    any custom deduction assigned unbalanced by exactly that amount."""
    company = run.company
    salary_expense = _get_account(company, Account.Role.SALARY_EXPENSE)
    pension_expense = _get_account(company, Account.Role.PENSION_EXPENSE)
    payroll_payable = _get_account(company, Account.Role.PAYROLL_PAYABLE)
    paye_payable = _get_account(company, Account.Role.PAYE_PAYABLE)
    pension_payable = _get_account(company, Account.Role.PENSION_PAYABLE)
    deductions_payable = _get_account(company, Account.Role.PAYROLL_DEDUCTIONS_PAYABLE)
    loan_receivable = _get_account(company, Account.Role.EMPLOYEE_LOAN_RECEIVABLE)

    totals = run.payslips.aggregate(
        gross=Sum("gross_cents"),
        paye=Sum("paye_tax_cents"),
        pension_employee=Sum("pension_employee_cents"),
        pension_employer=Sum("pension_employer_cents"),
        other_deductions=Sum("other_deductions_cents"),
        loan_repayment=Sum("loan_repayment_cents"),
        net_pay=Sum("net_pay_cents"),
    )
    gross = totals["gross"] or 0
    paye = totals["paye"] or 0
    pension_employee = totals["pension_employee"] or 0
    pension_employer = totals["pension_employer"] or 0
    other_deductions = totals["other_deductions"] or 0
    loan_repayment = totals["loan_repayment"] or 0
    net_pay = totals["net_pay"] or 0
    total_pension = pension_employee + pension_employer

    entry = JournalEntry.objects.create(
        company=company, reference=f"PAYROLL-{run.pk}", memo=f"Payroll run: {run.label}"
    )
    JournalLine.objects.create(
        company=company, journal_entry=entry, account=salary_expense, debit_cents=gross
    )
    if pension_employer:
        JournalLine.objects.create(
            company=company, journal_entry=entry, account=pension_expense, debit_cents=pension_employer
        )
    JournalLine.objects.create(
        company=company, journal_entry=entry, account=payroll_payable, credit_cents=net_pay
    )
    if paye:
        JournalLine.objects.create(
            company=company, journal_entry=entry, account=paye_payable, credit_cents=paye
        )
    if total_pension:
        JournalLine.objects.create(
            company=company, journal_entry=entry, account=pension_payable, credit_cents=total_pension
        )
    if other_deductions:
        JournalLine.objects.create(
            company=company, journal_entry=entry, account=deductions_payable, credit_cents=other_deductions
        )
    if loan_repayment:
        JournalLine.objects.create(
            company=company, journal_entry=entry, account=loan_receivable, credit_cents=loan_repayment
        )


@transaction.atomic
def post_payroll_payment_journal(run):
    """Paying out a processed run's net wages: Dr Payroll Payable, Cr
    Cash — the same "clear the obligation, move cash" shape a Payment
    against a Bill already uses, just for the payroll run's aggregate net
    pay instead of one supplier's balance."""
    company = run.company
    payroll_payable = _get_account(company, Account.Role.PAYROLL_PAYABLE)
    cash = _get_account(company, Account.Role.CASH)

    net_pay = run.payslips.aggregate(net_pay=Sum("net_pay_cents"))["net_pay"] or 0

    entry = JournalEntry.objects.create(
        company=company, reference=f"PAYROLL-PAY-{run.pk}", memo=f"Payroll payment: {run.label}"
    )
    JournalLine.objects.create(
        company=company, journal_entry=entry, account=payroll_payable, debit_cents=net_pay
    )
    JournalLine.objects.create(company=company, journal_entry=entry, account=cash, credit_cents=net_pay)


@transaction.atomic
def post_loan_disbursement_journal(loan):
    """Disbursing an employee loan: Dr Employee Loan Receivable, Cr Cash
    — the company hands over cash and gains an asset (money owed back by
    the employee), same shape as any other cash outlay that creates a
    receivable. Repayments collected via payroll reduce this same
    account (see post_payroll_run_journal's loan_receivable credit
    line) rather than creating a new liability — the loan was always an
    asset, repaying it just shrinks that asset back toward zero."""
    company = loan.company
    loan_receivable = _get_account(company, Account.Role.EMPLOYEE_LOAN_RECEIVABLE)
    cash = _get_account(company, Account.Role.CASH)

    entry = JournalEntry.objects.create(
        company=company,
        reference=loan.loan_number,
        memo=f"Loan disbursed: {loan.employee}",
    )
    JournalLine.objects.create(
        company=company, journal_entry=entry, account=loan_receivable, debit_cents=loan.principal_cents
    )
    JournalLine.objects.create(
        company=company, journal_entry=entry, account=cash, credit_cents=loan.principal_cents
    )
