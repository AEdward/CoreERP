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
