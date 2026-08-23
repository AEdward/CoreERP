from rest_framework.routers import DefaultRouter

from .views import ApprovalRequestViewSet

router = DefaultRouter()
router.register("approvals", ApprovalRequestViewSet, basename="approval")

urlpatterns = router.urls
