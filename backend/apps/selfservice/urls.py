from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    MyAttendanceView,
    MyLeaveRequestViewSet,
    MyLeaveTypesView,
    MyOnboardingTaskViewSet,
    MyPayslipViewSet,
    MyPerformanceReviewViewSet,
    MyProfileView,
)

router = DefaultRouter()
router.register("leave-requests", MyLeaveRequestViewSet, basename="my-leave-request")
router.register("onboarding-tasks", MyOnboardingTaskViewSet, basename="my-onboarding-task")
router.register("payslips", MyPayslipViewSet, basename="my-payslip")
router.register("performance-reviews", MyPerformanceReviewViewSet, basename="my-performance-review")

urlpatterns = [
    path("profile/", MyProfileView.as_view(), name="my-profile"),
    path("attendance/", MyAttendanceView.as_view(), name="my-attendance"),
    path("leave-types/", MyLeaveTypesView.as_view(), name="my-leave-types"),
] + router.urls
