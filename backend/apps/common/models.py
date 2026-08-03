from django.db import models

from apps.companies.models import Company


class TenantModel(models.Model):
    """Every Phase 2+ business table starts here — one FK, one pattern,
    reused everywhere rather than redeclared per model. related_name="+"
    because "give me all FooModels for this company" always goes through
    FooModel.objects.filter(company=...), never company.foomodel_set.
    """

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True


class NumberSequence(models.Model):
    """One row per (company, code) — e.g. (Acme Inc, "INV") — holding the
    last value issued. See apps.common.numbering.next_number for the
    atomic increment; nothing else should touch last_value directly."""

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="+")
    code = models.CharField(max_length=20)
    last_value = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "number_sequences"
        constraints = [
            models.UniqueConstraint(fields=["company", "code"], name="unique_company_sequence")
        ]

    def __str__(self):
        return f"{self.company_id}:{self.code} -> {self.last_value}"
