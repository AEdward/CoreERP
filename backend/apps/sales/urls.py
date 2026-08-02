from rest_framework.routers import DefaultRouter

from .views import InvoiceViewSet, QuotationViewSet, SalesOrderViewSet

router = DefaultRouter()
router.register("quotations", QuotationViewSet, basename="quotation")
router.register("sales-orders", SalesOrderViewSet, basename="sales-order")
router.register("invoices", InvoiceViewSet, basename="invoice")

urlpatterns = router.urls
