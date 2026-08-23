from rest_framework.routers import DefaultRouter

from .views import ContactViewSet, CustomerViewSet, LeadViewSet, OpportunityViewSet

router = DefaultRouter()
router.register("customers", CustomerViewSet, basename="customer")
router.register("contacts", ContactViewSet, basename="contact")
router.register("leads", LeadViewSet, basename="lead")
router.register("opportunities", OpportunityViewSet, basename="opportunity")

urlpatterns = router.urls
