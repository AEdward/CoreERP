from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.common.numbering import next_number
from apps.common.views import CompanyScopedViewSet
from apps.hotel.models import FolioCharge, GuestFolio
from apps.tax.engine import compute_inclusive_tax_cents

from .models import LaundryOrder, LaundryOrderLine
from .serializers import AddLaundryOrderLineSerializer, LaundryOrderSerializer


class LaundryOrderViewSet(CompanyScopedViewSet):
    queryset = LaundryOrder.objects.select_related("reservation", "guest").prefetch_related("lines__item")
    serializer_class = LaundryOrderSerializer
    permission_module = "laundry"

    @action(detail=True, methods=["post"])
    def start_washing(self, request, pk=None):
        return self._track(request, pk, LaundryOrder.TrackingStatus.RECEIVED, LaundryOrder.TrackingStatus.WASHING)

    @action(detail=True, methods=["post"])
    def mark_ready(self, request, pk=None):
        return self._track(request, pk, LaundryOrder.TrackingStatus.WASHING, LaundryOrder.TrackingStatus.READY)

    @action(detail=True, methods=["post"])
    def deliver(self, request, pk=None):
        return self._track(request, pk, LaundryOrder.TrackingStatus.READY, LaundryOrder.TrackingStatus.DELIVERED)

    def _track(self, request, pk, expected_from, to):
        order = self.get_object()
        if order.tracking_status != expected_from:
            raise ValidationError(
                {"tracking_status": f"Only a '{expected_from}' order can move to '{to}' from here."}
            )
        order.tracking_status = to
        order.save(update_fields=["tracking_status"])
        return Response(LaundryOrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def charge_to_room(self, request, pk=None):
        order = self.get_object()
        if order.category != LaundryOrder.Category.GUEST:
            raise ValidationError({"category": "Only a guest order can be billed."})
        if order.status != LaundryOrder.Status.OPEN:
            raise ValidationError({"status": "Only an open order can be closed."})
        if order.reservation_id is None:
            raise ValidationError({"reservation": "This order has no room to charge — assign one first."})

        folio = getattr(order.reservation, "folio", None)
        if folio is None or folio.status != GuestFolio.Status.OPEN:
            raise ValidationError(
                {"reservation": "That guest's folio is closed — they may have already checked out."}
            )

        with transaction.atomic():
            line_count = order.lines.count()
            FolioCharge.objects.create(
                company=order.company,
                folio=folio,
                source_module=FolioCharge.SourceModule.LAUNDRY,
                description=f"Laundry order #{order.id} ({line_count} item{'s' if line_count != 1 else ''})",
                amount_cents=order.total_cents,
                tax_amount_cents=compute_inclusive_tax_cents(
                    order.company, order.total_cents, applies_to_room=False
                ),
            )
            order.status = LaundryOrder.Status.CHARGED_TO_ROOM
            order.receipt_number = next_number(order.company, "LDY")
            order.closed_at = timezone.now()
            order.save(update_fields=["status", "receipt_number", "closed_at"])

        return Response(LaundryOrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def mark_paid(self, request, pk=None):
        order = self.get_object()
        if order.category != LaundryOrder.Category.GUEST:
            raise ValidationError({"category": "Only a guest order can be billed."})
        if order.status != LaundryOrder.Status.OPEN:
            raise ValidationError({"status": "Only an open order can be closed."})

        order.status = LaundryOrder.Status.PAID
        order.receipt_number = next_number(order.company, "LDY")
        order.closed_at = timezone.now()
        order.save(update_fields=["status", "receipt_number", "closed_at"])
        return Response(LaundryOrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status != LaundryOrder.Status.OPEN:
            raise ValidationError({"status": "Only an open order can be cancelled."})
        order.status = LaundryOrder.Status.CANCELLED
        order.save(update_fields=["status"])
        return Response(LaundryOrderSerializer(order).data)


class LaundryOrderLineViewSet(CompanyScopedViewSet):
    """Adding items to an already-open order — mirrors apps.pos.OrderLineViewSet."""

    queryset = LaundryOrderLine.objects.select_related("order", "item").all()
    serializer_class = AddLaundryOrderLineSerializer
    permission_module = "laundry"
    http_method_names = ["get", "post", "head", "options"]
