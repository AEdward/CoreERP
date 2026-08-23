from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.permissions import user_has_permission
from apps.notifications.services import notify_permission, notify_users

from .models import ApprovalRequest
from .registry import get_hooks, modules_with_approvals, resolve_approvable
from .serializers import ApprovalRequestSerializer


class ApprovalRequestViewSet(viewsets.ModelViewSet):
    """No PATCH/PUT/DELETE: a request is either created (POST), listed/
    retrieved (GET), or decided via the approve/reject actions below —
    there's no "edit a pending request" concept, and a decision, once
    made, is permanent."""

    serializer_class = ApprovalRequestSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not getattr(request, "company", None):
            raise NotFound("Select an active company first (POST /api/companies/active/).")

    def get_queryset(self):
        if not getattr(self.request, "company", None):
            return ApprovalRequest.objects.none()
        qs = ApprovalRequest.objects.filter(company_id=self.request.company.id).select_related(
            "requested_by", "decided_by"
        )
        content_type = getattr(self, "_list_content_type", None)
        object_id = getattr(self, "_list_object_id", None)
        if content_type is not None and object_id is not None:
            qs = qs.filter(content_type=content_type, object_id=object_id)
        return qs

    def list(self, request, *args, **kwargs):
        app_label = request.query_params.get("app_label")
        model = request.query_params.get("model")
        object_id = request.query_params.get("object_id")

        if app_label and model:
            resolved = resolve_approvable(app_label, model)
            if resolved is None:
                raise NotFound("Approval history isn't tracked for this record type.")
            content_type, permission_module, _, _ = resolved
            if not user_has_permission(request.user, request.company, permission_module, "view"):
                raise PermissionDenied(f"You don't have permission to view {permission_module} approvals.")
            self._list_content_type = content_type
            if object_id:
                self._list_object_id = object_id
        else:
            # Company-wide inbox: no single target's permission applies,
            # so require `manage` on at least one module that actually
            # has approvals wired up.
            modules = modules_with_approvals()
            if not any(user_has_permission(request.user, request.company, m, "manage") for m in modules):
                raise PermissionDenied("You don't have permission to view any approvable records.")

        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        instance = serializer.save(company=self.request.company, requested_by=self.request.user)

        hooks = get_hooks(instance.content_type.app_label, instance.content_type.model)
        if hooks and hooks["on_requested"]:
            hooks["on_requested"](serializer._target_instance)

        resolved = resolve_approvable(instance.content_type.app_label, instance.content_type.model)
        if resolved:
            _, permission_module, _, url = resolved
            notify_permission(
                self.request.company,
                permission_module,
                "manage",
                f"{self.request.user.full_name} requested approval for {instance.target_label}",
                link=url,
            )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._decide(request, approved=True)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._decide(request, approved=False)

    def _decide(self, request, *, approved):
        instance = self.get_object()

        resolved = resolve_approvable(instance.content_type.app_label, instance.content_type.model)
        if resolved is None:
            raise NotFound("Approval isn't supported for this record type.")
        _, permission_module, _, _ = resolved

        if not user_has_permission(request.user, request.company, permission_module, "manage"):
            raise PermissionDenied(f"You don't have permission to decide {permission_module} approvals.")

        if instance.status != ApprovalRequest.Status.PENDING:
            raise ValidationError({"detail": "This request has already been decided."})

        if instance.requested_by_id == request.user.id:
            raise PermissionDenied("You can't approve or reject your own request.")

        instance.status = ApprovalRequest.Status.APPROVED if approved else ApprovalRequest.Status.REJECTED
        instance.decided_by = request.user
        instance.decided_at = timezone.now()
        instance.decision_note = request.data.get("decision_note", "")
        instance.save(update_fields=["status", "decided_by", "decided_at", "decision_note"])

        hooks = get_hooks(instance.content_type.app_label, instance.content_type.model)
        if hooks and hooks["on_decided"]:
            hooks["on_decided"](instance.target, approved)

        if instance.requested_by_id:
            verb = "approved" if approved else "rejected"
            notify_users(
                request.company,
                [instance.requested_by],
                f"Your approval request for {instance.target_label} was {verb}.",
            )

        return Response(ApprovalRequestSerializer(instance).data)
