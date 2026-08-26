from rest_framework import serializers

from apps.common.serializers import CompanyScopedSerializer

from .models import LoyaltyMember, LoyaltyReward, LoyaltyTier, LoyaltyTransaction


class LoyaltyTierSerializer(CompanyScopedSerializer):
    class Meta:
        model = LoyaltyTier
        fields = ["id", "name", "min_points", "benefits", "discount_percent", "created_at"]
        read_only_fields = ["id", "created_at"]


class LoyaltyRewardSerializer(CompanyScopedSerializer):
    class Meta:
        model = LoyaltyReward
        fields = ["id", "name", "points_cost", "description", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class LoyaltyMemberSerializer(CompanyScopedSerializer):
    same_company_fields = ["guest"]
    guest_name = serializers.CharField(source="guest.name", read_only=True)
    points_balance = serializers.IntegerField(read_only=True)
    tier_name = serializers.CharField(source="tier.name", read_only=True, default=None)

    class Meta:
        model = LoyaltyMember
        fields = ["id", "guest", "guest_name", "points_balance", "tier_name", "created_at"]
        read_only_fields = ["id", "created_at"]


class LoyaltyTransactionSerializer(CompanyScopedSerializer):
    # Append-only — see LoyaltyTransactionViewSet's http_method_names.
    # `points` is validated here rather than a DB CheckConstraint since
    # the "must match the reward's cost and the member can afford it"
    # rule needs a live balance query, not just the row being inserted.
    same_company_fields = ["member", "reservation", "reward"]
    member_guest_name = serializers.CharField(source="member.guest.name", read_only=True)
    reward_name = serializers.CharField(source="reward.name", read_only=True, default=None)

    class Meta:
        model = LoyaltyTransaction
        fields = [
            "id",
            "member",
            "member_guest_name",
            "points",
            "reason",
            "reservation",
            "reward",
            "reward_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        member = attrs.get("member")
        points = attrs.get("points")
        reward = attrs.get("reward")

        if points == 0:
            raise serializers.ValidationError({"points": "Must be nonzero."})

        if reward is not None:
            if points != -reward.points_cost:
                raise serializers.ValidationError(
                    {"points": f"A redemption of '{reward.name}' must be exactly -{reward.points_cost} points."}
                )
            if member.points_balance < reward.points_cost:
                raise serializers.ValidationError(
                    {"reward": f"{member.guest.name} only has {member.points_balance} points — needs {reward.points_cost}."}
                )
        elif points < 0:
            raise serializers.ValidationError({"points": "A negative adjustment must reference a reward — see redeem."})

        return attrs
