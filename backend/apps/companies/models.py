from django.conf import settings
from django.db import models


class Company(models.Model):
    class Status(models.TextChoices):
        TRIAL = "trial", "Trial"
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"

    name = models.CharField(max_length=255)
    logo_url = models.URLField(blank=True)
    industry = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    currency = models.CharField(max_length=3, default="USD")
    timezone = models.CharField(max_length=64, default="UTC")
    tax_number = models.CharField(max_length=64, blank=True)
    address = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.TRIAL)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "companies"
        verbose_name_plural = "companies"
        ordering = ["name"]

    def __str__(self):
        return self.name


class CompanyMembership(models.Model):
    """The join between a User and a Company they belong to.

    A user can hold a membership in more than one company (e.g. a
    consultant working with several clients); each membership carries its
    own set of Roles via MembershipRole (see apps.roles.models).
    """

    class Status(models.TextChoices):
        INVITED = "invited", "Invited"
        ACTIVE = "active", "Active"
        REVOKED = "revoked", "Revoked"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships"
    )
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="memberships")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.INVITED)

    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "company_memberships"
        constraints = [
            models.UniqueConstraint(fields=["user", "company"], name="unique_user_company_membership")
        ]

    def __str__(self):
        return f"{self.user_id} @ {self.company_id} ({self.status})"
