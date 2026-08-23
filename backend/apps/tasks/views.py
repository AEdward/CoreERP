from apps.common.views import CompanyScopedViewSet

from .models import Task
from .serializers import TaskSerializer


class TaskViewSet(CompanyScopedViewSet):
    queryset = Task.objects.select_related("assignee", "created_by")
    serializer_class = TaskSerializer
    permission_module = "tasks"
