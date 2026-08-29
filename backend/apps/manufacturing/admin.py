from django.contrib import admin

from .models import (
    BillOfMaterial,
    BOMByproduct,
    BOMLine,
    BOMOperation,
    Machine,
    MachineMaintenanceLog,
    MaterialConsumption,
    ProductionOrder,
    QualityCheck,
    ScrapEntry,
    WorkCenter,
    WorkOrder,
)

admin.site.register(WorkCenter)
admin.site.register(Machine)
admin.site.register(MachineMaintenanceLog)
admin.site.register(BillOfMaterial)
admin.site.register(BOMLine)
admin.site.register(BOMByproduct)
admin.site.register(BOMOperation)
admin.site.register(ProductionOrder)
admin.site.register(WorkOrder)
admin.site.register(MaterialConsumption)
admin.site.register(ScrapEntry)
admin.site.register(QualityCheck)
