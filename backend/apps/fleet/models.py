from django.db import models

from apps.common.models import TenantModel
from apps.hr.models import Employee


class Vehicle(TenantModel):
    """A company vehicle — designed fresh, Odoo-inspired: neither
    MiranErp nor CoreERP has fleet management. Deliberately minimal:
    just the vehicle record and who's driving it (`VehicleAssignment`
    below), not a maintenance/service-log or fuel-log system — the same
    "no template/automation layer without a concrete second
    requirement" scope call `OnboardingTask` makes."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        MAINTENANCE = "maintenance", "In maintenance"
        RETIRED = "retired", "Retired"

    registration_number = models.CharField(max_length=32)
    make = models.CharField(max_length=100, blank=True)
    model = models.CharField(max_length=100, blank=True)
    year = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "fleet_vehicles"
        constraints = [
            models.UniqueConstraint(
                fields=["company", "registration_number"], name="unique_company_vehicle_registration"
            )
        ]
        ordering = ["registration_number"]

    @property
    def current_assignment(self):
        return self.assignments.filter(end_date__isnull=True).order_by("-start_date").first()

    def __str__(self):
        return self.registration_number


class VehicleAssignment(TenantModel):
    """One employee's stretch of driving one Vehicle. `end_date` null
    means still ongoing — the same "open until closed" shape `Loan`'s
    own balance tracking uses, just for who's holding the vehicle
    rather than how much is owed. Serializer-level validation keeps at
    most one open (`end_date` null) assignment per vehicle at a time,
    so "who's currently assigned this vehicle" always has one answer,
    not a real DB constraint (a partial unique index would need raw SQL
    this project's migration style otherwise avoids for a single-field
    invariant like this)."""

    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="assignments")
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="vehicle_assignments")
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "fleet_vehicle_assignments"
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.vehicle} — {self.employee}"
