from django.db import models

from apps.common.models import TenantModel
from apps.hr.models import Employee


class ReviewCycle(TenantModel):
    """Groups several PerformanceReviews — self, manager, peer, and
    however many others — for the same employee over the same stated
    period: the "360°" multiple-rater view a single PerformanceReview
    alone doesn't provide (that model is one reviewer's write-up).
    Designed fresh, no MiranErp/CoreERP model to port. `cycle` on
    PerformanceReview is nullable — standalone one-reviewer reviews
    keep working exactly as before; a company only creates a
    ReviewCycle when it actually wants the 360° shape for a given
    employee/period. Closing a cycle doesn't require every attached
    review to be Completed first — an incomplete review is a fact, not
    a blocker, same as PerformanceReview's own Draft/Completed states
    not gating anything else project-wide."""

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        CLOSED = "closed", "Closed"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="review_cycles")
    review_period = models.CharField(max_length=50, help_text='e.g. "2026 Q3" or "H1 2026"')
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "performance_review_cycles"
        ordering = ["-created_at"]

    @property
    def average_rating(self):
        ratings = [r.rating for r in self.reviews.all() if r.rating is not None]
        if not ratings:
            return None
        return round(sum(ratings) / len(ratings), 2)

    def __str__(self):
        return f"{self.employee} — {self.review_period} (360°)"


class PerformanceReview(TenantModel):
    """A single review of one employee over one stated period, written
    up by a reviewer (typically their manager). `rating` is a plain 1-5
    scale, not a configurable rubric/competency-matrix builder — the
    same "no template/automation layer without a concrete second
    requirement" scope call `OnboardingTask` makes. Stays Draft until
    the reviewer is done editing, then flips to Completed and frozen —
    the same two-state "book it, then it's final" shape `EmployeeContract`
    documents already use for facts-of-record, just without a GL
    posting side effect.

    `cycle` + `rater_type` are the 360° extension: when a review belongs
    to a ReviewCycle, `rater_type` records which angle it represents
    (self/manager/peer/other) — nothing enforces one-per-type, a cycle
    can hold as many peer reviews as a company wants."""

    class Rating(models.IntegerChoices):
        UNSATISFACTORY = 1, "1 — Unsatisfactory"
        NEEDS_IMPROVEMENT = 2, "2 — Needs improvement"
        MEETS_EXPECTATIONS = 3, "3 — Meets expectations"
        EXCEEDS_EXPECTATIONS = 4, "4 — Exceeds expectations"
        OUTSTANDING = 5, "5 — Outstanding"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        COMPLETED = "completed", "Completed"

    class RaterType(models.TextChoices):
        SELF = "self", "Self"
        MANAGER = "manager", "Manager"
        PEER = "peer", "Peer"
        OTHER = "other", "Other"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="performance_reviews")
    reviewer = models.ForeignKey(
        Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    cycle = models.ForeignKey(
        ReviewCycle, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviews"
    )
    rater_type = models.CharField(max_length=16, choices=RaterType.choices, default=RaterType.MANAGER)
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
