from django.db import transaction
from rest_framework import serializers

from apps.common.numbering import next_number
from apps.common.serializers import CompanyScopedSerializer

from .models import (
    BillOfMaterial,
    BOMByproduct,
    BOMLine,
    BOMOperation,
    Machine,
    MachineMaintenanceLog,
    MaterialConsumption,
    ProductionOrder,
    QualityCheck,
    ScrapEntry,
    WorkCenter,
    WorkOrder,
)


class WorkCenterSerializer(CompanyScopedSerializer):
    class Meta:
        model = WorkCenter
        fields = ["id", "name", "code", "hourly_rate_cents", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class MachineSerializer(CompanyScopedSerializer):
    same_company_fields = ["work_center"]
    work_center_name = serializers.CharField(source="work_center.name", read_only=True)

    class Meta:
        model = Machine
        fields = ["id", "work_center", "work_center_name", "name", "code", "status", "notes", "created_at"]
        read_only_fields = ["id", "created_at"]


class MachineMaintenanceLogSerializer(CompanyScopedSerializer):
    same_company_fields = ["machine"]
    machine_name = serializers.CharField(source="machine.name", read_only=True)

    class Meta:
        model = MachineMaintenanceLog
        fields = [
            "id",
            "machine",
            "machine_name",
            "performed_at",
            "description",
            "cost_cents",
            "downtime_hours",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class BOMLineSerializer(serializers.ModelSerializer):
    component_item_name = serializers.CharField(source="component_item.name", read_only=True)

    class Meta:
        model = BOMLine
        fields = ["id", "component_item", "component_item_name", "quantity_per_unit"]
        read_only_fields = ["id"]


class BOMByproductSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)

    class Meta:
        model = BOMByproduct
        fields = ["id", "item", "item_name", "quantity_per_unit"]
        read_only_fields = ["id"]


class BOMOperationSerializer(serializers.ModelSerializer):
    work_center_name = serializers.CharField(source="work_center.name", read_only=True)

    class Meta:
        model = BOMOperation
        fields = ["id", "work_center", "work_center_name", "name", "sequence", "duration_minutes"]
        read_only_fields = ["id"]


class BillOfMaterialSerializer(CompanyScopedSerializer):
    same_company_fields = ["output_item"]
    output_item_name = serializers.CharField(source="output_item.name", read_only=True)
    lines = BOMLineSerializer(many=True)
    byproducts = BOMByproductSerializer(many=True, required=False)
    operations = BOMOperationSerializer(many=True, required=False)

    class Meta:
        model = BillOfMaterial
        fields = [
            "id",
            "output_item",
            "output_item_name",
            "name",
            "is_active",
            "notes",
            "lines",
            "byproducts",
            "operations",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_lines(self, lines):
        if not lines:
            raise serializers.ValidationError("At least one component line is required.")
        return lines

    def _replace_children(self, bom, company, lines_data, byproducts_data, operations_data):
        for line in lines_data:
            if line["component_item"].company_id != company.id:
                raise serializers.ValidationError({"lines": "All components must belong to the active company."})
        for byproduct in byproducts_data:
            if byproduct["item"].company_id != company.id:
                raise serializers.ValidationError(
                    {"byproducts": "All byproducts must belong to the active company."}
                )
        for operation in operations_data:
            if operation["work_center"].company_id != company.id:
                raise serializers.ValidationError(
                    {"operations": "All operations must use a work center in the active company."}
                )

        bom.lines.all().delete()
        BOMLine.objects.bulk_create(
            [BOMLine(company=company, bom=bom, **line) for line in lines_data]
        )
        bom.byproducts.all().delete()
        BOMByproduct.objects.bulk_create(
            [BOMByproduct(company=company, bom=bom, **byproduct) for byproduct in byproducts_data]
        )
        bom.operations.all().delete()
        BOMOperation.objects.bulk_create(
            [BOMOperation(company=company, bom=bom, **operation) for operation in operations_data]
        )

    def create(self, validated_data):
        lines_data = validated_data.pop("lines")
        byproducts_data = validated_data.pop("byproducts", [])
        operations_data = validated_data.pop("operations", [])
        company = validated_data["company"]
        with transaction.atomic():
            bom = BillOfMaterial.objects.create(**validated_data)
            self._replace_children(bom, company, lines_data, byproducts_data, operations_data)
        return bom

    def update(self, instance, validated_data):
        lines_data = validated_data.pop("lines", None)
        byproducts_data = validated_data.pop("byproducts", None)
        operations_data = validated_data.pop("operations", None)
        with transaction.atomic():
            instance.output_item = validated_data.get("output_item", instance.output_item)
            instance.name = validated_data.get("name", instance.name)
            instance.is_active = validated_data.get("is_active", instance.is_active)
            instance.notes = validated_data.get("notes", instance.notes)
            instance.save()
            if lines_data is not None:
                self._replace_children(
                    instance,
                    instance.company,
                    lines_data,
                    byproducts_data if byproducts_data is not None else [],
                    operations_data if operations_data is not None else [],
                )
        return instance


class WorkOrderSerializer(CompanyScopedSerializer):
    same_company_fields = ["production_order", "work_center"]
    work_center_name = serializers.CharField(source="work_center.name", read_only=True)

    class Meta:
        model = WorkOrder
        fields = [
            "id",
            "production_order",
            "work_center",
            "work_center_name",
            "operation_name",
            "sequence",
            "status",
            "planned_hours",
            "actual_hours",
            "started_at",
            "completed_at",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "status", "started_at", "completed_at", "created_at"]


class MaterialConsumptionSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)

    class Meta:
        model = MaterialConsumption
        fields = ["id", "production_order", "item", "item_name", "quantity", "unit_cost_cents", "created_at"]
        read_only_fields = fields


class ScrapEntrySerializer(CompanyScopedSerializer):
    same_company_fields = ["production_order", "item"]
    item_name = serializers.CharField(source="item.name", read_only=True)

    class Meta:
        model = ScrapEntry
        fields = [
            "id",
            "production_order",
            "item",
            "item_name",
            "quantity",
            "unit_cost_cents",
            "reason",
            "created_at",
        ]
        read_only_fields = ["id", "unit_cost_cents", "created_at"]

    def create(self, validated_data):
        # Snapshot the item's current cost the same way MaterialConsumption
        # does — the client only ever picks item + quantity, never types a
        # cost in themselves.
        validated_data["unit_cost_cents"] = validated_data["item"].cost_cents
        return super().create(validated_data)


class QualityCheckSerializer(CompanyScopedSerializer):
    same_company_fields = ["production_order"]
    checked_by_name = serializers.CharField(source="checked_by.get_full_name", read_only=True)

    class Meta:
        model = QualityCheck
        fields = ["id", "production_order", "result", "checked_by", "checked_by_name", "notes", "created_at"]
        read_only_fields = ["id", "checked_by", "created_at"]

    def create(self, validated_data):
        request = self.context.get("request")
        validated_data["checked_by"] = getattr(request, "user", None)
        return super().create(validated_data)


class ProductionOrderSerializer(CompanyScopedSerializer):
    same_company_fields = ["bom", "warehouse"]
    bom_name = serializers.CharField(source="bom.name", read_only=True)
    output_item_name = serializers.CharField(source="bom.output_item.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    work_orders = WorkOrderSerializer(many=True, read_only=True)
    total_material_cost_cents = serializers.IntegerField(read_only=True)
    total_labor_cost_cents = serializers.IntegerField(read_only=True)
    total_scrap_cost_cents = serializers.IntegerField(read_only=True)
    total_cost_cents = serializers.IntegerField(read_only=True)

    class Meta:
        model = ProductionOrder
        fields = [
            "id",
            "number",
            "bom",
            "bom_name",
            "output_item_name",
            "warehouse",
            "warehouse_name",
            "quantity",
            "produced_quantity",
            "status",
            "planned_start_date",
            "planned_end_date",
            "started_at",
            "completed_at",
            "notes",
            "work_orders",
            "total_material_cost_cents",
            "total_labor_cost_cents",
            "total_scrap_cost_cents",
            "total_cost_cents",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "number",
            "produced_quantity",
            "status",
            "started_at",
            "completed_at",
            "created_at",
        ]

    def create(self, validated_data):
        company = validated_data["company"]
        with transaction.atomic():
            order = ProductionOrder.objects.create(**validated_data)
            order.number = next_number(company, "MO")
            order.save(update_fields=["number"])

            # Auto-generate the order's WorkOrder rows from the BOM's own
            # routing (BOMOperation), scaled to this order's quantity — the
            # same "define once on the BOM, copy onto every order" shape
            # Odoo's mrp.bom.operation_ids -> mrp.workorder copy uses.
            # A BOM with no operations defined just produces an order with
            # no work orders — material consumption/production still work,
            # there's just nothing to track labor time against.
            for operation in order.bom.operations.all():
                planned_hours = (operation.duration_minutes * order.quantity) / 60
                WorkOrder.objects.create(
                    company=company,
                    production_order=order,
                    work_center=operation.work_center,
                    operation_name=operation.name,
                    sequence=operation.sequence,
                    planned_hours=planned_hours,
                )
        return order
