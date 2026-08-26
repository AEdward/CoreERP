from django.contrib import admin

from .models import HappyHourRule, Order, OrderLine, Promotion, Table

admin.site.register(Table)
admin.site.register(Order)
admin.site.register(OrderLine)
admin.site.register(HappyHourRule)
admin.site.register(Promotion)
