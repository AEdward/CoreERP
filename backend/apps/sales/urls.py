from rest_framework.routers import DefaultRouter

from .views import CreditNoteViewSet, InvoiceViewSet, QuotationViewSet, SalesOrderViewSet

router = DefaultRouter()
router.register("quotations", QuotationViewSet, basename="quotation")
router.register("sales-orders", SalesOrderViewSet, basename="sales-order")
router.register("invoices", InvoiceViewSet, basename="invoice")
router.register("credit-notes", CreditNoteViewSet, basename="credit-note")

urlpatterns = router.urls
