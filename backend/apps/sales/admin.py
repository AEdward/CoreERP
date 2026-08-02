from django.contrib import admin

from .models import Invoice, Quotation, QuotationLine, SalesOrder, SalesOrderLine

admin.site.register(Quotation)
admin.site.register(QuotationLine)
admin.site.register(SalesOrder)
admin.site.register(SalesOrderLine)
admin.site.register(Invoice)
