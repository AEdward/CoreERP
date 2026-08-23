from django.contrib.contenttypes.models import ContentType

from .models import AuditLog


def log_audit(request, instance, action, changes=None):
    """The one write path for AuditLog rows — called from
    apps.common.views.CompanyScopedMixin, deliberately kept out of that
    module so it stays focused on the request/response cycle rather than
    audit-log mechanics."""
    AuditLog.objects.create(
        company=instance.company,
        content_type=ContentType.objects.get_for_model(type(instance)),
        object_id=instance.pk,
        target_label=str(instance)[:255],
        action=action,
        changes=changes or {},
        actor=request.user if request.user.is_authenticated else None,
    )
