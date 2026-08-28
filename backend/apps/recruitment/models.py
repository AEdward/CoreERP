from django.db import models

from apps.common.models import TenantModel
from apps.hr.models import Department, Employee, Position


class JobVacancy(TenantModel):
    """An open role a company is hiring for. `openings` is just a number
    (how many hires this posting needs), not tracked per-slot — the same
    "count, not N rows" simplification ShiftTemplate makes about shift
    assignment."""

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        ON_HOLD = "on_hold", "On hold"
        CLOSED = "closed", "Closed"

    title = models.CharField(max_length=150)
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="vacancies"
    )
    position = models.ForeignKey(
        Position, on_delete=models.SET_NULL, null=True, blank=True, related_name="vacancies"
    )
    description = models.TextField(blank=True)
    openings = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    posted_date = models.DateField()

    class Meta:
        db_table = "job_vacancies"
        ordering = ["-posted_date"]

    def __str__(self):
        return self.title


class Applicant(TenantModel):
    """One person's application against a JobVacancy. `hired_employee` is
    set once `ApplicantViewSet.hire` converts this applicant into a real
    `hr.Employee` — the concrete Onboarding trigger: an applicant only
    ever becomes an employee through this one path, so hired_employee
    being set is exactly "onboarding has started" (see OnboardingTask,
    which hangs off the Employee, not the Applicant, from that point
    on). A resume/CV attaches via the existing generic Documents panel
    (see apps.common.targeting.ALLOWED_TARGETS)."""

    class Status(models.TextChoices):
        APPLIED = "applied", "Applied"
        SCREENING = "screening", "Screening"
        INTERVIEW = "interview", "Interview"
        OFFER = "offer", "Offer"
        HIRED = "hired", "Hired"
        REJECTED = "rejected", "Rejected"

    vacancy = models.ForeignKey(JobVacancy, on_delete=models.PROTECT, related_name="applicants")
    full_name = models.CharField(max_length=150)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.APPLIED)
    applied_date = models.DateField()
    notes = models.TextField(blank=True)
    hired_employee = models.ForeignKey(
        Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "applicants"
        ordering = ["-applied_date"]

    def __str__(self):
        return f"{self.full_name} — {self.vacancy}"


class OnboardingTask(TenantModel):
    """A single checklist item for a newly hired employee (e.g. "Issue
    laptop", "Complete tax forms") — a plain per-employee checklist, not
    a company-wide template engine, the same "no template/automation
    layer without a concrete second requirement" scope call this project
    keeps making (see EmployeeContract's docstring on Employee.salary_cents
    not auto-cascading)."""

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="onboarding_tasks")
    title = models.CharField(max_length=150)
    is_complete = models.BooleanField(default=False)
    due_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "onboarding_tasks"
        ordering = ["is_complete", "due_date", "id"]

    def __str__(self):
        return f"{self.title} ({self.employee})"
