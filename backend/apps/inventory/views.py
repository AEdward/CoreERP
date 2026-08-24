from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.auditlog.models import AuditLog
from apps.auditlog.services import log_audit
from apps.common.views import CompanyScopedReadOnlyViewSet, CompanyScopedViewSet

from .models import Stock, StockCount, StockCountLine, StockMovement, Warehouse
from .serializers import (
    StockCountSerializer,
    StockMovementSerializer,
    StockSerializer,
    WarehouseSerializer,
)


class WarehouseViewSet(CompanyScopedViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    permission_module = "inventory"


class StockViewSet(CompanyScopedReadOnlyViewSet):
    """Read-only — quantities are only ever mutated via StockMovement."""

    queryset = Stock.objects.select_related("item", "warehouse").all()
    serializer_class = StockSerializer
    permission_module = "inventory"


class StockMovementViewSet(CompanyScopedViewSet):
    queryset = StockMovement.objects.select_related("item", "warehouse", "to_warehouse").all()
    serializer_class = StockMovementSerializer
    permission_module = "inventory"
    http_method_names = ["get", "post", "head", "options"]  # movements are an append-only ledger


class StockCountViewSet(CompanyScopedViewSet):
    queryset = StockCount.objects.select_related("warehouse").prefetch_related("lines__item")
    serializer_class = StockCountSerializer
    permission_module = "inventory"
    # A count's header/snapshot is append-only; only its lines' counted_quantity
    # (via record_counts) and its status (via finalize) ever change.
    http_method_names = ["get", "post", "head", "options"]

    @action(detail=True, methods=["post"])
    def record_counts(self, request, pk=None):
        """Bulk-sets counted_quantity for this count's lines:
        {"lines": [{"id": <line id>, "counted_quantity": <int>}, ...]}
        """
        count = self.get_object()
        if count.status != StockCount.Status.OPEN:
            raise ValidationError("This count is already completed.")

        lines_by_id = {line.id: line for line in count.lines.all()}
        to_update = []
        for entry in request.data.get("lines", []):
            line = lines_by_id.get(entry.get("id"))
            if line is None:
                continue
            line.counted_quantity = entry.get("counted_quantity")
            to_update.append(line)
        StockCountLine.objects.bulk_update(to_update, ["counted_quantity"])
        return Response(StockCountSerializer(count).data)

    @action(detail=True, methods=["post"])
    def finalize(self, request, pk=None):
        """Posts one adjustment StockMovement per line whose counted
        quantity differs from the system quantity, then closes the
        count. Goes through StockMovementSerializer directly (the same
        pattern PurchaseOrderViewSet.receive uses for Goods Receipt),
        not StockMovementViewSet.perform_create — so each movement needs
        its audit-log write added explicitly here, same as that action."""
        count = self.get_object()
        if count.status != StockCount.Status.OPEN:
            raise ValidationError("This count is already completed.")

        for line in count.lines.select_related("item"):
            if line.counted_quantity is None:
                continue
            delta = line.counted_quantity - line.system_quantity
            if delta != 0:
                movement_serializer = StockMovementSerializer(
                    data={
                        "item": line.item_id,
                        "warehouse": count.warehouse_id,
                        "type": StockMovement.MovementType.ADJUSTMENT,
                        "quantity": delta,
                        "reference": f"Stock count #{count.id}",
                    },
                    context={"request": request},
                )
                movement_serializer.is_valid(raise_exception=True)
                movement = movement_serializer.save(company=request.company)
                log_audit(request, movement, AuditLog.Action.CREATED)

        count.status = StockCount.Status.COMPLETED
        count.completed_at = timezone.now()
        count.save(update_fields=["status", "completed_at"])
        return Response(StockCountSerializer(count).data)
