from django.conf import settings
from django.db import models

from apps.common.models import TenantModel


class Task(TenantModel):
    """A standalone, company-wide task list — not tied to any other
    record. Kept simple on purpose: no generic content_type/object_id
    link to "attach a task to an Invoice" the way Documents does, since
    nothing has needed that yet. Add it if and when something does."""

    class Status(models.TextChoices):
        TODO = "todo", "To do"
        IN_PROGRESS = "in_progress", "In progress"
        DONE = "done", "Done"

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_tasks"
    )
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.TODO)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "tasks"
        ordering = ["status", "due_date", "-created_at"]

    def __str__(self):
        return self.title
