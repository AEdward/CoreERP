from rest_framework import serializers

from apps.auditlog.models import AuditLog
from apps.auditlog.services import log_audit
from apps.common.numbering import next_number
from apps.common.serializers import CompanyScopedSerializer
from apps.inventory.models import StockMovement
from apps.inventory.serializers import StockMovementSerializer

from .models import (
    BOQItem,
    ChangeOrder,
    ConstructionProject,
    Contract,
    Equipment,
    EquipmentAssignment,
    LaborAssignment,
    MaterialIssue,
    QualityInspection,
    SafetyIncident,
    SiteExpense,
    SiteLog,
)


class ConstructionProjectSerializer(CompanyScopedSerializer):
    same_company_fields = ["client", "site_manager"]
    client_name = serializers.SerializerMethodField()
    site_manager_name = serializers.SerializerMethodField()

    class Meta:
        model = ConstructionProject
        fields = [
            "id",
            "number",
            "name",
            "client",
            "client_name",
            "site_address",
            "site_manager",
            "site_manager_name",
            "start_date",
            "end_date",
            "budget_cents",
            "status",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "number", "budget_cents", "created_at"]

    def get_client_name(self, obj):
        return str(obj.client) if obj.client_id else ""

    def get_site_manager_name(self, obj):
        return str(obj.site_manager) if obj.site_manager_id else ""

    def create(self, validated_data):
        company = validated_data["company"]
        project = ConstructionProject.objects.create(**validated_data)
        project.number = next_number(company, "PROJ")
        project.save(update_fields=["number"])
        return project


