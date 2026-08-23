from django.conf import settings
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


class Contact(TenantModel):
    """A named person at a Customer — closes the module map's "(partial)
    Contacts" gap (Customer alone only has one phone/email, no way to
    represent "this account has three people we deal with"). Deliberately
    just a flat list per customer, no separate contact-level permissions
    or its own login — that's Customer Portal territory, a different,
    much bigger, not-yet-triggered item."""

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="contacts")
    name = models.CharField(max_length=255)
    title = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = "contacts"
        ordering = ["-is_primary", "name"]

    def __str__(self):
        return f"{self.name} ({self.customer})"


class Lead(TenantModel):
    """A prospect who isn't a Customer yet — the front of the pipeline
    the module map flags as entirely missing. Deliberately not a
    Customer subtype or an Opportunity with no customer attached: a Lead
    might not convert at all, and letting an unqualified prospect show up
    everywhere a real Customer does (invoicing, sales orders) would be
    wrong. `convert()` is the one bridge between the two worlds."""

    class Status(models.TextChoices):
        NEW = "new", "New"
        CONTACTED = "contacted", "Contacted"
        QUALIFIED = "qualified", "Qualified"
        DISQUALIFIED = "disqualified", "Disqualified"
        CONVERTED = "converted", "Converted"

    name = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    source = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW)
    notes = models.TextField(blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    converted_customer = models.ForeignKey(
        Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "leads"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class Opportunity(TenantModel):
    """A deal in progress against a real Customer — the Sales Pipeline
    the module map flags as missing. Stage is a flat pipeline, not a
    configurable/branching one (no per-company custom stages yet — the
    same "wait for a real trigger" call this project makes elsewhere
    before adding configurability nobody's asked for)."""

    class Stage(models.TextChoices):
        PROSPECTING = "prospecting", "Prospecting"
        QUALIFICATION = "qualification", "Qualification"
        PROPOSAL = "proposal", "Proposal"
        NEGOTIATION = "negotiation", "Negotiation"
        WON = "won", "Won"
        LOST = "lost", "Lost"

    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="opportunities")
    lead = models.ForeignKey(
        Lead, on_delete=models.SET_NULL, null=True, blank=True, related_name="opportunities"
    )
    name = models.CharField(max_length=255)
    stage = models.CharField(max_length=16, choices=Stage.choices, default=Stage.PROSPECTING)
    amount_cents = models.BigIntegerField(default=0)
    expected_close_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "opportunities"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.customer})"
