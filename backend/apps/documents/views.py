from django.http import FileResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated

from apps.activity.models import Activity
from apps.activity.services import log_activity
from apps.common.permissions import user_has_permission
from apps.common.targeting import resolve_target

from .models import Document
from .serializers import DocumentSerializer


class DocumentViewSet(viewsets.ModelViewSet):
    """Deliberately NOT a CompanyScopedViewSet: that base assumes one
    fixed `permission_module` per viewset, but a Document's governing
    module depends on which record it's attached to (an Invoice's
    documents need sales.manage, a Bill's need procurement.manage) — see
    apps.common.targeting. list/create/destroy all resolve the target's
    module themselves instead.

    No update — replacing a file's bytes in place isn't a real use case;
    delete and re-upload instead.
    """

    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not getattr(request, "company", None):
            raise NotFound("Select an active company first (POST /api/companies/active/).")

    def get_queryset(self):
        # Company-scoped only — enough for a pk lookup (retrieve/destroy).
        # `list` narrows this further via _list_content_type/_list_object_id,
        # since listing needs the target's own module permission, which a
        # bare pk lookup doesn't know yet. (Note: setting self.queryset here
        # would NOT work — GenericAPIView.list() calls self.get_queryset(),
        # not self.queryset, so an override of get_queryset() must itself
        # read the narrowing filter.)
        if not getattr(self.request, "company", None):
            return Document.objects.none()
        qs = Document.objects.filter(company_id=self.request.company.id)
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
            raise NotFound("Attachments aren't supported on this record type.")
        content_type, permission_module, _ = resolved

        if not user_has_permission(request.user, request.company, permission_module, "view"):
            raise PermissionDenied(f"You don't have permission to view {permission_module} attachments.")

        self._list_content_type = content_type
        self._list_object_id = object_id
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        instance = serializer.save(company=self.request.company)
        log_activity(
            company=self.request.company,
            content_type=instance.content_type,
            object_id=instance.object_id,
            verb=Activity.Verb.DOCUMENT_ATTACHED,
            summary=f"{self.request.user.full_name} attached {instance.original_name}",
            actor=self.request.user,
        )

    def _target_permission_module(self, instance):
        resolved = resolve_target(instance.content_type.app_label, instance.content_type.model)
        return resolved[1] if resolved else None

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        permission_module = self._target_permission_module(instance)
        if not permission_module or not user_has_permission(
            request.user, request.company, permission_module, "view"
        ):
            raise PermissionDenied("You don't have permission to view this attachment.")
        return super().retrieve(request, *args, **kwargs)

    def perform_destroy(self, instance):
        permission_module = self._target_permission_module(instance)
        if not permission_module or not user_has_permission(
            self.request.user, self.request.company, permission_module, "manage"
        ):
            raise PermissionDenied("You don't have permission to delete this attachment.")
        instance.file.delete(save=False)
        instance.delete()

    @action(detail=True, methods=["get"])
    def download(self, request, *args, **kwargs):
        # The serializer's `file` field would otherwise expose a plain
        # /media/... URL — static file serving with no auth or permission
        # check at all, which would undo the point of every RLS/permission
        # check elsewhere in this app. This is the one path the frontend
        # actually uses to fetch the bytes.
        instance = self.get_object()
        permission_module = self._target_permission_module(instance)
        if not permission_module or not user_has_permission(
            request.user, request.company, permission_module, "view"
        ):
            raise PermissionDenied("You don't have permission to view this attachment.")
        response = FileResponse(instance.file.open("rb"), as_attachment=True, filename=instance.original_name)
        return response
