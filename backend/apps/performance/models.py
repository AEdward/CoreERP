from django.db import models

from apps.common.models import TenantModel
from apps.hr.models import Employee


class PerformanceReview(TenantModel):
    """A single review of one employee over one stated period, written
    up by a reviewer (typically their manager). `rating` is a plain 1-5
    scale, not a configurable rubric/competency-matrix builder — the
    same "no template/automation layer without a concrete second
    requirement" scope call `OnboardingTask` makes. Stays Draft until
    the reviewer is done editing, then flips to Completed and frozen —
    the same two-state "book it, then it's final" shape `EmployeeContract`
    documents already use for facts-of-record, just without a GL
    posting side effect."""

    class Rating(models.IntegerChoices):
        UNSATISFACTORY = 1, "1 — Unsatisfactory"
        NEEDS_IMPROVEMENT = 2, "2 — Needs improvement"
        MEETS_EXPECTATIONS = 3, "3 — Meets expectations"
        EXCEEDS_EXPECTATIONS = 4, "4 — Exceeds expectations"
        OUTSTANDING = 5, "5 — Outstanding"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        COMPLETED = "completed", "Completed"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="performance_reviews")
    reviewer = models.ForeignKey(
        Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    review_period = models.CharField(max_length=50, help_text='e.g. "2026 Q3" or "H1 2026"')
    rating = models.PositiveSmallIntegerField(choices=Rating.choices, null=True, blank=True)
    comments = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "performance_reviews"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.employee} — {self.review_period}"


class TrainingProgram(TenantModel):
    """A training course/session a company runs or sends employees to —
    the catalog side; TrainingEnrollment is the per-employee attendance
    record against it."""

    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    provider = models.CharField(max_length=150, blank=True, help_text="Internal or external provider name")
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "training_programs"
        ordering = ["-start_date"]

    def __str__(self):
        return self.title


class TrainingEnrollment(TenantModel):
    class Status(models.TextChoices):
        ENROLLED = "enrolled", "Enrolled"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    program = models.ForeignKey(TrainingProgram, on_delete=models.CASCADE, related_name="enrollments")
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="training_enrollments")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ENROLLED)
    completion_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "training_enrollments"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["program", "employee"], name="unique_program_employee_enrollment"
            )
        ]

    def __str__(self):
        return f"{self.employee} — {self.program}"
