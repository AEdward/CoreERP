from django.contrib import admin

from .models import GymBooking, GymBookingLine, GymMembership

admin.site.register(GymMembership)
admin.site.register(GymBooking)
admin.site.register(GymBookingLine)
