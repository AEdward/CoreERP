from rest_framework import serializers

from apps.common.numbering import next_number
from apps.common.serializers import CompanyScopedSerializer

from .models import (
    AgentCommission,
    Building,
    LeaseContract,
    PaymentInstallment,
    PropertyExpense,
    PropertyListing,
    PropertyMaintenanceRequest,
    PropertyProject,
    PropertySale,
    RentPayment,
    SalesAgent,
    Unit,
    UnitType,
)


class PropertyProjectSerializer(CompanyScopedSerializer):
    class Meta:
        model = PropertyProject
        fields = [
            "id",
            "name",
            "description",
            "location",
            "status",
            "start_date",
            "expected_completion_date",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class BuildingSerializer(CompanyScopedSerializer):
    same_company_fields = ["project"]
    project_name = serializers.CharField(source="project.name", read_only=True, default="")

    class Meta:
        model = Building
        fields = ["id", "project", "project_name", "name", "address", "floors_count", "notes", "created_at"]
        read_only_fields = ["id", "created_at"]


class UnitTypeSerializer(CompanyScopedSerializer):
    class Meta:
        model = UnitType
        fields = [
            "id",
            "name",
            "bedrooms",
            "bathrooms",
            "area_sqm",
            "base_sale_price_cents",
            "base_rent_cents_monthly",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class UnitSerializer(CompanyScopedSerializer):
    same_company_fields = ["building", "unit_type"]
    building_name = serializers.CharField(source="building.name", read_only=True)
    unit_type_name = serializers.CharField(source="unit_type.name", read_only=True, default="")

    class Meta:
        model = Unit
        fields = [
            "id",
            "building",
            "building_name",
            "unit_type",
            "unit_type_name",
            "unit_number",
            "floor",
            "status",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class PropertyListingSerializer(CompanyScopedSerializer):
    same_company_fields = ["unit"]
    unit_label = serializers.CharField(source="unit.__str__", read_only=True)

    class Meta:
        model = PropertyListing
        fields = [
            "id",
            "unit",
            "unit_label",
            "listing_type",
            "price_cents",
            "listed_date",
            "status",
            "description",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class SalesAgentSerializer(CompanyScopedSerializer):
    same_company_fields = ["employee"]
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = SalesAgent
        fields = [
            "id",
            "employee",
            "employee_name",
            "name",
            "phone",
            "email",
            "commission_rate_percent",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_employee_name(self, obj):
        return str(obj.employee) if obj.employee_id else ""


class PaymentInstallmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentInstallment
        fields = ["id", "sale", "installment_number", "due_date", "amount_cents", "paid_amount_cents", "paid_date", "status"]
        read_only_fields = fields


class AgentCommissionSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source="agent.name", read_only=True)

    class Meta:
        model = AgentCommission
        fields = ["id", "sale", "agent", "agent_name", "rate_percent", "amount_cents", "status", "paid_date"]
        read_only_fields = fields


class PropertySaleSerializer(CompanyScopedSerializer):
    same_company_fields = ["unit", "buyer", "agent"]
    unit_label = serializers.CharField(source="unit.__str__", read_only=True)
    buyer_name = serializers.CharField(source="buyer.name", read_only=True)
    agent_name = serializers.CharField(source="agent.name", read_only=True, default="")
    installments = PaymentInstallmentSerializer(many=True, read_only=True)
    commissions = AgentCommissionSerializer(many=True, read_only=True)

    class Meta:
        model = PropertySale
        fields = [
            "id",
            "number",
            "unit",
            "unit_label",
            "buyer",
            "buyer_name",
            "agent",
            "agent_name",
            "sale_price_cents",
            "down_payment_cents",
            "sale_date",
            "status",
            "notes",
            "installments",
            "commissions",
            "created_at",
        ]
        read_only_fields = ["id", "number", "status", "created_at"]

    def create(self, validated_data):
        sale = PropertySale.objects.create(**validated_data)
        sale.number = next_number(sale.company, "PSALE")
        sale.save(update_fields=["number"])
        return sale


class RentPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = RentPayment
        fields = ["id", "lease", "period_start", "period_end", "due_date", "amount_cents", "paid_amount_cents", "paid_date", "status"]
        read_only_fields = fields


class LeaseContractSerializer(CompanyScopedSerializer):
    same_company_fields = ["unit", "tenant"]
    unit_label = serializers.CharField(source="unit.__str__", read_only=True)
    tenant_name = serializers.CharField(source="tenant.name", read_only=True)
    rent_payments = RentPaymentSerializer(many=True, read_only=True)

    class Meta:
        model = LeaseContract
        fields = [
            "id",
            "number",
            "unit",
            "unit_label",
            "tenant",
            "tenant_name",
            "start_date",
            "end_date",
            "monthly_rent_cents",
            "deposit_cents",
            "status",
            "notes",
            "rent_payments",
            "created_at",
        ]
        read_only_fields = ["id", "number", "status", "created_at"]

    def create(self, validated_data):
        lease = LeaseContract.objects.create(**validated_data)
        lease.number = next_number(lease.company, "LEASE")
        lease.save(update_fields=["number"])
        return lease


class PropertyMaintenanceRequestSerializer(CompanyScopedSerializer):
    same_company_fields = ["unit"]
    unit_label = serializers.CharField(source="unit.__str__", read_only=True)
    reported_by_name = serializers.CharField(source="reported_by.full_name", read_only=True, default="")

    class Meta:
        model = PropertyMaintenanceRequest
        fields = [
            "id",
            "unit",
            "unit_label",
            "title",
            "description",
            "priority",
            "status",
            "reported_by",
            "reported_by_name",
            "resolved_at",
            "created_at",
        ]
        read_only_fields = ["id", "status", "reported_by", "resolved_at", "created_at"]

    def create(self, validated_data):
        request = self.context.get("request")
        validated_data["reported_by"] = getattr(request, "user", None)
        return super().create(validated_data)


class PropertyExpenseSerializer(CompanyScopedSerializer):
    same_company_fields = ["building", "unit"]
    building_name = serializers.CharField(source="building.name", read_only=True)
    unit_label = serializers.SerializerMethodField()

    class Meta:
        model = PropertyExpense
        fields = [
            "id",
            "building",
            "building_name",
            "unit",
            "unit_label",
            "category",
            "description",
            "amount_cents",
            "expense_date",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_unit_label(self, obj):
        return str(obj.unit) if obj.unit_id else ""
