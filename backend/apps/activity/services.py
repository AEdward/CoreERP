from .models import Activity


def log_activity(*, company, content_type, object_id, verb, summary, actor=None):
    """The one write path for Activity rows — called from the created-signal
    (see signals.py) and directly from apps.notes/apps.documents at the
    moment they attach something, so both land on the same timeline."""
    Activity.objects.create(
        company=company,
        content_type=content_type,
        object_id=object_id,
        verb=verb,
        summary=summary,
        actor=actor,
    )
