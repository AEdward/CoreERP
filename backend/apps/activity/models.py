from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from apps.common.models import TenantModel


class Activity(TenantModel):
    """A system-generated timeline entry for some other record — same
    generic content_type/object_id mechanism as Document and Note (see
    apps.common.targeting), and the same whitelist. Unlike Notes/Documents,
    entries here are never created directly through the API: they're
    written by model signals (record created) or from specific call sites
    that already know they just did something worth recording (a note was
    added, a file was attached)."""

    class Verb(models.TextChoices):
        CREATED = "created", "Created"
        NOTE_ADDED = "note_added", "Note added"
        DOCUMENT_ATTACHED = "document_attached", "Document attached"

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, related_name="+")
    object_id = models.PositiveIntegerField()
    target = GenericForeignKey("content_type", "object_id")

    verb = models.CharField(max_length=32, choices=Verb.choices)
    summary = models.CharField(max_length=255)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "activities"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["company", "content_type", "object_id"])]
        verbose_name_plural = "activities"

    def __str__(self):
        return self.summary
