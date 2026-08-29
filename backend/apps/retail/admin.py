from django.contrib import admin

from .models import (
    CashierShift,
    GiftCard,
    GiftCardTransaction,
    ProductVariant,
    Promotion,
    Register,
    RetailReturn,
    RetailReturnLine,
    RetailSale,
    RetailSaleLine,
)

admin.site.register(Register)
admin.site.register(CashierShift)
admin.site.register(ProductVariant)
admin.site.register(Promotion)
admin.site.register(RetailSale)
admin.site.register(RetailSaleLine)
admin.site.register(GiftCard)
admin.site.register(GiftCardTransaction)
admin.site.register(RetailReturn)
admin.site.register(RetailReturnLine)
