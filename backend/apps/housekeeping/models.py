from django.conf import settings
from django.db import models

from apps.common.models import TenantModel
from apps.hotel.models import Room


class HousekeepingTask(TenantModel):
    """One light model for cleaning, inspection, linen, and lost & found
    (docs/ARCHITECTURE.md §12.2) rather than a separate table per concept —
    they're all "something a housekeeper does about a room, with a status
    and an outcome", and splitting them wouldn't earn its keep yet. Revisit
    if e.g. Lost & Found needs its own fields (item description, claimed
    status) that don't fit this shape.
    """

    class TaskType(models.TextChoices):
        CLEANING = "cleaning", "Cleaning"
        INSPECTION = "inspection", "Inspection"
        LINEN = "linen", "Linen"
        LOST_AND_FOUND = "lost_and_found", "Lost & found"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        IN_PROGRESS = "in_progress", "In progress"
        DONE = "done", "Done"
        CANCELLED = "cancelled", "Cancelled"

    room = models.ForeignKey(Room, on_delete=models.PROTECT, related_name="housekeeping_tasks")
    task_type = models.CharField(max_length=16, choices=TaskType.choices)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    notes = models.TextField(blank=True)
    scheduled_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "housekeeping_tasks"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_task_type_display()} — {self.room} ({self.status})"
