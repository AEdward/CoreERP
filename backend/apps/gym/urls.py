from rest_framework.routers import DefaultRouter

from .views import GymBookingLineViewSet, GymBookingViewSet, GymMembershipViewSet

router = DefaultRouter()
router.register("memberships", GymMembershipViewSet, basename="gym-membership")
router.register("bookings", GymBookingViewSet, basename="gym-booking")
router.register("booking-lines", GymBookingLineViewSet, basename="gym-booking-line")

urlpatterns = router.urls
