from collections import defaultdict

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.auditlog.models import AuditLog
from apps.auditlog.services import log_audit
from apps.catalog.models import Item
from apps.common.views import CompanyScopedViewSet
from apps.inventory.models import Stock, StockMovement
from apps.inventory.serializers import StockMovementSerializer

from .models import (
    BillOfMaterial,
    Machine,
    MachineMaintenanceLog,
    MaterialConsumption,
    ProductionOrder,
    QualityCheck,
    ScrapEntry,
    WorkCenter,
    WorkOrder,
)
from .serializers import (
    BillOfMaterialSerializer,
    MachineMaintenanceLogSerializer,
    MachineSerializer,
    MaterialConsumptionSerializer,
    ProductionOrderSerializer,
    QualityCheckSerializer,
    ScrapEntrySerializer,
    WorkCenterSerializer,
    WorkOrderSerializer,
)


class WorkCenterViewSet(CompanyScopedViewSet):
    queryset = WorkCenter.objects.all()
    serializer_class = WorkCenterSerializer
    permission_module = "manufacturing"


class MachineViewSet(CompanyScopedViewSet):
    queryset = Machine.objects.select_related("work_center").all()
    serializer_class = MachineSerializer
    permission_module = "manufacturing"


class MachineMaintenanceLogViewSet(CompanyScopedViewSet):
    queryset = MachineMaintenanceLog.objects.select_related("machine").all()
    serializer_class = MachineMaintenanceLogSerializer
    permission_module = "manufacturing"

    def get_queryset(self):
        qs = super().get_queryset()
        machine_id = self.request.query_params.get("machine")
        if machine_id:
            qs = qs.filter(machine_id=machine_id)
        return qs


class BillOfMaterialViewSet(CompanyScopedViewSet):
    queryset = BillOfMaterial.objects.select_related("output_item").prefetch_related(
        "lines__component_item", "byproducts__item", "operations__work_center"
    )
    serializer_class = BillOfMaterialSerializer
    permission_module = "manufacturing"


