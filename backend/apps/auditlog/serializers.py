from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = ["id", "action", "target_label", "changes", "actor_name", "created_at"]
        read_only_fields = fields

    def get_actor_name(self, obj):
        return obj.actor.full_name if obj.actor_id else "System"
