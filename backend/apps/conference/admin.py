from django.contrib import admin

from .models import ConferenceBooking, ConferenceBookingLine, ConferenceHall

admin.site.register(ConferenceHall)
admin.site.register(ConferenceBooking)
admin.site.register(ConferenceBookingLine)
