from django.contrib.contenttypes.models import ContentType
from rest_framework.exceptions import PermissionDenied

from apps.common.permissions import user_has_permission
from apps.common.views import CompanyScopedReadOnlyViewSet

from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(CompanyScopedReadOnlyViewSet):
    """Read-only, and deliberately stricter than the `settings.view` every
    role gets by default (see apps.branches for that precedent): a trail
    of every staff member's changes is more sensitive than a branch list,
    so this requires `settings.manage` even just to view — including for
    a single record's history, not just the company-wide list. That's one
    gate for the whole feature rather than mirroring apps.activity's
    per-record `view`-permission check, since audit data is a different,
    more sensitive concern than a friendly activity feed even when it's
    about the same record."""

    queryset = AuditLog.objects.select_related("actor")
    serializer_class = AuditLogSerializer
    permission_module = "settings"

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not user_has_permission(request.user, request.company, "settings", "manage"):
            raise PermissionDenied("Only a company administrator can view the audit log.")

    def get_queryset(self):
        queryset = super().get_queryset()
        app_label = self.request.query_params.get("app_label")
        model = self.request.query_params.get("model")
        object_id = self.request.query_params.get("object_id")
        if app_label and model:
            try:
                content_type = ContentType.objects.get_by_natural_key(app_label.lower(), model.lower())
            except ContentType.DoesNotExist:
                return queryset.none()
            queryset = queryset.filter(content_type=content_type)
            if object_id:
                queryset = queryset.filter(object_id=object_id)
        return queryset
