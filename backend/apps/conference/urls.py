from rest_framework.routers import DefaultRouter

from .views import ConferenceBookingLineViewSet, ConferenceBookingViewSet, ConferenceHallViewSet

router = DefaultRouter()
router.register("halls", ConferenceHallViewSet, basename="conference-hall")
router.register("bookings", ConferenceBookingViewSet, basename="conference-booking")
router.register("booking-lines", ConferenceBookingLineViewSet, basename="conference-booking-line")

urlpatterns = router.urls
