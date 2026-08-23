from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from apps.common.models import TenantModel


class Document(TenantModel):
    """A file attached to some other record — any record, in any module,
    named in apps.documents.registry.ALLOWED_TARGETS. Uses Django's
    contenttypes framework (content_type + object_id) rather than a
    per-module FK, so this app never needs to know Employee/Invoice/Item
    exist; new target models just add one line to the registry.

    Permission checks are NOT permission_module-fixed like
    CompanyScopedMixin's usual pattern — they're derived per-request from
    whichever target record is being attached to (see views.py)."""

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, related_name="+")
    object_id = models.PositiveIntegerField()
    target = GenericForeignKey("content_type", "object_id")

    file = models.FileField(upload_to="documents/%Y/%m/")
    original_name = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=100, blank=True)
    size_bytes = models.PositiveIntegerField(default=0)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "documents"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["company", "content_type", "object_id"])]

    def __str__(self):
        return self.original_name
