"""Wires hotel checkout to automatic points earning without apps.hotel
needing to import apps.loyalty at all — same one-directional-dependency
principle as apps.accounting.signals reaching into apps.sales/
apps.procurement.

Reservation.check_out (apps/hotel/views.py) does a plain
`reservation.save(update_fields=["status"])`, so post_save fires on
every save of a Reservation, not just checkout — idempotency is keyed
on "no LoyaltyTransaction already references this reservation" rather
than `created`, same reasoning as handle_invoice_saved's number-based
idempotency check.

Earn rate (1 point per 100.00 major-currency-unit spent, i.e. per
10000 cents) is a placeholder, not a spec'd number — Miran Grand Hotel
hasn't set an actual program rate yet; this is here so "layers on CRM
once there's real stay history to program against" (TODO.md §4.5) has
something real to layer on, not a guess dressed up as policy.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.hotel.models import Reservation

from .models import LoyaltyMember, LoyaltyTransaction

POINTS_PER_CENTS_SPENT = 10000


@receiver(post_save, sender=Reservation)
def handle_reservation_checked_out(sender, instance, **kwargs):
    if instance.status != Reservation.Status.CHECKED_OUT:
        return
    if LoyaltyTransaction.objects.filter(company=instance.company, reservation=instance).exists():
        return

    try:
        member = LoyaltyMember.objects.get(company=instance.company, guest_id=instance.guest_id)
    except LoyaltyMember.DoesNotExist:
        return

    folio = getattr(instance, "folio", None)
    if folio is None:
        return

    points = folio.balance_cents // POINTS_PER_CENTS_SPENT
    if points <= 0:
        return

    LoyaltyTransaction.objects.create(
        company=instance.company,
        member=member,
        points=points,
        reason=f"Stay checkout — {instance.confirmation_number}",
        reservation=instance,
    )
