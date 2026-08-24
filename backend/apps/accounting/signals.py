"""Wires business events to journal postings without apps.sales or
apps.procurement needing to import apps.accounting at all — this app
reaches out to theirs (via string FKs/signals), not the other way
around.

Invoice/Bill both use a two-step save (create, then set the generated
invoice_number/bill_number — see their serializers): post_save fires
once with the number still blank, then again once it's set. Posting is
keyed on "number is set and nothing's posted against it yet" rather
than created=True, so it fires exactly once, on the second save, and
is naturally idempotent against any later re-save (e.g. a status
change).
"""

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.expenses.models import Expense
from apps.notifications.services import notify_permission
from apps.procurement.models import Bill, PurchaseReturn
from apps.sales.models import CreditNote, Invoice

from .models import JournalEntry, Payment
from .posting import (
    post_bill_journal,
    post_credit_note_journal,
    post_expense_journal,
    post_invoice_journal,
    post_payment_journal,
    post_purchase_return_journal,
)


def _maybe_mark_invoice_paid(invoice):
    """A Credit Note settles what's owed on an Invoice exactly like a
    Payment does, just without cash moving — reusing Invoice.Status.PAID
    for "nothing more owed, however that happened" rather than adding a
    separate "credited"/"written off" status is a documented known
    simplification, not an oversight."""
    total_due = invoice.amount_cents + invoice.tax_amount_cents
    total_settled = sum(p.amount_cents for p in invoice.payments.all()) + sum(
        cn.amount_cents + cn.tax_amount_cents for cn in invoice.credit_notes.all()
    )
    if total_settled >= total_due:
        invoice.status = invoice.Status.PAID
        invoice.save(update_fields=["status"])


def _maybe_mark_bill_paid(bill):
    """The Accounts Payable mirror of _maybe_mark_invoice_paid — a
    Purchase Return settles what's owed on a Bill exactly like a Payment
    does, just without cash moving."""
    total_due = bill.amount_cents + bill.tax_amount_cents
    total_settled = sum(p.amount_cents for p in bill.payments.all()) + sum(
        pr.amount_cents + pr.tax_amount_cents for pr in bill.purchase_returns.all()
    )
    if total_settled >= total_due:
        bill.status = bill.Status.PAID
        bill.save(update_fields=["status"])


@receiver(post_save, sender=Invoice)
def handle_invoice_saved(sender, instance, **kwargs):
    if not instance.invoice_number:
        return
    if JournalEntry.objects.filter(company=instance.company, reference=instance.invoice_number).exists():
        return
    post_invoice_journal(instance)


@receiver(post_save, sender=CreditNote)
def handle_credit_note_saved(sender, instance, **kwargs):
    if not instance.credit_note_number:
        return
    if JournalEntry.objects.filter(
        company=instance.company, reference=instance.credit_note_number
    ).exists():
        return
    post_credit_note_journal(instance)
    _maybe_mark_invoice_paid(instance.invoice)


@receiver(post_save, sender=Bill)
def handle_bill_saved(sender, instance, **kwargs):
    if not instance.bill_number:
        return
    if JournalEntry.objects.filter(company=instance.company, reference=instance.bill_number).exists():
        return
    post_bill_journal(instance)
    total_due = (instance.amount_cents + instance.tax_amount_cents) / 100
    notify_permission(
        instance.company,
        "accounting",
        "manage",
        f"New bill {instance.bill_number} for {total_due:.2f} needs payment",
        link="/dashboard/accounting",
    )


@receiver(post_save, sender=PurchaseReturn)
def handle_purchase_return_saved(sender, instance, **kwargs):
    if not instance.debit_note_number:
        return
    if JournalEntry.objects.filter(
        company=instance.company, reference=instance.debit_note_number
    ).exists():
        return
    post_purchase_return_journal(instance)
    _maybe_mark_bill_paid(instance.bill)


@receiver(post_save, sender=Expense)
def handle_expense_saved(sender, instance, **kwargs):
    # No generated number to key idempotency on the way Invoice/Bill do
    # (see the module docstring) — Expense goes through apps.approvals
    # instead, so this posts once the *approval* lands rather than once
    # a number gets set. f"EXP-{pk}" is a stable, always-available key.
    if instance.status != Expense.Status.APPROVED:
        return
    reference = f"EXP-{instance.pk}"
    if JournalEntry.objects.filter(company=instance.company, reference=reference).exists():
        return
    post_expense_journal(instance)
    notify_permission(
        instance.company,
        "expenses",
        "manage",
        f"Expense approved for {instance.employee}: {instance.amount_cents / 100:.2f} ({instance.category})",
        link="/dashboard/expenses",
    )


@receiver(post_save, sender=Payment)
def handle_payment_created(sender, instance, created, **kwargs):
    if not created:
        return
    post_payment_journal(instance)

    # Full-payment-only status flip — no partial-payment tracking on
    # Invoice/Bill/Expense yet (see Payment's docstring).
    target = instance.invoice or instance.bill or instance.expense
    if isinstance(target, Invoice):
        _maybe_mark_invoice_paid(target)
        return
    if isinstance(target, Bill):
        _maybe_mark_bill_paid(target)
        return
    total_due = target.amount_cents + getattr(target, "tax_amount_cents", 0)
    total_paid = sum(p.amount_cents for p in target.payments.all())
    if total_paid >= total_due:
        target.status = target.Status.PAID
        target.save(update_fields=["status"])
