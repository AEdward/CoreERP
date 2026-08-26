from django.contrib import admin

from .models import Asset, MaintenanceSchedule, WorkOrder, WorkOrderPart

admin.site.register(WorkOrder)
admin.site.register(MaintenanceSchedule)
admin.site.register(Asset)
admin.site.register(WorkOrderPart)
