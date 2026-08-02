from django.contrib import admin

from .models import PurchaseOrder, PurchaseOrderLine

admin.site.register(PurchaseOrder)
admin.site.register(PurchaseOrderLine)
