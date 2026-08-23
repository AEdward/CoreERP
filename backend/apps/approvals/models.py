from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from apps.common.models import TenantModel


class ApprovalRequest(TenantModel):
    """A single approve/reject decision on some other record — same
    generic content_type/object_id mechanism as Document/Note/Activity,
    but its own whitelist (apps.approvals.registry.APPROVABLE_TARGETS)
    rather than reusing apps.common.targeting.ALLOWED_TARGETS: not every
    attachable record makes sense to route through an approval step, and
    conflating the two would let an unrelated feature (e.g. Notes) widen
    what counts as approvable by accident.

    Deliberately single-step, not a configurable multi-stage chain: the
    only real consumer today (Purchase Orders) needs exactly one
    decision, and a chain-of-approvers engine would be built for a
    scenario nobody's asked for yet. Segregation of duties is enforced
    at decision time instead (see ApprovalRequestViewSet._decide) —
    whoever requested approval can't also grant it.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, related_name="+")
    object_id = models.PositiveIntegerField()
    target = GenericForeignKey("content_type", "object_id")

    # str(instance) at request time — same reasoning as AuditLog.target_label:
    # stays meaningful even if the record's own state moves on.
    target_label = models.CharField(max_length=255)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    note = models.TextField(blank=True)
    decision_note = models.TextField(blank=True)

    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "approval_requests"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["company", "content_type", "object_id"])]

    def __str__(self):
        return f"{self.get_status_display()}: {self.target_label}"
