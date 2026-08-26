from rest_framework.routers import DefaultRouter

from .views import LoyaltyMemberViewSet, LoyaltyRewardViewSet, LoyaltyTierViewSet, LoyaltyTransactionViewSet

router = DefaultRouter()
router.register("tiers", LoyaltyTierViewSet, basename="loyalty-tier")
router.register("rewards", LoyaltyRewardViewSet, basename="loyalty-reward")
router.register("members", LoyaltyMemberViewSet, basename="loyalty-member")
router.register("transactions", LoyaltyTransactionViewSet, basename="loyalty-transaction")

urlpatterns = router.urls
