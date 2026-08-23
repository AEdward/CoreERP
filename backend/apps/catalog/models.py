from django.db import models

from apps.common.models import TenantModel


class Item(TenantModel):
    class Type(models.TextChoices):
        PRODUCT = "product", "Product"
        SERVICE = "service", "Service"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ARCHIVED = "archived", "Archived"

    type = models.CharField(max_length=16, choices=Type.choices, default=Type.PRODUCT)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, blank=True)
    price_cents = models.BigIntegerField(default=0)
    cost_cents = models.BigIntegerField(default=0)
    # Was a decorative flat percentage nothing computed from; now a real
    # link to a company-configured rate — see apps.tax.TaxRate and
    # apps.tax.engine.compute_line_tax_cents, which is what actually reads
    # this to total up Sales/Procurement line tax.
    tax_rate = models.ForeignKey(
        "tax.TaxRate", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)

    class Meta:
        db_table = "items"
        ordering = ["name"]

    def __str__(self):
        return self.name
