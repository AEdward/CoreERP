from django.db import transaction
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.auditlog.models import AuditLog
from apps.auditlog.services import log_audit
from apps.common.views import CompanyScopedViewSet
from apps.inventory.serializers import StockMovementSerializer
from apps.suppliers.models import Supplier

from .models import Bill, PurchaseOrder, PurchaseOrderLine, PurchaseRequest, PurchaseReturn
from .serializers import (
    BillSerializer,
    PurchaseOrderSerializer,
    PurchaseRequestSerializer,
    PurchaseReturnSerializer,
)


class PurchaseRequestViewSet(CompanyScopedViewSet):
    queryset = PurchaseRequest.objects.select_related(
        "requested_by", "converted_purchase_order"
    ).prefetch_related("lines__item")
    serializer_class = PurchaseRequestSerializer
    permission_module = "procurement"

    @action(detail=True, methods=["post"])
    def convert(self, request, pk=None):
        purchase_request = self.get_object()
        if purchase_request.status != PurchaseRequest.Status.APPROVED:
            raise ValidationError("Only an approved purchase request can be converted.")

        supplier_id = request.data.get("supplier")
        if not supplier_id:
            raise ValidationError({"supplier": "Required."})
        try:
            supplier = Supplier.objects.get(company=request.company, pk=supplier_id)
        except Supplier.DoesNotExist as exc:
            raise ValidationError({"supplier": "Must belong to the active company."}) from exc

        with transaction.atomic():
            order = PurchaseOrder.objects.create(company=request.company, supplier=supplier)
            for line in purchase_request.lines.all():
                PurchaseOrderLine.objects.create(
                    company=request.company,
                    purchase_order=order,
                    item=line.item,
                    quantity=line.quantity,
                    unit_cost_cents=line.estimated_unit_cost_cents,
                )
            purchase_request.status = PurchaseRequest.Status.CONVERTED
            purchase_request.converted_purchase_order = order
            purchase_request.save(update_fields=["status", "converted_purchase_order"])

            # Bypasses perform_create (this is a custom @action) — needs
            # the same audit-log write perform_create would give it, the
            # same PettyCashTransactionViewSet gap avoided here.
            log_audit(request, order, AuditLog.Action.CREATED)

        return Response(PurchaseRequestSerializer(purchase_request).data)


class PurchaseOrderViewSet(CompanyScopedViewSet):
    queryset = PurchaseOrder.objects.select_related("supplier").prefetch_related("lines__item")
    serializer_class = PurchaseOrderSerializer
    permission_module = "procurement"

    @action(detail=True, methods=["post"])
    def receive(self, request, pk=None):
        order = self.get_object()
        if order.status != PurchaseOrder.Status.APPROVED:
            raise ValidationError("Only an approved purchase order can be received.")

        warehouse_id = request.data.get("warehouse")
        if not warehouse_id:
            raise ValidationError({"warehouse": "Required."})

        receipts = request.data.get("lines") or []
        if not receipts:
            raise ValidationError({"lines": "At least one line is required."})
        lines_by_id = {line.id: line for line in order.lines.all()}

        with transaction.atomic():
            for entry in receipts:
                line = lines_by_id.get(entry.get("line"))
                if line is None:
                    raise ValidationError({"lines": "Unknown line for this purchase order."})
                quantity = entry.get("quantity") or 0
                if quantity <= 0:
                    raise ValidationError({"lines": "Quantity must be positive."})
                if quantity > line.outstanding_quantity:
                    raise ValidationError(
                        {"lines": f"Only {line.outstanding_quantity} outstanding on this line."}
                    )

                movement_serializer = StockMovementSerializer(
                    data={
                        "item": line.item_id,
                        "warehouse": warehouse_id,
                        "type": "in",
                        "quantity": quantity,
                        "reference": f"PO-{order.id} receipt",
                    },
                    context={"request": request},
                )
                movement_serializer.is_valid(raise_exception=True)
                movement = movement_serializer.save(company=request.company)
                # Same reasoning as PurchaseRequestViewSet.convert above —
                # this bypasses StockMovementViewSet.perform_create, so
                # the movement needs its audit-log write added explicitly.
                log_audit(request, movement, AuditLog.Action.CREATED)

                line.received_quantity += quantity
                line.save(update_fields=["received_quantity"])

            order.refresh_from_db()
            if all(line.outstanding_quantity == 0 for line in order.lines.all()):
                order.status = PurchaseOrder.Status.RECEIVED
                order.save(update_fields=["status"])

        return Response(PurchaseOrderSerializer(order).data)


class BillViewSet(CompanyScopedViewSet):
    queryset = Bill.objects.select_related("purchase_order")
    serializer_class = BillSerializer
    permission_module = "procurement"
    # Same reasoning as InvoiceViewSet: recording a bill auto-posts a
    # journal entry, so it's append-only to keep the ledger and the
    # document in sync.
    http_method_names = ["get", "post", "head", "options"]


class PurchaseReturnViewSet(CompanyScopedViewSet):
    queryset = PurchaseReturn.objects.select_related("bill")
    serializer_class = PurchaseReturnSerializer
    permission_module = "procurement"
    # Same reasoning as CreditNoteViewSet: posts a journal entry on
    # creation, so it's append-only to keep the ledger in sync.
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = super().get_queryset()
        bill_id = self.request.query_params.get("bill")
        if bill_id:
            qs = qs.filter(bill_id=bill_id)
        return qs
