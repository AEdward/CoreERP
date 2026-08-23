from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def health(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/auth/", include("apps.users.urls")),
    path("api/companies/", include("apps.companies.urls")),
    path("api/", include("apps.branches.urls")),
    path("api/hr/", include("apps.hr.urls")),
    path("api/crm/", include("apps.crm.urls")),
    path("api/suppliers/", include("apps.suppliers.urls")),
    path("api/", include("apps.tax.urls")),
    path("api/catalog/", include("apps.catalog.urls")),
    path("api/inventory/", include("apps.inventory.urls")),
    path("api/procurement/", include("apps.procurement.urls")),
    path("api/sales/", include("apps.sales.urls")),
    path("api/accounting/", include("apps.accounting.urls")),
    path("api/", include("apps.auditlog.urls")),
    path("api/", include("apps.approvals.urls")),
    path("api/", include("apps.activity.urls")),
    path("api/", include("apps.documents.urls")),
    path("api/", include("apps.notes.urls")),
    path("api/", include("apps.notifications.urls")),
    path("api/", include("apps.tasks.urls")),
    path("api/calendar/", include("apps.calendar.urls")),
    path("api/", include("apps.search.urls")),
    path("api/dashboard/", include("apps.dashboard.urls")),
]

# No public /media/ URL on purpose — Document.file is only ever served
# through DocumentViewSet's permission-checked `download` action.
