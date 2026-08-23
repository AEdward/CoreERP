from rest_framework import serializers

from apps.common.permissions import user_has_permission

from .models import Document
from .registry import resolve_target


class DocumentSerializer(serializers.ModelSerializer):
    app_label = serializers.CharField(write_only=True)
    model = serializers.CharField(write_only=True)
    target_label = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id",
            "app_label",
            "model",
            "object_id",
            "target_label",
            "file",
            "original_name",
            "mime_type",
            "size_bytes",
            "uploaded_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "original_name", "mime_type", "size_bytes", "created_at"]
        # write_only: reads never expose a raw /media/... URL — the
        # frontend always fetches bytes through the permission-checked
        # DocumentViewSet.download action instead (see views.py).
        extra_kwargs = {"file": {"write_only": True}}

    def get_target_label(self, obj):
        resolved = resolve_target(obj.content_type.app_label, obj.content_type.model)
        return resolved[2] if resolved else obj.content_type.model

    def get_uploaded_by_name(self, obj):
        return obj.uploaded_by.full_name if obj.uploaded_by_id else ""

    def validate(self, attrs):
        request = self.context["request"]
        company = getattr(request, "company", None)
        app_label = attrs.pop("app_label")
        model = attrs.pop("model")

        resolved = resolve_target(app_label, model)
        if resolved is None:
            raise serializers.ValidationError({"model": "Attachments aren't supported on this record type."})
        content_type, permission_module, _ = resolved

        if not user_has_permission(request.user, company, permission_module, "manage"):
            raise serializers.ValidationError(
                {"detail": "You don't have permission to attach files to this record."}
            )

        object_id = attrs.get("object_id")
        target_model = content_type.model_class()
        if not target_model.objects.filter(pk=object_id, company_id=company.id).exists():
            raise serializers.ValidationError({"object_id": "Record not found in the active company."})

        attrs["content_type"] = content_type
        return attrs

    def create(self, validated_data):
        file = validated_data["file"]
        validated_data["original_name"] = file.name
        validated_data["mime_type"] = getattr(file, "content_type", "") or ""
        validated_data["size_bytes"] = file.size
        validated_data["uploaded_by"] = self.context["request"].user
        return super().create(validated_data)
