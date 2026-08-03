from django.db import models

from apps.branches.models import Branch
from apps.common.models import TenantModel


class Department(TenantModel):
    name = models.CharField(max_length=100)
    branch = models.ForeignKey(
        Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name="departments"
    )

    class Meta:
        db_table = "departments"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_department_name")
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class Employee(TenantModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ON_LEAVE = "on_leave", "On leave"
        TERMINATED = "terminated", "Terminated"

    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    position = models.CharField(max_length=100, blank=True)
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="employees"
    )
    branch = models.ForeignKey(
        Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name="employees"
    )
    salary_cents = models.BigIntegerField(default=0)
    joining_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)

    class Meta:
        db_table = "employees"
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"
