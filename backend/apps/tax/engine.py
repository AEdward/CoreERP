"""Turns order/invoice/bill lines into a tax total in cents, each line
taxed according to its own item's configured TaxRate — CoreERP's line
items are always net-of-tax (tax is added on top). compute_inclusive_tax_cents
is the second shape, ported from MiranErp's apps.tax.engine for Section J
(Hotel & Hospitality): a hotel folio charge is posted as the full
guest-facing total, not net-of-tax, so there's nothing to add on top —
that function extracts the tax portion already baked into the total,
for reporting only, and never changes the amount itself."""

from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Q

from .models import TaxRate


def compute_line_tax_cents(lines):
    """A line whose item has no tax_rate assigned, or whose tax_rate is
    inactive, is simply skipped — an item only starts contributing tax
    once someone deliberately assigns it a rate, matching how the old
    decorative per-item field always worked, just wired up for real now.
    """
    running_total = Decimal("0")
    for line in lines:
        rate = getattr(line.item, "tax_rate", None)
        if rate is None or not rate.is_active:
            continue
        line_tax = Decimal(line.line_total_cents) * rate.rate_percent / Decimal("100")
        running_total += line_tax
    return int(running_total.to_integral_value(rounding=ROUND_HALF_UP))


def compute_inclusive_tax_cents(company, amount_cents, *, applies_to_room):
    """Extract the tax portion already baked into a tax-inclusive
    amount. `applies_to_room=True` stacks is_default rates (e.g. VAT)
    with applies_to_room_charges-only rates (e.g. a Tourism Development
    Levy) on top of each other; a non-room charge (restaurant/POS/spa/...)
    only ever sees is_default rates.
    """
    rates = TaxRate.objects.filter(company=company, is_active=True)
    rates = (
        rates.filter(Q(is_default=True) | Q(applies_to_room_charges=True))
        if applies_to_room
        else rates.filter(is_default=True)
    )
    total_rate = sum((r.rate_percent for r in rates), Decimal("0"))
    if total_rate <= 0:
        return 0
    tax = Decimal(amount_cents) * total_rate / (Decimal("100") + total_rate)
    return int(tax.to_integral_value(rounding=ROUND_HALF_UP))
