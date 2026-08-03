from django.contrib import admin

from .models import Bill, PurchaseOrder, PurchaseOrderLine

admin.site.register(PurchaseOrder)
admin.site.register(PurchaseOrderLine)
admin.site.register(Bill)
