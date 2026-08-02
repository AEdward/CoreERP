from django.db import models

from apps.common.models import TenantModel


class Customer(TenantModel):
    class Type(models.TextChoices):
        INDIVIDUAL = "individual", "Individual"
        BUSINESS = "business", "Business"
        GOVERNMENT = "government", "Government"
        VIP = "vip", "VIP"

    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    type = models.CharField(max_length=16, choices=Type.choices, default=Type.INDIVIDUAL)
    address = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "customers"
        ordering = ["name"]

    def __str__(self):
        return self.name
