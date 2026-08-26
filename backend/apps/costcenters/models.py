from django.db import models

from apps.common.models import TenantModel


class CostCenter(TenantModel):
    """A cost-allocation bucket for reporting — "Front Office", "F&B",
    "Marketing" — independent of Branch (which location) and Department
    (which team); a cost center often cuts across both. Same shallow
    reference-table shape as apps.branches.Branch: optional FK added
    where "which cost center" is meaningful today (Department, Employee
    — see apps.hr.models), extended elsewhere only when a real need
    shows up, same restraint Branch's own docstring documents."""

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "cost_centers"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_cost_center_name")
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name
