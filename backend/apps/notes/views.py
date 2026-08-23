from rest_framework import viewsets
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated

from apps.activity.models import Activity
from apps.activity.services import log_activity
from apps.common.permissions import user_has_permission
from apps.common.targeting import resolve_target

from .models import Note
from .serializers import NoteSerializer


class NoteViewSet(viewsets.ModelViewSet):
    """Same shape as DocumentViewSet, same reasoning for not being a
    CompanyScopedViewSet — a Note's governing module is whichever record
    it's attached to, not one fixed permission_module."""

    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not getattr(request, "company", None):
            raise NotFound("Select an active company first (POST /api/companies/active/).")

    def get_queryset(self):
        # See apps.documents.views.DocumentViewSet.get_queryset for why the
        # list-narrowing filter has to be read back here rather than set via
        # self.queryset — GenericAPIView.list() calls self.get_queryset(),
        # not self.queryset, so an overridden get_queryset() must itself
        # apply it.
        if not getattr(self.request, "company", None):
            return Note.objects.none()
        qs = Note.objects.filter(company_id=self.request.company.id)
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
            raise NotFound("Notes aren't supported on this record type.")
        content_type, permission_module, _ = resolved

        if not user_has_permission(request.user, request.company, permission_module, "view"):
            raise PermissionDenied(f"You don't have permission to view {permission_module} notes.")

        self._list_content_type = content_type
        self._list_object_id = object_id
        return super().list(request, *args, **kwargs)

    def _target_permission_module(self, instance):
        resolved = resolve_target(instance.content_type.app_label, instance.content_type.model)
        return resolved[1] if resolved else None

    def perform_create(self, serializer):
        instance = serializer.save(company=self.request.company)
        log_activity(
            company=self.request.company,
            content_type=instance.content_type,
            object_id=instance.object_id,
            verb=Activity.Verb.NOTE_ADDED,
            summary=f"{self.request.user.full_name} added a note",
            actor=self.request.user,
        )

    def perform_update(self, serializer):
        permission_module = self._target_permission_module(serializer.instance)
        if not permission_module or not user_has_permission(
            self.request.user, self.request.company, permission_module, "manage"
        ):
            raise PermissionDenied("You don't have permission to edit this note.")
        serializer.save()

    def perform_destroy(self, instance):
        permission_module = self._target_permission_module(instance)
        if not permission_module or not user_has_permission(
            self.request.user, self.request.company, permission_module, "manage"
        ):
            raise PermissionDenied("You don't have permission to delete this note.")
        instance.delete()
