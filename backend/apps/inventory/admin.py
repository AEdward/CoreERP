from django.contrib import admin

from .models import Stock, StockMovement, Warehouse

admin.site.register(Warehouse)
admin.site.register(Stock)
admin.site.register(StockMovement)
