from rest_framework.routers import DefaultRouter

from .views import (
    CashierShiftViewSet,
    GiftCardTransactionViewSet,
    GiftCardViewSet,
    ProductVariantViewSet,
    PromotionViewSet,
    RegisterViewSet,
    RetailReturnViewSet,
    RetailSaleViewSet,
)

router = DefaultRouter()
router.register("registers", RegisterViewSet, basename="retail-register")
router.register("shifts", CashierShiftViewSet, basename="retail-shift")
router.register("variants", ProductVariantViewSet, basename="retail-variant")
router.register("promotions", PromotionViewSet, basename="retail-promotion")
router.register("sales", RetailSaleViewSet, basename="retail-sale")
router.register("gift-cards", GiftCardViewSet, basename="retail-gift-card")
router.register("gift-card-transactions", GiftCardTransactionViewSet, basename="retail-gift-card-transaction")
router.register("returns", RetailReturnViewSet, basename="retail-return")

urlpatterns = router.urls
