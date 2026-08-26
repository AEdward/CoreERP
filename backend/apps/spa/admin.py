from django.contrib import admin

from .models import SpaBooking, SpaBookingLine

admin.site.register(SpaBooking)
admin.site.register(SpaBookingLine)
