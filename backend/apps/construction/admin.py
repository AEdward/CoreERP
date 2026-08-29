from django.contrib import admin

from .models import (
    BOQItem,
    ChangeOrder,
    ConstructionProject,
    Contract,
    Equipment,
    EquipmentAssignment,
    LaborAssignment,
    MaterialIssue,
    QualityInspection,
    SafetyIncident,
    SiteExpense,
    SiteLog,
)

admin.site.register(ConstructionProject)
admin.site.register(BOQItem)
admin.site.register(Contract)
admin.site.register(SiteLog)
admin.site.register(MaterialIssue)
admin.site.register(Equipment)
admin.site.register(EquipmentAssignment)
admin.site.register(LaborAssignment)
admin.site.register(SiteExpense)
admin.site.register(ChangeOrder)
admin.site.register(QualityInspection)
admin.site.register(SafetyIncident)
