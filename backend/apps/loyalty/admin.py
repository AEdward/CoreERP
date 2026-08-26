from django.contrib import admin

from .models import LoyaltyMember, LoyaltyReward, LoyaltyTier, LoyaltyTransaction

admin.site.register(LoyaltyTier)
admin.site.register(LoyaltyReward)
admin.site.register(LoyaltyMember)
admin.site.register(LoyaltyTransaction)
