from django.contrib import admin

from .models import (
    Building,
    Floor,
    FolioCharge,
    GroupReservation,
    GuestFolio,
    Reservation,
    Room,
    RoomStatusLog,
    RoomTransfer,
    RoomType,
    SeasonalRate,
)

admin.site.register(Building)
admin.site.register(Floor)
admin.site.register(RoomType)
admin.site.register(SeasonalRate)
admin.site.register(Room)
admin.site.register(RoomStatusLog)
admin.site.register(GroupReservation)
admin.site.register(Reservation)
admin.site.register(RoomTransfer)
admin.site.register(GuestFolio)
admin.site.register(FolioCharge)
