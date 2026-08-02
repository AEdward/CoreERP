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
