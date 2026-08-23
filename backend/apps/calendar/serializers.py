from apps.common.serializers import CompanyScopedSerializer

from .models import Event


class EventSerializer(CompanyScopedSerializer):
    class Meta:
        model = Event
        fields = ["id", "title", "description", "start_at", "end_at", "all_day", "created_at"]
        read_only_fields = ["id", "created_at"]
