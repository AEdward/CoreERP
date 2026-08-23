"""Turns order/invoice/bill lines into a tax total in cents, each line
taxed according to its own item's configured TaxRate. Comparing with
MiranErp's apps.tax.engine confirmed the general shape of this
computation; its tax-inclusive hotel-folio-charge variant is
industry-specific and stays out of Core, since CoreERP's line items are
always net-of-tax (tax is added on top, never extracted from a
tax-inclusive total)."""

from decimal import ROUND_HALF_UP, Decimal


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
