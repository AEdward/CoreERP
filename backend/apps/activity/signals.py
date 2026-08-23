from django.contrib.contenttypes.models import ContentType

from apps.common.current_user import get_current_user
from apps.common.targeting import ALLOWED_TARGETS

from .models import Activity
from .services import log_activity


def log_target_created(sender, instance, created, **kwargs):
    if not created:
        return
    company = getattr(instance, "company", None)
    if company is None:
        return

    key = f"{sender._meta.app_label}.{sender._meta.model_name}"
    entry = ALLOWED_TARGETS.get(key)
    label = entry[1] if entry else sender._meta.verbose_name.title()

    log_activity(
        company=company,
        content_type=ContentType.objects.get_for_model(sender),
        object_id=instance.pk,
        verb=Activity.Verb.CREATED,
        summary=f"{label} created",
        actor=get_current_user(),
    )
