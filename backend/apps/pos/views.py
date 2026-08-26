from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from apps.catalog.models import Item
from apps.common.numbering import next_number
from apps.common.views import CompanyScopedViewSet
from apps.hotel.models import FolioCharge
from apps.tax.engine import compute_inclusive_tax_cents

from .models import HappyHourRule, Order, OrderLine, Promotion, Table
from .pricing import compute_happy_hour_price_cents
from .serializers import (
    AddOrderLineSerializer,
    HappyHourRuleSerializer,
    OrderSerializer,
    PromotionSerializer,
    TableSerializer,
    get_open_folio_for_reservation,
)

# Order.table.area values line up with FolioCharge.SourceModule's choices
# for restaurant/bar exactly (both "restaurant"/"bar") — outdoor tables and
# tableless (room service / takeaway) orders fall back to "misc" since
# FolioCharge has no dedicated bucket for either.
TABLE_AREA_TO_FOLIO_SOURCE = {
    Table.Area.RESTAURANT: FolioCharge.SourceModule.RESTAURANT,
    Table.Area.BAR: FolioCharge.SourceModule.BAR,
}


class TableViewSet(CompanyScopedViewSet):
    queryset = Table.objects.all()
    serializer_class = TableSerializer
    permission_module = "pos"


class OrderViewSet(CompanyScopedViewSet):
    queryset = Order.objects.select_related("table", "reservation", "guest", "server").prefetch_related(
        "lines__item"
    )
    serializer_class = OrderSerializer
    permission_module = "pos"

    @action(detail=True, methods=["post"])
    def charge_to_room(self, request, pk=None):
        order = self.get_object()
        if order.status != Order.Status.OPEN:
            raise ValidationError({"status": "Only an open order can be closed."})
        if order.reservation_id is None:
            raise ValidationError({"reservation": "This order has no room to charge — assign one first."})

        folio = get_open_folio_for_reservation(order.reservation)
        if folio is None:
            raise ValidationError(
                {"reservation": "That guest's folio is closed — they may have already checked out."}
            )

        with transaction.atomic():
            source_module = TABLE_AREA_TO_FOLIO_SOURCE.get(
                order.table.area if order.table else None, FolioCharge.SourceModule.MISC
            )
            line_count = order.lines.count()
            FolioCharge.objects.create(
                company=order.company,
                folio=folio,
                source_module=source_module,
                description=f"POS order #{order.id} ({line_count} item{'s' if line_count != 1 else ''})",
                amount_cents=order.total_cents,
                tax_amount_cents=compute_inclusive_tax_cents(
                    order.company, order.total_cents, applies_to_room=False
                ),
            )
            order.status = Order.Status.CHARGED_TO_ROOM
            order.receipt_number = next_number(order.company, "ORD")
            order.closed_at = timezone.now()
            order.save(update_fields=["status", "receipt_number", "closed_at"])

        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def mark_paid(self, request, pk=None):
        order = self.get_object()
        if order.status != Order.Status.OPEN:
            raise ValidationError({"status": "Only an open order can be closed."})

        order.status = Order.Status.PAID
        order.receipt_number = next_number(order.company, "ORD")
        order.closed_at = timezone.now()
        order.save(update_fields=["status", "receipt_number", "closed_at"])
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status != Order.Status.OPEN:
            raise ValidationError({"status": "Only an open order can be cancelled."})

        order.status = Order.Status.CANCELLED
        order.save(update_fields=["status"])
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def split(self, request, pk=None):
        """Moves the named lines off this order onto a brand-new one —
        splitting a table's bill into separate checks. Each resulting
        order still closes (pay/charge_to_room/cancel) through the exact
        same single-order path every other order does; this action only
        ever creates OPEN orders and reassigns existing OrderLine rows,
        never touches money or kitchen_status."""
        order = self.get_object()
        if order.status != Order.Status.OPEN:
            raise ValidationError({"status": "Only an open order can be split."})

        line_ids = request.data.get("line_ids") or []
        if not line_ids:
            raise ValidationError({"line_ids": "Select at least one line to split off."})

        lines = list(order.lines.filter(id__in=line_ids))
        if len(lines) != len(set(line_ids)):
            raise ValidationError({"line_ids": "One or more lines don't belong to this order."})
        if len(lines) == order.lines.count():
            raise ValidationError(
                {"line_ids": "Can't split off every line — cancel the order instead if nothing should remain."}
            )

        with transaction.atomic():
            new_order = Order.objects.create(
                company=order.company,
                table=order.table,
                reservation=order.reservation,
                guest=order.guest,
                server=order.server,
                split_from=order,
            )
            OrderLine.objects.filter(id__in=[line.id for line in lines]).update(order=new_order)

        order.refresh_from_db()
        return Response(
            {
                "original": OrderSerializer(order).data,
                "new_order": OrderSerializer(new_order).data,
            },
            status=201,
        )

    @action(detail=True, methods=["post"])
    def apply_promotion(self, request, pk=None):
        """A manually-applied, order-level discount — see Promotion's
        own docstring for how this differs from Happy Hour's automatic
        per-line pricing. Overwrites discount_cents outright rather than
        adding to whatever was already there, since re-applying (or
        applying a different promotion) should replace, not stack."""
        order = self.get_object()
        if order.status != Order.Status.OPEN:
            raise ValidationError({"status": "Only an open order can have a promotion applied."})

        promotion_id = request.data.get("promotion")
        if not promotion_id:
            raise ValidationError({"promotion": "promotion is required."})
        try:
            promotion = Promotion.objects.get(company=order.company, id=promotion_id)
        except Promotion.DoesNotExist:
            raise NotFound("Promotion not found.")

        today = timezone.localdate()
        if not promotion.is_active or not (promotion.start_date <= today <= promotion.end_date):
            raise ValidationError({"promotion": "This promotion isn't currently active."})

        discount_cents = round(order.subtotal_cents * float(promotion.discount_percent) / 100)
        order.discount_cents = discount_cents
        order.promotion = promotion
        order.save(update_fields=["discount_cents", "promotion"])
        return Response(OrderSerializer(order).data)


