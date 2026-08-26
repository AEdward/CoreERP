from django.db import models

from apps.common.models import TenantModel
from apps.crm.models import Customer
from apps.hotel.models import Reservation


class LoyaltyTier(TenantModel):
    """Membership Level (docs: "Membership Levels") — a threshold a
    member's points balance has to clear, not a field stored on the
    member itself (see LoyaltyMember.tier), same "derive, don't
    duplicate" principle as GuestFolio.balance_cents."""

    name = models.CharField(max_length=50)
    min_points = models.PositiveIntegerField()
    benefits = models.TextField(blank=True)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    class Meta:
        db_table = "loyalty_tiers"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_loyalty_tier_name")
        ]
        ordering = ["min_points"]

    def __str__(self):
        return self.name


class LoyaltyReward(TenantModel):
    """Something points can be redeemed for (docs: "Rewards")."""

    name = models.CharField(max_length=100)
    points_cost = models.PositiveIntegerField()
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "loyalty_rewards"
        ordering = ["points_cost"]

    def __str__(self):
        return self.name


class LoyaltyMember(TenantModel):
    """One per enrolled Customer — enrollment is explicit (a guest isn't
    auto-enrolled just by staying), matching docs/ARCHITECTURE.md §12.1's
    extend-don't-duplicate principle: `guest` is a straight FK to the
    existing apps.crm.Customer, not a parallel guest-profile model.
    `points_balance`/`tier` are computed from the transaction ledger, not
    stored, same reasoning as GuestFolio.balance_cents/Quotation.total_cents."""

    guest = models.OneToOneField(Customer, on_delete=models.CASCADE, related_name="loyalty_member")

    class Meta:
        db_table = "loyalty_members"
        ordering = ["-created_at"]

    @property
    def points_balance(self):
        return sum(t.points for t in self.transactions.all())

    @property
    def tier(self):
        balance = self.points_balance
        return (
            LoyaltyTier.objects.filter(company=self.company, min_points__lte=balance)
            .order_by("-min_points")
            .first()
        )

    def __str__(self):
        return f"{self.guest} — {self.points_balance} pts"


class LoyaltyTransaction(TenantModel):
    """The points ledger — append-only, same principle as JournalEntry/
    StockMovement/FolioCharge: a mistake gets a correcting entry, not an
    edit. `points` is positive for an earn, negative for a redemption
    (see LoyaltyMemberViewSet.redeem and apps.loyalty.signals for the two
    ways a transaction gets created: staff awarding points directly, or
    automatically at hotel checkout)."""

    member = models.ForeignKey(LoyaltyMember, on_delete=models.CASCADE, related_name="transactions")
    points = models.IntegerField()
    reason = models.CharField(max_length=255)
    reservation = models.ForeignKey(
        Reservation, on_delete=models.SET_NULL, null=True, blank=True, related_name="loyalty_transactions"
    )
    reward = models.ForeignKey(
        LoyaltyReward, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "loyalty_transactions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.member} {self.points:+d} ({self.reason})"
