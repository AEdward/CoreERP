from rest_framework.routers import DefaultRouter

from .views import HousekeepingTaskViewSet

router = DefaultRouter()
router.register("tasks", HousekeepingTaskViewSet, basename="housekeeping-task")

urlpatterns = router.urls
