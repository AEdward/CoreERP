from django.db import transaction
from rest_framework import serializers

from apps.common.serializers import CompanyScopedSerializer
from apps.crm.models import Customer
from apps.hotel.models import GuestFolio

from .models import HappyHourRule, Order, OrderLine, Promotion, Table


class TableSerializer(CompanyScopedSerializer):
    class Meta:
        model = Table
        fields = ["id", "name", "area", "capacity", "status", "created_at"]
        read_only_fields = ["id", "created_at"]


class OrderLineSerializer(serializers.ModelSerializer):
    """The read/nested shape — `order` is read-only (or absent, on create)
    because this is only ever reached two ways: embedded read-only inside
    an OrderSerializer response, or as one of Order.create()'s initial
    `lines` (which injects `order` itself — see OrderSerializer._create_lines,
    same pattern as apps.sales.QuotationLineSerializer omitting `quotation`).
    Adding an item to an *already open* order goes through
    AddOrderLineSerializer/OrderLineViewSet instead — see its docstring
    for why this one specifically can't just be reused there.
    """

    item_name = serializers.CharField(source="item.name", read_only=True)
    item_prep_time_minutes = serializers.IntegerField(source="item.prep_time_minutes", read_only=True)
    line_total_cents = serializers.IntegerField(read_only=True)

    class Meta:
        model = OrderLine
        fields = [
            "id",
            "order",
            "item",
            "item_name",
            "item_prep_time_minutes",
            "quantity",
            "unit_price_cents",
            "kitchen_status",
            "is_rush",
            "started_preparing_at",
            "ready_at",
            "line_total_cents",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "order",
            "kitchen_status",
            "started_preparing_at",
            "ready_at",
            "created_at",
        ]


class OrderSerializer(CompanyScopedSerializer):
    # status/receipt_number/closed_at are read-only — every transition
    # goes through charge_to_room/mark_paid/cancel (OrderViewSet), same
    # reasoning as Room/Reservation/HousekeepingTask: closing an order
    # has side effects (folio posting, receipt numbering) a plain PATCH
    # can't be trusted to remember. `lines` is only accepted on create,
    # not update — see AddOrderLineSerializer for adding items after the
    # fact without disturbing already-in-progress kitchen_status on the
    # existing lines (a naive replace-all-lines PATCH, like Quotation
    # uses, would reset every line back to "queued").
    same_company_fields = ["table", "reservation", "guest"]
    lines = OrderLineSerializer(many=True, required=False)
    table_name = serializers.CharField(source="table.name", read_only=True)
    server_name = serializers.CharField(source="server.full_name", read_only=True)
    guest_name = serializers.CharField(source="guest.name", read_only=True)
    promotion_name = serializers.CharField(source="promotion.name", read_only=True)
    subtotal_cents = serializers.IntegerField(read_only=True)
    total_cents = serializers.IntegerField(read_only=True)
    # Derived, not stored — the Kitchen Display's priority queue treats a
    # VIP guest's order as higher priority automatically, same as a
    # manually-flagged rush line, without needing a separate "is this
    # order VIP" checkbox anyone has to remember to tick.
    is_vip_guest = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "table",
            "table_name",
            "reservation",
            "guest",
            "guest_name",
            "is_vip_guest",
            "tab_name",
            "server",
            "server_name",
            "status",
            "discount_cents",
            "promotion",
            "promotion_name",
            "receipt_number",
            "subtotal_cents",
            "total_cents",
            "split_from",
            "lines",
            "closed_at",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "server",
            "status",
            "promotion",
            "receipt_number",
            "closed_at",
            "split_from",
            "created_at",
        ]

    def _create_lines(self, order, company, lines_data):
        for line in lines_data:
            if line["item"].company_id != company.id:
                raise serializers.ValidationError({"lines": "All items must belong to the active company."})
            OrderLine.objects.create(company=company, order=order, **line)

    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        company = validated_data["company"]
        request = self.context["request"]
        with transaction.atomic():
            order = Order.objects.create(server=request.user, **validated_data)
            self._create_lines(order, company, lines_data)
        return order

    def update(self, instance, validated_data):
        # Deliberately ignores `lines` if somehow present — see the class
        # docstring note. Only the handful of fields that make sense to
        # edit on an already-open order (table/reservation/guest/discount).
        validated_data.pop("lines", None)
        return super().update(instance, validated_data)

    def get_is_vip_guest(self, obj):
        return bool(obj.guest_id and obj.guest.type == Customer.Type.VIP)


class AddOrderLineSerializer(serializers.ModelSerializer):
    """Adds one line to an already-open order without touching its
    existing lines' kitchen_status — the thing OrderSerializer's own
    `lines` field deliberately can't do after creation."""

    item_name = serializers.CharField(source="item.name", read_only=True)
    item_prep_time_minutes = serializers.IntegerField(source="item.prep_time_minutes", read_only=True)

    class Meta:
        model = OrderLine
        fields = [
            "id",
            "order",
            "item",
            "item_name",
            "item_prep_time_minutes",
            "quantity",
            "unit_price_cents",
            "kitchen_status",
            "is_rush",
            "started_preparing_at",
            "ready_at",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "kitchen_status",
            "started_preparing_at",
            "ready_at",
            "created_at",
        ]

    def validate(self, attrs):
        request = self.context.get("request")
        company = getattr(request, "company", None) if request else None

        order = attrs.get("order")
        if company and order.company_id != company.id:
            raise serializers.ValidationError({"order": "Must belong to the active company."})
        if order.status != Order.Status.OPEN:
            raise serializers.ValidationError({"order": "Can't add items to a closed or cancelled order."})

        item = attrs.get("item")
        if company and item.company_id != company.id:
            raise serializers.ValidationError({"item": "Must belong to the active company."})

        return attrs


def get_open_folio_for_reservation(reservation):
    folio = getattr(reservation, "folio", None)
    if folio is None or folio.status != GuestFolio.Status.OPEN:
        return None
    return folio


class HappyHourRuleSerializer(CompanyScopedSerializer):
    class Meta:
        model = HappyHourRule
        fields = [
            "id",
            "name",
            "category",
            "day_of_week",
            "start_time",
            "end_time",
            "discount_percent",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        discount = attrs.get("discount_percent", getattr(self.instance, "discount_percent", None))
        if discount is not None and not (0 < discount <= 100):
            raise serializers.ValidationError({"discount_percent": "Must be between 0 and 100."})
        return attrs


class PromotionSerializer(CompanyScopedSerializer):
    class Meta:
        model = Promotion
        fields = [
            "id",
            "name",
            "discount_percent",
            "start_date",
            "end_date",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "End date must be on or after the start date."})
        discount = attrs.get("discount_percent", getattr(self.instance, "discount_percent", None))
        if discount is not None and not (0 < discount <= 100):
            raise serializers.ValidationError({"discount_percent": "Must be between 0 and 100."})
        return attrs
