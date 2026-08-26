from rest_framework.routers import DefaultRouter

from .views import (
    BuildingViewSet,
    FloorViewSet,
    FolioChargeViewSet,
    GroupReservationViewSet,
    GuestFolioViewSet,
    GuestPaymentViewSet,
    GuestRefundViewSet,
    ReservationViewSet,
    RoomBlockViewSet,
    RoomStatusLogViewSet,
    RoomTypeViewSet,
    RoomViewSet,
    SeasonalRateViewSet,
)

router = DefaultRouter()
router.register("buildings", BuildingViewSet, basename="hotel-building")
router.register("floors", FloorViewSet, basename="hotel-floor")
router.register("room-types", RoomTypeViewSet, basename="hotel-room-type")
router.register("seasonal-rates", SeasonalRateViewSet, basename="hotel-seasonal-rate")
router.register("rooms", RoomViewSet, basename="hotel-room")
router.register("room-blocks", RoomBlockViewSet, basename="hotel-room-block")
router.register("room-status-logs", RoomStatusLogViewSet, basename="hotel-room-status-log")
router.register("reservations", ReservationViewSet, basename="hotel-reservation")
router.register("group-reservations", GroupReservationViewSet, basename="hotel-group-reservation")
router.register("folios", GuestFolioViewSet, basename="hotel-folio")
router.register("folio-charges", FolioChargeViewSet, basename="hotel-folio-charge")
router.register("guest-payments", GuestPaymentViewSet, basename="hotel-guest-payment")
router.register("guest-refunds", GuestRefundViewSet, basename="hotel-guest-refund")

urlpatterns = router.urls
