from rest_framework import serializers

from apps.common.permissions import user_has_permission

from .models import ApprovalRequest
from .registry import get_hooks, resolve_approvable


class ApprovalRequestSerializer(serializers.ModelSerializer):
    app_label = serializers.CharField(write_only=True)
    model = serializers.CharField(write_only=True)
    requested_by_name = serializers.SerializerMethodField()
    decided_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ApprovalRequest
        fields = [
            "id",
            "app_label",
            "model",
            "object_id",
            "target_label",
            "status",
            "note",
            "decision_note",
            "requested_by_name",
            "decided_by_name",
            "decided_at",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "target_label",
            "status",
            "decision_note",
            "decided_at",
            "created_at",
        ]

    def get_requested_by_name(self, obj):
        return obj.requested_by.full_name if obj.requested_by_id else "—"

    def get_decided_by_name(self, obj):
        return obj.decided_by.full_name if obj.decided_by_id else ""

    def validate(self, attrs):
        request = self.context["request"]
        company = getattr(request, "company", None)
        app_label = attrs.pop("app_label", None)
        model = attrs.pop("model", None)

        resolved = resolve_approvable(app_label, model)
        if resolved is None:
            raise serializers.ValidationError({"model": "Approval isn't supported for this record type."})
        content_type, permission_module, label, _ = resolved

        if not user_has_permission(request.user, company, permission_module, "manage"):
            raise serializers.ValidationError(
                {"detail": "You don't have permission to request approval for this record."}
            )

        object_id = attrs.get("object_id")
        target_model = content_type.model_class()
        try:
            instance = target_model.objects.get(pk=object_id, company_id=company.id)
        except target_model.DoesNotExist:
            raise serializers.ValidationError({"object_id": "Record not found in the active company."})

        if ApprovalRequest.objects.filter(
            company=company,
            content_type=content_type,
            object_id=object_id,
            status=ApprovalRequest.Status.PENDING,
        ).exists():
            raise serializers.ValidationError(
                {"detail": "There's already a pending approval request for this record."}
            )

        hooks = get_hooks(app_label, model)
        if hooks and hooks["check_requestable"]:
            try:
                hooks["check_requestable"](instance)
            except ValueError as exc:
                raise serializers.ValidationError({"detail": str(exc)}) from exc

        attrs["content_type"] = content_type
        attrs["target_label"] = f"{label}: {instance}"
        self._target_instance = instance
        return attrs