class OrderLineViewSet(CompanyScopedViewSet):
    """Adding items to an existing open order — see AddOrderLineSerializer.
    Kitchen status moves through start_preparing/mark_ready/mark_served
    below; this is what the Kitchen Display System reads and drives, not
    a separate model."""

    queryset = OrderLine.objects.select_related("order", "item").all()
    serializer_class = AddOrderLineSerializer
    permission_module = "pos"
    http_method_names = ["get", "post", "head", "options"]

    @action(detail=False, methods=["get"])
    def suggested_price(self, request):
        """Happy Hour quote preview — the price a bartender would see
        before adding a line, computed by the exact same function a real
        order-line addition could use to prefill the price field."""
        item_id = request.query_params.get("item")
        if not item_id:
            raise ValidationError({"item": "item is required."})
        try:
            item = Item.objects.get(company=request.company, id=item_id)
        except Item.DoesNotExist:
            raise NotFound("Item not found.")
        return Response(compute_happy_hour_price_cents(item, item.price_cents))

    @action(detail=True, methods=["post"])
    def start_preparing(self, request, pk=None):
        return self._transition(request, pk, OrderLine.KitchenStatus.QUEUED, OrderLine.KitchenStatus.PREPARING)

    @action(detail=True, methods=["post"])
    def mark_ready(self, request, pk=None):
        return self._transition(
            request, pk, OrderLine.KitchenStatus.PREPARING, OrderLine.KitchenStatus.READY
        )

    @action(detail=True, methods=["post"])
    def mark_served(self, request, pk=None):
        return self._transition(request, pk, OrderLine.KitchenStatus.READY, OrderLine.KitchenStatus.SERVED)

    def _transition(self, request, pk, expected_from, to):
        line = self.get_object()
        if line.kitchen_status != expected_from:
            raise ValidationError(
                {"kitchen_status": f"Only a '{expected_from}' line can move to '{to}' from here."}
            )
        update_fields = ["kitchen_status"]
        line.kitchen_status = to
        # Stage-start timestamps, set only once — the moment the line
        # actually enters that stage, not recomputed on any later change.
        if to == OrderLine.KitchenStatus.PREPARING:
            line.started_preparing_at = timezone.now()
            update_fields.append("started_preparing_at")
        elif to == OrderLine.KitchenStatus.READY:
            line.ready_at = timezone.now()
            update_fields.append("ready_at")
        line.save(update_fields=update_fields)
        return Response(AddOrderLineSerializer(line).data)

    @action(detail=True, methods=["post"])
    def mark_rush(self, request, pk=None):
        return self._set_rush(pk, True)

    @action(detail=True, methods=["post"])
    def unmark_rush(self, request, pk=None):
        return self._set_rush(pk, False)

    def _set_rush(self, pk, is_rush):
        line = self.get_object()
        if line.kitchen_status == OrderLine.KitchenStatus.SERVED:
            raise ValidationError({"is_rush": "Already served — nothing left to prioritize."})
        line.is_rush = is_rush
        line.save(update_fields=["is_rush"])
        return Response(AddOrderLineSerializer(line).data)


class HappyHourRuleViewSet(CompanyScopedViewSet):
    queryset = HappyHourRule.objects.all()
    serializer_class = HappyHourRuleSerializer
    permission_module = "pos"


class PromotionViewSet(CompanyScopedViewSet):
    queryset = Promotion.objects.all()
    serializer_class = PromotionSerializer
    permission_module = "pos"
