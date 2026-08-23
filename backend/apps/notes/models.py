from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from apps.common.models import TenantModel


class Note(TenantModel):
    """A text note logged against some other record — same generic
    content_type/object_id mechanism as Document (see
    apps.common.targeting), and the same whitelist, so anywhere that can
    take an attachment can take a note too."""

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, related_name="+")
    object_id = models.PositiveIntegerField()
    target = GenericForeignKey("content_type", "object_id")

    body = models.TextField()
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "notes"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["company", "content_type", "object_id"])]

    def __str__(self):
        return self.body[:50]
