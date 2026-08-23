from django.db import models

from apps.common.models import TenantModel


class Event(TenantModel):
    """A standalone calendar entry — same "keep it simple" shape as
    Task, no generic content_type/object_id link. The /dashboard/calendar
    page folds these together with existing due dates (Task, Invoice,
    Bill) client-side rather than this app needing to know those models
    exist."""

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField(null=True, blank=True)
    all_day = models.BooleanField(default=False)

    class Meta:
        db_table = "calendar_events"
        ordering = ["start_at"]

    def __str__(self):
        return self.title
