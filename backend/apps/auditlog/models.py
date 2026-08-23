from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from apps.common.models import TenantModel


class AuditLog(TenantModel):
    """A cross-model who-changed-what-when trail, written from exactly one
    place — apps.common.views.CompanyScopedMixin's perform_create/
    perform_update/perform_destroy (see apps.auditlog.services.log_audit)
    — so every model built on CompanyScopedViewSet/CompanyScopedReadOnlyViewSet
    is covered automatically, with no per-app wiring. Broader coverage than
    apps.activity on purpose: this isn't limited to apps.common.targeting's
    ALLOWED_TARGETS (the "can this take a Document/Note" whitelist) — it
    also captures master data like Warehouse and Account that whitelist
    was never meant to cover, since audit and attachability are different
    concerns.

    Known scope boundary, not a bug: Documents/Notes/Activity/Search have
    their own bespoke viewsets (not CompanyScopedViewSet, since their
    permission is derived per-target-record rather than one fixed
    permission_module — see apps.common.targeting), so mutations there
    aren't audit-logged. Neither are custom @action endpoints that bypass
    the plain create/update/destroy path. Both are deliberately out of
    scope for a first version, not something a blanket model signal would
    have caught cleanly either.
    """

    class Action(models.TextChoices):
        CREATED = "created", "Created"
        UPDATED = "updated", "Updated"
        DELETED = "deleted", "Deleted"

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, related_name="+")
    object_id = models.PositiveIntegerField()
    target = GenericForeignKey("content_type", "object_id")

    # str(instance) at write time — kept as a permanent label since the
    # record itself may since have been deleted (object_id then points at
    # nothing) or changed beyond recognition.
    target_label = models.CharField(max_length=255)

    action = models.CharField(max_length=16, choices=Action.choices)
    # {field: [old, new]} for an update; empty for created/deleted, where
    # the whole record is the "change".
    changes = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "audit_logs"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["company", "content_type", "object_id"])]

    def __str__(self):
        return f"{self.get_action_display()} {self.target_label}"
