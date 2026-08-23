"""The one place a business event turns into a journal entry.

Called from signals.py (Invoice/Bill/Payment creation) — never called
directly by a serializer or view, so the posting rules live in exactly
one place regardless of which module triggered the event.
"""

from django.db import transaction

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
