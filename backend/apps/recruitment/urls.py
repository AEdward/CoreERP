from rest_framework.routers import DefaultRouter

from .views import ApplicantViewSet, JobVacancyViewSet, OnboardingTaskViewSet

router = DefaultRouter()
router.register("vacancies", JobVacancyViewSet, basename="job-vacancy")
router.register("applicants", ApplicantViewSet, basename="applicant")
router.register("onboarding-tasks", OnboardingTaskViewSet, basename="onboarding-task")

urlpatterns = router.urls
