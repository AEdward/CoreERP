from django.contrib import admin

from .models import (
    AgentCommission,
    Building,
    LeaseContract,
    PaymentInstallment,
    PropertyExpense,
    PropertyListing,
    PropertyMaintenanceRequest,
    PropertyProject,
    PropertySale,
    RentPayment,
    SalesAgent,
    Unit,
    UnitType,
)

admin.site.register(PropertyProject)
admin.site.register(Building)
admin.site.register(UnitType)
admin.site.register(Unit)
admin.site.register(PropertyListing)
admin.site.register(SalesAgent)
admin.site.register(PropertySale)
admin.site.register(PaymentInstallment)
admin.site.register(AgentCommission)
admin.site.register(LeaseContract)
admin.site.register(RentPayment)
admin.site.register(PropertyMaintenanceRequest)
admin.site.register(PropertyExpense)
