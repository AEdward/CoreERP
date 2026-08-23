from rest_framework.routers import DefaultRouter

from .views import ActivityViewSet

router = DefaultRouter()
router.register("activity", ActivityViewSet, basename="activity")

urlpatterns = router.urls
