from rest_framework import serializers

from .models import Activity


class ActivitySerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = ["id", "verb", "summary", "actor_name", "created_at"]

    def get_actor_name(self, obj):
        return obj.actor.full_name if obj.actor_id else "System"
