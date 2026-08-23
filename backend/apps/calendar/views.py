from apps.common.views import CompanyScopedViewSet

from .models import Event
from .serializers import EventSerializer


class EventViewSet(CompanyScopedViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    permission_module = "calendar"
