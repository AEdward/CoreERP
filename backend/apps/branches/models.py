from django.db import models

from apps.common.models import TenantModel


class Branch(TenantModel):
    """A physical location a company operates from — a hotel property, a
    retail storefront, a sales office. Optional on the models where
    "which location" is meaningful today (Department, Employee,
    Warehouse); other modules can add the same FK later without touching
    this model."""

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=20, blank=True)
    address = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "branches"
        verbose_name_plural = "branches"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_branch_name")
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name
