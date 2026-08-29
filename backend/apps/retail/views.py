from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.common.views import CompanyScopedViewSet

from .models import CashierShift, GiftCard, GiftCardTransaction, ProductVariant, Promotion, Register, RetailReturn, RetailSale
from .serializers import (
    CashierShiftSerializer,
    GiftCardSerializer,
    GiftCardTransactionSerializer,
    ProductVariantSerializer,
    PromotionSerializer,
    RegisterSerializer,
    RetailReturnSerializer,
    RetailSaleSerializer,
)


class RegisterViewSet(CompanyScopedViewSet):
    queryset = Register.objects.select_related("branch").all()
    serializer_class = RegisterSerializer
    permission_module = "retail"


class CashierShiftViewSet(CompanyScopedViewSet):
    queryset = CashierShift.objects.select_related("register", "cashier").all()
    serializer_class = CashierShiftSerializer
    permission_module = "retail"

    def get_queryset(self):
        qs = super().get_queryset()
        register_id = self.request.query_params.get("register")
        if register_id:
            qs = qs.filter(register_id=register_id)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        shift = self.get_object()
        if shift.status != CashierShift.Status.CLOSED:
            closing_amount = request.data.get("closing_amount_cents")
            if closing_amount is None:
                raise ValidationError({"closing_amount_cents": "Required."})
            shift.closing_amount_cents = closing_amount
            shift.status = CashierShift.Status.CLOSED
            shift.closed_at = timezone.now()
            shift.save(update_fields=["closing_amount_cents", "status", "closed_at"])
        else:
            raise ValidationError("This shift is already closed.")
        return Response(CashierShiftSerializer(shift).data)


class ProductVariantViewSet(CompanyScopedViewSet):
    queryset = ProductVariant.objects.select_related("item").all()
    serializer_class = ProductVariantSerializer
    permission_module = "retail"

    def get_queryset(self):
        qs = super().get_queryset()
        item_id = self.request.query_params.get("item")
        if item_id:
            qs = qs.filter(item_id=item_id)
        return qs


class PromotionViewSet(CompanyScopedViewSet):
    queryset = Promotion.objects.all()
    serializer_class = PromotionSerializer
    permission_module = "retail"


class RetailSaleViewSet(CompanyScopedViewSet):
    # Append-only, same reasoning apps.sales.InvoiceViewSet uses: a
    # completed sale already posted real stock movements, so it isn't
    # edited or deleted — only returned, through RetailReturnViewSet.
    http_method_names = ["get", "post", "head", "options"]
    queryset = RetailSale.objects.select_related("register", "shift", "customer", "promotion").prefetch_related(
        "lines__item", "lines__variant"
    )
    serializer_class = RetailSaleSerializer
    permission_module = "retail"

    def get_queryset(self):
        qs = super().get_queryset()
        register_id = self.request.query_params.get("register")
        if register_id:
            qs = qs.filter(register_id=register_id)
        shift_id = self.request.query_params.get("shift")
        if shift_id:
            qs = qs.filter(shift_id=shift_id)
        return qs


class GiftCardViewSet(CompanyScopedViewSet):
    queryset = GiftCard.objects.select_related("issued_to").all()
    serializer_class = GiftCardSerializer
    permission_module = "retail"

    @action(detail=True, methods=["post"])
    def redeem(self, request, pk=None):
        gift_card = self.get_object()
        if gift_card.status != GiftCard.Status.ACTIVE:
            raise ValidationError("This gift card isn't active.")
        amount = request.data.get("amount_cents") or 0
        if amount <= 0:
            raise ValidationError({"amount_cents": "Must be a positive whole number."})
        if amount > gift_card.balance_cents:
            raise ValidationError({"amount_cents": "Exceeds the card's remaining balance."})
        gift_card.balance_cents -= amount
        if gift_card.balance_cents == 0:
            gift_card.status = GiftCard.Status.REDEEMED
        gift_card.save(update_fields=["balance_cents", "status"])
        GiftCardTransaction.objects.create(
            company=gift_card.company,
            gift_card=gift_card,
            type=GiftCardTransaction.Type.REDEEM,
            amount_cents=amount,
            sale_id=request.data.get("sale"),
        )
        return Response(GiftCardSerializer(gift_card).data)

    @action(detail=True, methods=["post"])
    def reload(self, request, pk=None):
        gift_card = self.get_object()
        amount = request.data.get("amount_cents") or 0
        if amount <= 0:
            raise ValidationError({"amount_cents": "Must be a positive whole number."})
        gift_card.balance_cents += amount
        if gift_card.status == GiftCard.Status.REDEEMED:
            gift_card.status = GiftCard.Status.ACTIVE
        gift_card.save(update_fields=["balance_cents", "status"])
        GiftCardTransaction.objects.create(
            company=gift_card.company,
            gift_card=gift_card,
            type=GiftCardTransaction.Type.RELOAD,
            amount_cents=amount,
        )
        return Response(GiftCardSerializer(gift_card).data)


class GiftCardTransactionViewSet(CompanyScopedViewSet):
    http_method_names = ["get", "head", "options"]
    queryset = GiftCardTransaction.objects.select_related("gift_card").all()
    serializer_class = GiftCardTransactionSerializer
    permission_module = "retail"

    def get_queryset(self):
        qs = super().get_queryset()
        gift_card_id = self.request.query_params.get("gift_card")
        if gift_card_id:
            qs = qs.filter(gift_card_id=gift_card_id)
        return qs


class RetailReturnViewSet(CompanyScopedViewSet):
    http_method_names = ["get", "post", "head", "options"]
    queryset = RetailReturn.objects.select_related("sale").prefetch_related("lines__sale_line__item")
    serializer_class = RetailReturnSerializer
    permission_module = "retail"

    def get_queryset(self):
        qs = super().get_queryset()
        sale_id = self.request.query_params.get("sale")
        if sale_id:
            qs = qs.filter(sale_id=sale_id)
        return qs
