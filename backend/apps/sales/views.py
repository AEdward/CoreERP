from django.db import transaction
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.auditlog.models import AuditLog
from apps.auditlog.services import log_audit
from apps.common.views import CompanyScopedViewSet
from apps.inventory.serializers import StockMovementSerializer

from .models import CreditNote, Invoice, Quotation, SalesOrder
from .serializers import CreditNoteSerializer, InvoiceSerializer, QuotationSerializer, SalesOrderSerializer


class QuotationViewSet(CompanyScopedViewSet):
    queryset = Quotation.objects.select_related("customer").prefetch_related("lines__item")
    serializer_class = QuotationSerializer
    permission_module = "sales"


class SalesOrderViewSet(CompanyScopedViewSet):
    queryset = SalesOrder.objects.select_related("customer", "quotation").prefetch_related("lines__item")
    serializer_class = SalesOrderSerializer
    permission_module = "sales"

    @action(detail=True, methods=["post"], url_path="dispatch")
    def dispatch_order(self, request, pk=None):
        """Closes the module map's "(partial) Goods Dispatch" gap — the
        Sales mirror of apps.procurement.PurchaseOrderViewSet.receive.
        No approval flow gates this (SalesOrder has none), so it's
        allowed from pending/processing — anything not already fulfilled
        or cancelled. Named dispatch_order, not dispatch: DRF ViewSets
        inherit View.dispatch() — the core HTTP method router — and a
        same-named @action silently shadows it, breaking every request
        the ViewSet handles. url_path keeps the actual URL unchanged."""
        order = self.get_object()
        if order.status not in (SalesOrder.Status.PENDING, SalesOrder.Status.PROCESSING):
            raise ValidationError("This order can't be dispatched from its current status.")

        warehouse_id = request.data.get("warehouse")
        if not warehouse_id:
            raise ValidationError({"warehouse": "Required."})

        dispatches = request.data.get("lines") or []
        if not dispatches:
            raise ValidationError({"lines": "At least one line is required."})
        lines_by_id = {line.id: line for line in order.lines.all()}

        with transaction.atomic():
            for entry in dispatches:
                line = lines_by_id.get(entry.get("line"))
                if line is None:
                    raise ValidationError({"lines": "Unknown line for this sales order."})
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
                        "type": "out",
                        "quantity": quantity,
                        "reference": f"SO-{order.id} dispatch",
                    },
                    context={"request": request},
                )
                movement_serializer.is_valid(raise_exception=True)
                movement = movement_serializer.save(company=request.company)
                # Bypasses StockMovementViewSet.perform_create (this goes
                # through the serializer directly, the same pattern
                # PurchaseOrderViewSet.receive uses), so the movement
                # needs its audit-log write added explicitly.
                log_audit(request, movement, AuditLog.Action.CREATED)

                line.dispatched_quantity += quantity
                line.save(update_fields=["dispatched_quantity"])

            order.refresh_from_db()
            if all(line.outstanding_quantity == 0 for line in order.lines.all()):
                order.status = SalesOrder.Status.FULFILLED
            else:
                order.status = SalesOrder.Status.PROCESSING
            order.save(update_fields=["status"])

        return Response(SalesOrderSerializer(order).data)


class InvoiceViewSet(CompanyScopedViewSet):
    queryset = Invoice.objects.select_related("sales_order")
    serializer_class = InvoiceSerializer
    permission_module = "sales"
    # Issuing an invoice auto-posts a journal entry (apps.accounting.signals);
    # editing or deleting it afterwards would desync the ledger from the
    # document, same reasoning as JournalEntry/Payment being append-only.
    # Correcting a mistake means a void status change or a reversing entry,
    # not editing history.
    http_method_names = ["get", "post", "head", "options"]


class CreditNoteViewSet(CompanyScopedViewSet):
    queryset = CreditNote.objects.select_related("invoice")
    serializer_class = CreditNoteSerializer
    permission_module = "sales"
    # Same reasoning as Invoice/Bill above — posts a journal entry on
    # creation, so editing or deleting it afterwards would desync the
    # ledger.
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        qs = super().get_queryset()
        invoice_id = self.request.query_params.get("invoice")
        if invoice_id:
            qs = qs.filter(invoice_id=invoice_id)
        return qs
