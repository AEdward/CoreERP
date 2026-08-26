from django.db import models

from apps.common.models import TenantModel


class TaxRate(TenantModel):
    """A configurable tax rate, replacing the old decorative flat
    `Item.tax_rate` decimal that nothing ever computed from. A company can
    have several active at once (VAT, a local sales tax, ...); which one
    applies to a given sale is driven by each Item's own `tax_rate` FK
    (apps.catalog.Item), not a single company-wide percentage — see
    apps.tax.engine.compute_line_tax_cents, called from Sales/Procurement's
    line-total serializers when an Invoice/Bill is tied to an order.

    No rates are seeded by default: unlike a single-deployment app that
    can hardcode one jurisdiction's numbers, CoreERP has no fixed tax
    jurisdiction to assume one for — a company adds its own via Settings.
    """

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20)
    rate_percent = models.DecimalField(max_digits=5, decimal_places=2)
    # Pre-selected when adding a new Item — a UX default only, the engine
    # itself only ever looks at each Item's own explicit tax_rate.
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    # Section J (Hotel & Hospitality): a hotel-specific levy (e.g. a
    # Tourism Development Levy) that stacks with is_default rates on room
    # folio charges specifically — see apps.tax.engine.compute_inclusive_tax_cents.
    # Irrelevant outside apps.hotel; every other consumer of TaxRate
    # (Sales/Procurement line items) ignores this flag entirely.
    applies_to_room_charges = models.BooleanField(default=False)

    class Meta:
        db_table = "tax_rates"
        constraints = [
            models.UniqueConstraint(fields=["company", "code"], name="unique_company_tax_rate_code")
        ]
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.rate_percent}%)"
