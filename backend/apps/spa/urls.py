from rest_framework.routers import DefaultRouter

from .views import SpaBookingLineViewSet, SpaBookingViewSet

router = DefaultRouter()
router.register("bookings", SpaBookingViewSet, basename="spa-booking")
router.register("booking-lines", SpaBookingLineViewSet, basename="spa-booking-line")

urlpatterns = router.urls