class BOQItemSerializer(CompanyScopedSerializer):
    same_company_fields = ["project"]
    estimated_cost_cents = serializers.ReadOnlyField()

    class Meta:
        model = BOQItem
        fields = [
            "id",
            "project",
            "category",
            "description",
            "unit",
            "quantity",
            "unit_cost_cents",
            "estimated_cost_cents",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ContractSerializer(CompanyScopedSerializer):
    same_company_fields = ["project", "customer", "supplier"]
    customer_name = serializers.SerializerMethodField()
    supplier_name = serializers.SerializerMethodField()

    class Meta:
        model = Contract
        fields = [
            "id",
            "number",
            "project",
            "contract_type",
            "customer",
            "customer_name",
            "supplier",
            "supplier_name",
            "scope_of_work",
            "contract_value_cents",
            "retention_percent",
            "start_date",
            "end_date",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "number", "created_at"]

    def get_customer_name(self, obj):
        return str(obj.customer) if obj.customer_id else ""

    def get_supplier_name(self, obj):
        return str(obj.supplier) if obj.supplier_id else ""

    def validate(self, attrs):
        attrs = super().validate(attrs)
        contract_type = attrs.get("contract_type", getattr(self.instance, "contract_type", Contract.Type.MAIN))
        customer = attrs.get("customer", getattr(self.instance, "customer", None))
        supplier = attrs.get("supplier", getattr(self.instance, "supplier", None))
        if contract_type == Contract.Type.MAIN and not customer:
            raise serializers.ValidationError({"customer": "Required for a main contract."})
        if contract_type == Contract.Type.SUBCONTRACT and not supplier:
            raise serializers.ValidationError({"supplier": "Required for a subcontract."})
        return attrs

    def create(self, validated_data):
        company = validated_data["company"]
        contract = Contract.objects.create(**validated_data)
        contract.number = next_number(company, "CONTRACT")
        contract.save(update_fields=["number"])
        return contract


class SiteLogSerializer(CompanyScopedSerializer):
    same_company_fields = ["project", "logged_by"]
    logged_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SiteLog
        fields = [
            "id",
            "project",
            "log_date",
            "percent_complete",
            "work_summary",
            "weather",
            "logged_by",
            "logged_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_logged_by_name(self, obj):
        return str(obj.logged_by) if obj.logged_by_id else ""


class MaterialIssueSerializer(CompanyScopedSerializer):
    same_company_fields = ["project", "item", "warehouse"]
    item_name = serializers.CharField(source="item.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = MaterialIssue
        fields = [
            "id",
            "project",
            "item",
            "item_name",
            "warehouse",
            "warehouse_name",
            "quantity",
            "unit_cost_cents",
            "created_at",
        ]
        read_only_fields = ["id", "unit_cost_cents", "created_at"]

    def create(self, validated_data):
        request = self.context.get("request")
        company = validated_data["company"]
        item = validated_data["item"]
        movement_serializer = StockMovementSerializer(
            data={
                "item": item.id,
                "warehouse": validated_data["warehouse"].id,
                "type": StockMovement.MovementType.OUT,
                "quantity": validated_data["quantity"],
                "reference": f"Issued to {validated_data['project']}",
            },
            context=self.context,
        )
        movement_serializer.is_valid(raise_exception=True)
        movement = movement_serializer.save(company=company)
        log_audit(request, movement, AuditLog.Action.CREATED)
        return MaterialIssue.objects.create(
            **validated_data, unit_cost_cents=item.cost_cents, movement=movement
        )


class EquipmentSerializer(CompanyScopedSerializer):
    class Meta:
        model = Equipment
        fields = ["id", "name", "equipment_type", "status", "notes", "created_at"]
        read_only_fields = ["id", "status", "created_at"]


class EquipmentAssignmentSerializer(CompanyScopedSerializer):
    same_company_fields = ["equipment", "project"]
    equipment_name = serializers.CharField(source="equipment.name", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)

    class Meta:
        model = EquipmentAssignment
        fields = [
            "id",
            "equipment",
            "equipment_name",
            "project",
            "project_name",
            "start_date",
            "end_date",
            "daily_rate_cents",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_equipment(self, equipment):
        if self.instance is None and equipment.current_assignment is not None:
            raise serializers.ValidationError("This equipment is already assigned to a project.")
        return equipment


class LaborAssignmentSerializer(CompanyScopedSerializer):
    same_company_fields = ["employee", "project"]
    employee_name = serializers.CharField(source="employee.__str__", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)

    class Meta:
        model = LaborAssignment
        fields = [
            "id",
            "employee",
            "employee_name",
            "project",
            "project_name",
            "role",
            "start_date",
            "end_date",
            "daily_rate_cents",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class SiteExpenseSerializer(CompanyScopedSerializer):
    same_company_fields = ["project"]

    class Meta:
        model = SiteExpense
        fields = ["id", "project", "category", "description", "amount_cents", "expense_date", "created_at"]
        read_only_fields = ["id", "created_at"]


class ChangeOrderSerializer(CompanyScopedSerializer):
    same_company_fields = ["project"]
    project_name = serializers.CharField(source="project.name", read_only=True)

    class Meta:
        model = ChangeOrder
        fields = [
            "id",
            "number",
            "project",
            "project_name",
            "description",
            "amount_cents",
            "requested_date",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "number", "status", "created_at"]

    def create(self, validated_data):
        company = validated_data["company"]
        change_order = ChangeOrder.objects.create(**validated_data)
        change_order.number = next_number(company, "CO")
        change_order.save(update_fields=["number"])
        return change_order


class QualityInspectionSerializer(CompanyScopedSerializer):
    same_company_fields = ["project", "inspected_by"]
    inspected_by_name = serializers.SerializerMethodField()

    class Meta:
        model = QualityInspection
        fields = [
            "id",
            "project",
            "inspected_by",
            "inspected_by_name",
            "inspection_date",
            "result",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_inspected_by_name(self, obj):
        return str(obj.inspected_by) if obj.inspected_by_id else ""


class SafetyIncidentSerializer(CompanyScopedSerializer):
    same_company_fields = ["project", "reported_by"]
    reported_by_name = serializers.SerializerMethodField()

    class Meta:
        model = SafetyIncident
        fields = [
            "id",
            "project",
            "incident_date",
            "description",
            "severity",
            "reported_by",
            "reported_by_name",
            "corrective_action",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_reported_by_name(self, obj):
        return str(obj.reported_by) if obj.reported_by_id else ""
