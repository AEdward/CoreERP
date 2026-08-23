from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import MethodNotAllowed
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ModelViewSet):
    """No permission_module here on purpose — a notification is scoped
    to its recipient, not to any module permission. Every user can
    always see and manage their own notifications regardless of role.

    No create/delete via the API — these are system-generated only, via
    apps.notifications.services.notify_users/notify_permission. POST
    stays in http_method_names (restricting it would also block the
    mark_all_read action below — http_method_names gates the whole
    viewset, not per-action), so the inherited create() is overridden
    to refuse it explicitly instead.
    """

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        if not getattr(self.request, "company", None):
            return Notification.objects.none()
        return Notification.objects.filter(company_id=self.request.company.id, recipient=self.request.user)

    def create(self, request, *args, **kwargs):
        raise MethodNotAllowed("POST")

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        return Response({"count": self.get_queryset().filter(is_read=False).count()})

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response(status=204)
