from django.conf import settings
from django.db import models

from apps.common.models import TenantModel


class Notification(TenantModel):
    """Scoped narrower than most TenantModels: RLS's company_id check is
    the usual "member of this company at all" backstop, but the real
    scoping here is per-recipient — every viewset query filters by
    recipient=request.user too, same "app layer does the narrow part"
    split as active-company scoping. Nobody sees anybody else's
    notifications just by being in the same company."""

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    message = models.CharField(max_length=255)
    link = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["recipient", "is_read"])]

    def __str__(self):
        return self.message
