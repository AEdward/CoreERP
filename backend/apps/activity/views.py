from rest_framework import viewsets
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated

from apps.common.permissions import user_has_permission
from apps.common.targeting import resolve_target

from .models import Activity
from .serializers import ActivitySerializer


class ActivityViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only: activity entries are system-generated (see
    apps.activity.signals and the direct log_activity() calls from
    apps.notes/apps.documents), never created through this API. Same
    list-scoping shape as DocumentViewSet/NoteViewSet — see the comment on
    DocumentViewSet.get_queryset for why the narrowing filter has to be
    read back inside get_queryset() rather than set via self.queryset."""

    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "head", "options"]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not getattr(request, "company", None):
            raise NotFound("Select an active company first (POST /api/companies/active/).")

    def get_queryset(self):
        if not getattr(self.request, "company", None):
            return Activity.objects.none()
        qs = Activity.objects.filter(company_id=self.request.company.id).select_related("actor")
        content_type = getattr(self, "_list_content_type", None)
        object_id = getattr(self, "_list_object_id", None)
        if content_type is not None and object_id is not None:
            qs = qs.filter(content_type=content_type, object_id=object_id)
        return qs

    def list(self, request, *args, **kwargs):
        app_label = request.query_params.get("app_label")
        model = request.query_params.get("model")
        object_id = request.query_params.get("object_id")
        if not (app_label and model and object_id):
            raise NotFound("app_label, model, and object_id query params are required.")

        resolved = resolve_target(app_label, model)
        if resolved is None:
            raise NotFound("Activity isn't tracked for this record type.")
        content_type, permission_module, _ = resolved

        if not user_has_permission(request.user, request.company, permission_module, "view"):
            raise PermissionDenied(f"You don't have permission to view {permission_module} activity.")

        self._list_content_type = content_type
        self._list_object_id = object_id
        return super().list(request, *args, **kwargs)
