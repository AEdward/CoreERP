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

from apps.procurement.models import Bill
from apps.sales.models import Invoice

from .models import JournalEntry, Payment
from .posting import post_bill_journal, post_invoice_journal, post_payment_journal


@receiver(post_save, sender=Invoice)
def handle_invoice_saved(sender, instance, **kwargs):
    if not instance.invoice_number:
        return
    if JournalEntry.objects.filter(company=instance.company, reference=instance.invoice_number).exists():
        return
    post_invoice_journal(instance)


@receiver(post_save, sender=Bill)
def handle_bill_saved(sender, instance, **kwargs):
    if not instance.bill_number:
        return
    if JournalEntry.objects.filter(company=instance.company, reference=instance.bill_number).exists():
        return
    post_bill_journal(instance)


@receiver(post_save, sender=Payment)
def handle_payment_created(sender, instance, created, **kwargs):
    if not created:
        return
    post_payment_journal(instance)

    # Full-payment-only status flip — no partial-payment tracking on
    # Invoice/Bill yet (see Payment's docstring).
    target = instance.invoice or instance.bill
    total_due = target.amount_cents + target.tax_amount_cents
    total_paid = sum(p.amount_cents for p in target.payments.all())
    if total_paid >= total_due:
        target.status = target.Status.PAID
        target.save(update_fields=["status"])