class WorkOrderViewSet(CompanyScopedViewSet):
    queryset = WorkOrder.objects.select_related("production_order", "work_center").all()
    serializer_class = WorkOrderSerializer
    permission_module = "manufacturing"

    def get_queryset(self):
        qs = super().get_queryset()
        production_order_id = self.request.query_params.get("production_order")
        if production_order_id:
            qs = qs.filter(production_order_id=production_order_id)
        return qs

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        work_order = self.get_object()
        if work_order.status != WorkOrder.Status.PENDING:
            raise ValidationError("Only a pending work order can be started.")
        work_order.status = WorkOrder.Status.IN_PROGRESS
        work_order.started_at = timezone.now()
        work_order.save(update_fields=["status", "started_at"])
        return Response(WorkOrderSerializer(work_order).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        work_order = self.get_object()
        if work_order.status == WorkOrder.Status.COMPLETED:
            raise ValidationError("This work order is already completed.")
        actual_hours = request.data.get("actual_hours")
        work_order.actual_hours = actual_hours if actual_hours is not None else work_order.planned_hours
        work_order.status = WorkOrder.Status.COMPLETED
        work_order.completed_at = timezone.now()
        work_order.save(update_fields=["actual_hours", "status", "completed_at"])
        return Response(WorkOrderSerializer(work_order).data)


class MaterialConsumptionViewSet(CompanyScopedViewSet):
    http_method_names = ["get", "head", "options"]
    queryset = MaterialConsumption.objects.select_related("item", "production_order").all()
    serializer_class = MaterialConsumptionSerializer
    permission_module = "manufacturing"

    def get_queryset(self):
        qs = super().get_queryset()
        production_order_id = self.request.query_params.get("production_order")
        if production_order_id:
            qs = qs.filter(production_order_id=production_order_id)
        return qs


class ScrapEntryViewSet(CompanyScopedViewSet):
    queryset = ScrapEntry.objects.select_related("item", "production_order").all()
    serializer_class = ScrapEntrySerializer
    permission_module = "manufacturing"

    def get_queryset(self):
        qs = super().get_queryset()
        production_order_id = self.request.query_params.get("production_order")
        if production_order_id:
            qs = qs.filter(production_order_id=production_order_id)
        return qs


class QualityCheckViewSet(CompanyScopedViewSet):
    queryset = QualityCheck.objects.select_related("production_order", "checked_by").all()
    serializer_class = QualityCheckSerializer
    permission_module = "manufacturing"

    def get_queryset(self):
        qs = super().get_queryset()
        production_order_id = self.request.query_params.get("production_order")
        if production_order_id:
            qs = qs.filter(production_order_id=production_order_id)
        return qs


class ProductionOrderViewSet(CompanyScopedViewSet):
    queryset = ProductionOrder.objects.select_related("bom__output_item", "warehouse").prefetch_related(
        "work_orders__work_center", "material_consumptions", "scrap_entries"
    )
    serializer_class = ProductionOrderSerializer
    permission_module = "manufacturing"

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        order = self.get_object()
        if order.status != ProductionOrder.Status.PLANNED:
            raise ValidationError("Only a planned order can be started.")
        order.status = ProductionOrder.Status.IN_PROGRESS
        order.started_at = timezone.now()
        order.save(update_fields=["status", "started_at"])
        return Response(ProductionOrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status in (ProductionOrder.Status.COMPLETED, ProductionOrder.Status.CANCELLED):
            raise ValidationError("This order can no longer be cancelled.")
        order.status = ProductionOrder.Status.CANCELLED
        order.save(update_fields=["status"])
        return Response(ProductionOrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        order = self.get_object()
        if order.status != ProductionOrder.Status.IN_PROGRESS:
            raise ValidationError("Only an in-progress order can be completed.")
        order.status = ProductionOrder.Status.COMPLETED
        order.completed_at = timezone.now()
        order.save(update_fields=["status", "completed_at"])
        return Response(ProductionOrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def consume(self, request, pk=None):
        """Issue raw material against this order — an OUT StockMovement
        from the order's warehouse, built through the same
        StockMovementSerializer every other stock-moving feature goes
        through (Goods Receipt/Dispatch, Stock Counts, maintenance spare
        parts), plus the MaterialConsumption row that ties it back to
        this production run for costing (unit_cost_cents snapshots
        Item.cost_cents at the moment of consumption)."""
        order = self.get_object()
        if order.status != ProductionOrder.Status.IN_PROGRESS:
            raise ValidationError("Start the order before consuming materials.")
        item = get_object_or_404(Item, pk=request.data.get("item"), company=order.company)
        quantity = request.data.get("quantity") or 0
        if quantity <= 0:
            raise ValidationError({"quantity": "Must be a positive whole number."})

        with transaction.atomic():
            movement_serializer = StockMovementSerializer(
                data={
                    "item": item.id,
                    "warehouse": order.warehouse_id,
                    "type": StockMovement.MovementType.OUT,
                    "quantity": quantity,
                    "reference": f"{order.number} consumption",
                },
                context={"request": request},
            )
            movement_serializer.is_valid(raise_exception=True)
            movement = movement_serializer.save(company=order.company)
            log_audit(request, movement, AuditLog.Action.CREATED)

            consumption = MaterialConsumption.objects.create(
                company=order.company,
                production_order=order,
                item=item,
                quantity=quantity,
                unit_cost_cents=item.cost_cents,
                movement=movement,
            )
        return Response(MaterialConsumptionSerializer(consumption).data, status=201)

    @action(detail=True, methods=["post"])
    def produce(self, request, pk=None):
        """Receive finished output into stock — an IN StockMovement of
        the BOM's output_item, plus one more per BOMByproduct scaled to
        the same quantity. Can be called more than once (partial/
        staggered completion); produced_quantity can't exceed the
        order's planned quantity."""
        order = self.get_object()
        if order.status != ProductionOrder.Status.IN_PROGRESS:
            raise ValidationError("Only an in-progress order can produce output.")
        quantity = request.data.get("quantity") or 0
        if quantity <= 0:
            raise ValidationError({"quantity": "Must be a positive whole number."})
        if order.produced_quantity + quantity > order.quantity:
            raise ValidationError({"quantity": "Would exceed this order's planned quantity."})

        with transaction.atomic():
            def receive(item_id, qty):
                movement_serializer = StockMovementSerializer(
                    data={
                        "item": item_id,
                        "warehouse": order.warehouse_id,
                        "type": StockMovement.MovementType.IN,
                        "quantity": qty,
                        "reference": f"{order.number} production",
                    },
                    context={"request": request},
                )
                movement_serializer.is_valid(raise_exception=True)
                movement = movement_serializer.save(company=order.company)
                log_audit(request, movement, AuditLog.Action.CREATED)

            receive(order.bom.output_item_id, quantity)
            for byproduct in order.bom.byproducts.all():
                receive(byproduct.item_id, byproduct.quantity_per_unit * quantity)

            order.produced_quantity += quantity
            order.save(update_fields=["produced_quantity"])
        return Response(ProductionOrderSerializer(order).data)

    @action(detail=False, methods=["get"], url_path="shortage-report")
    def shortage_report(self, request):
        """MRP-lite: outstanding component requirements (BOM quantity x
        order quantity, minus what's already been consumed) across every
        open production order, netted against current on-hand Stock per
        (item, warehouse). Same restrained scope as Inventory's own
        reorder-suggestions feature — a netting report, not a scheduling
        engine."""
        company = request.company
        open_orders = ProductionOrder.objects.filter(
            company=company,
            status__in=[ProductionOrder.Status.PLANNED, ProductionOrder.Status.IN_PROGRESS],
        ).select_related("bom", "warehouse").prefetch_related(
            "bom__lines__component_item", "material_consumptions"
        )

        required = defaultdict(int)
        item_names = {}
        warehouse_names = {}
        for order in open_orders:
            consumed_by_item = defaultdict(int)
            for consumption in order.material_consumptions.all():
                consumed_by_item[consumption.item_id] += consumption.quantity
            for line in order.bom.lines.all():
                outstanding = line.quantity_per_unit * order.quantity - consumed_by_item[line.component_item_id]
                if outstanding > 0:
                    key = (line.component_item_id, order.warehouse_id)
                    required[key] += outstanding
                    item_names[line.component_item_id] = line.component_item.name
                    warehouse_names[order.warehouse_id] = order.warehouse.name

        stock_by_key = {}
        if required:
            item_ids = {key[0] for key in required}
            warehouse_ids = {key[1] for key in required}
            stock_by_key = {
                (s.item_id, s.warehouse_id): s.quantity
                for s in Stock.objects.filter(
                    company=company, item_id__in=item_ids, warehouse_id__in=warehouse_ids
                )
            }

        results = []
        for (item_id, warehouse_id), needed in required.items():
            on_hand = stock_by_key.get((item_id, warehouse_id), 0)
            shortage = needed - on_hand
            if shortage > 0:
                results.append(
                    {
                        "item": item_id,
                        "item_name": item_names[item_id],
                        "warehouse": warehouse_id,
                        "warehouse_name": warehouse_names[warehouse_id],
                        "required_quantity": needed,
                        "on_hand_quantity": on_hand,
                        "shortage_quantity": shortage,
                    }
                )
        results.sort(key=lambda r: -r["shortage_quantity"])
        return Response(results)
