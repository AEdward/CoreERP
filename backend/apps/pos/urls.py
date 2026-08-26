from django.urls import path
from rest_framework.routers import DefaultRouter

from .public_views import PublicMenuView
from .views import HappyHourRuleViewSet, OrderLineViewSet, OrderViewSet, PromotionViewSet, TableViewSet

router = DefaultRouter()
router.register("tables", TableViewSet, basename="pos-table")
router.register("orders", OrderViewSet, basename="pos-order")
router.register("order-lines", OrderLineViewSet, basename="pos-order-line")
router.register("happy-hour-rules", HappyHourRuleViewSet, basename="pos-happy-hour-rule")
router.register("promotions", PromotionViewSet, basename="pos-promotion")

urlpatterns = [
    path("public/menu/", PublicMenuView.as_view(), name="pos-public-menu"),
] + router.urls
