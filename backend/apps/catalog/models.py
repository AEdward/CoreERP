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
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)

    class Meta:
        db_table = "items"
        ordering = ["name"]

    def __str__(self):
        return self.name
