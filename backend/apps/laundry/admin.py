from django.contrib import admin

from .models import LaundryOrder, LaundryOrderLine

admin.site.register(LaundryOrder)
admin.site.register(LaundryOrderLine)
