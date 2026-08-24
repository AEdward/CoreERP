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


class Position(TenantModel):
    """Closes the module map's "(partial) Positions" gap — promotes
    Employee's old free-text `position` field to a real, reusable entity
    (so "Sales Manager" is one thing, not a slightly different string per
    employee who holds it)."""

    title = models.CharField(max_length=100)
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="positions"
    )

    class Meta:
        db_table = "positions"
        constraints = [
            models.UniqueConstraint(fields=["company", "title"], name="unique_company_position_title")
        ]
        ordering = ["title"]

    def __str__(self):
        return self.title


class Employee(TenantModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ON_LEAVE = "on_leave", "On leave"
        TERMINATED = "terminated", "Terminated"

    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    position = models.ForeignKey(
        Position, on_delete=models.SET_NULL, null=True, blank=True, related_name="employees"
    )
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


class EmployeeContract(TenantModel):
    """A real, concrete Section F gap: the formal record of an employee's
    contract terms over time (type, dates, salary at signing), separate
    from Employee.salary_cents which stays the single "current payroll
    figure" HR keeps up to date by hand — this doesn't auto-sync it, the
    same "record documents facts, doesn't auto-cascade" scope call Fixed
    Assets makes about the GL. Signed contract documents/scans attach via
    the existing generic Documents panel (registered in ALLOWED_TARGETS)."""

    class ContractType(models.TextChoices):
        PERMANENT = "permanent", "Permanent"
        FIXED_TERM = "fixed_term", "Fixed-term"
        PROBATION = "probation", "Probation"
        CONTRACTOR = "contractor", "Contractor"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="contracts")
    contract_type = models.CharField(
        max_length=16, choices=ContractType.choices, default=ContractType.PERMANENT
    )
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)  # blank = open-ended
    salary_cents = models.BigIntegerField(default=0)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "employee_contracts"
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.employee} — {self.get_contract_type_display()} ({self.start_date})"


class LeaveType(TenantModel):
    """Per-company config, e.g. "Annual Leave", "Sick Leave" — same shape
    as apps.expenses' category free text would have been, but this one's
    worth a real lookup table since LeaveRequest needs to reference it."""

    name = models.CharField(max_length=100)
    paid = models.BooleanField(default=True)

    class Meta:
        db_table = "leave_types"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_leave_type_name")
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class LeaveRequest(TenantModel):
    """Closes the module map's explicitly-flagged "Leave Management —
    real gap" item. Goes through apps.approvals the identical way
    Expense/PurchaseRequest/PurchaseOrder do (a fourth real consumer).
    Deliberately doesn't touch Employee.status on approval — flipping it
    to on_leave only while today falls inside the approved date range
    would need a scheduled daily job this project has no infrastructure
    for yet, so that stays a manual HR action, the same as it is today."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="leave_requests")
    leave_type = models.ForeignKey(LeaveType, on_delete=models.PROTECT, related_name="+")
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)

    class Meta:
        db_table = "leave_requests"
        ordering = ["-start_date"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(end_date__gte=models.F("start_date")), name="leave_end_after_start"
            )
        ]

    @property
    def days(self):
        return (self.end_date - self.start_date).days + 1

    def __str__(self):
        return f"{self.employee} — {self.leave_type} ({self.start_date} to {self.end_date})"
