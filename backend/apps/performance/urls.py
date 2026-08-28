from rest_framework.routers import DefaultRouter

from .views import (
    PerformanceReviewViewSet,
    ReviewCycleViewSet,
    TrainingEnrollmentViewSet,
    TrainingProgramViewSet,
)

router = DefaultRouter()
router.register("review-cycles", ReviewCycleViewSet, basename="review-cycle")
router.register("reviews", PerformanceReviewViewSet, basename="performance-review")
router.register("training-programs", TrainingProgramViewSet, basename="training-program")
router.register("training-enrollments", TrainingEnrollmentViewSet, basename="training-enrollment")

urlpatterns = router.urls
