from apps.common.views import CompanyScopedViewSet

from .models import LoyaltyMember, LoyaltyReward, LoyaltyTier, LoyaltyTransaction
from .serializers import (
    LoyaltyMemberSerializer,
    LoyaltyRewardSerializer,
    LoyaltyTierSerializer,
    LoyaltyTransactionSerializer,
)


class LoyaltyTierViewSet(CompanyScopedViewSet):
    queryset = LoyaltyTier.objects.all()
    serializer_class = LoyaltyTierSerializer
    permission_module = "loyalty"


class LoyaltyRewardViewSet(CompanyScopedViewSet):
    queryset = LoyaltyReward.objects.all()
    serializer_class = LoyaltyRewardSerializer
    permission_module = "loyalty"


class LoyaltyMemberViewSet(CompanyScopedViewSet):
    queryset = LoyaltyMember.objects.select_related("guest").prefetch_related("transactions")
    serializer_class = LoyaltyMemberSerializer
    permission_module = "loyalty"


class LoyaltyTransactionViewSet(CompanyScopedViewSet):
    """The points ledger — earns and redemptions both go through a plain
    create here (validated in LoyaltyTransactionSerializer), same
    append-only shape as apps.hotel.FolioChargeViewSet: no PATCH/DELETE,
    correcting a mistake means a reversing entry."""

    queryset = LoyaltyTransaction.objects.select_related("member__guest", "reward", "reservation").all()
    serializer_class = LoyaltyTransactionSerializer
    permission_module = "loyalty"
    http_method_names = ["get", "post", "head", "options"]
