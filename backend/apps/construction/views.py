from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.common.views import CompanyScopedViewSet

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
from .serializers import (
    BOQItemSerializer,
    ChangeOrderSerializer,
    ConstructionProjectSerializer,
    ContractSerializer,
    EquipmentAssignmentSerializer,
    EquipmentSerializer,
    LaborAssignmentSerializer,
    MaterialIssueSerializer,
    QualityInspectionSerializer,
    SafetyIncidentSerializer,
    SiteExpenseSerializer,
    SiteLogSerializer,
)


class ConstructionProjectViewSet(CompanyScopedViewSet):
    queryset = ConstructionProject.objects.select_related("client", "site_manager").all()
    serializer_class = ConstructionProjectSerializer
    permission_module = "construction"

    @action(detail=True, methods=["get"])
    def costing(self, request, pk=None):
        """"Project Costing" — a read-only rollup, not a stored model,
        the same restraint apps.manufacturing's MRP-lite shortage report
        applies: real numbers derived from the project's own real
        records (BOQ estimate, actual material issues, labor/equipment
        assignment cost-to-date, active subcontract values, site
        expenses) against the project's current budget, which itself
        already reflects every approved ChangeOrder."""
        project = self.get_object()
        estimated_cents = sum(item.estimated_cost_cents for item in project.boq_items.all())
        materials_cents = sum(mi.quantity * mi.unit_cost_cents for mi in project.material_issues.all())
        labor_cents = sum(a.cost_cents for a in project.labor_assignments.all())
        equipment_cents = sum(a.cost_cents for a in project.equipment_assignments.all())
        subcontract_cents = sum(
            c.contract_value_cents
            for c in project.contracts.filter(
                contract_type=Contract.Type.SUBCONTRACT, status__in=[Contract.Status.ACTIVE, Contract.Status.COMPLETED]
            )
        )
        site_expenses_cents = sum(e.amount_cents for e in project.expenses.all())
        actual_cents = materials_cents + labor_cents + equipment_cents + subcontract_cents + site_expenses_cents
        return Response(
            {
                "budget_cents": project.budget_cents,
                "estimated_cents": estimated_cents,
                "materials_cents": materials_cents,
                "labor_cents": labor_cents,
                "equipment_cents": equipment_cents,
                "subcontract_cents": subcontract_cents,
                "site_expenses_cents": site_expenses_cents,
                "actual_cents": actual_cents,
                "variance_cents": project.budget_cents - actual_cents,
            }
        )


class BOQItemViewSet(CompanyScopedViewSet):
    queryset = BOQItem.objects.select_related("project").all()
    serializer_class = BOQItemSerializer
    permission_module = "construction"

    def get_queryset(self):
        qs = super().get_queryset()
        project_id = self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs


class ContractViewSet(CompanyScopedViewSet):
    queryset = Contract.objects.select_related("project", "customer", "supplier").all()
    serializer_class = ContractSerializer
    permission_module = "construction"

    def get_queryset(self):
        qs = super().get_queryset()
        project_id = self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs


class SiteLogViewSet(CompanyScopedViewSet):
    queryset = SiteLog.objects.select_related("project", "logged_by").all()
    serializer_class = SiteLogSerializer
    permission_module = "construction"

    def get_queryset(self):
        qs = super().get_queryset()
        project_id = self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs


class MaterialIssueViewSet(CompanyScopedViewSet):
    queryset = MaterialIssue.objects.select_related("project", "item", "warehouse").all()
    serializer_class = MaterialIssueSerializer
    permission_module = "construction"
    http_method_names = ["get", "post", "head", "options"]  # a real stock movement, append-only like StockMovement itself

    def get_queryset(self):
        qs = super().get_queryset()
        project_id = self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs


class EquipmentViewSet(CompanyScopedViewSet):
    queryset = Equipment.objects.prefetch_related("assignments").all()
    serializer_class = EquipmentSerializer
    permission_module = "construction"


class EquipmentAssignmentViewSet(CompanyScopedViewSet):
    queryset = EquipmentAssignment.objects.select_related("equipment", "project").all()
    serializer_class = EquipmentAssignmentSerializer
    permission_module = "construction"

    def get_queryset(self):
        qs = super().get_queryset()
        project_id = self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        equipment_id = self.request.query_params.get("equipment")
        if equipment_id:
            qs = qs.filter(equipment_id=equipment_id)
        return qs

    def perform_create(self, serializer):
        super().perform_create(serializer)
        equipment = serializer.instance.equipment
        equipment.status = Equipment.Status.IN_USE
        equipment.save(update_fields=["status"])

    @action(detail=True, methods=["post"])
    def end(self, request, pk=None):
        assignment = self.get_object()
        if assignment.end_date is not None:
            raise ValidationError("This assignment has already ended.")
        assignment.end_date = timezone.localdate()
        assignment.save(update_fields=["end_date"])
        assignment.equipment.status = Equipment.Status.AVAILABLE
        assignment.equipment.save(update_fields=["status"])
        return Response(EquipmentAssignmentSerializer(assignment).data)


class LaborAssignmentViewSet(CompanyScopedViewSet):
    queryset = LaborAssignment.objects.select_related("employee", "project").all()
    serializer_class = LaborAssignmentSerializer
    permission_module = "construction"

    def get_queryset(self):
        qs = super().get_queryset()
        project_id = self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs

    @action(detail=True, methods=["post"])
    def end(self, request, pk=None):
        assignment = self.get_object()
        if assignment.end_date is not None:
            raise ValidationError("This assignment has already ended.")
        assignment.end_date = timezone.localdate()
        assignment.save(update_fields=["end_date"])
        return Response(LaborAssignmentSerializer(assignment).data)


class SiteExpenseViewSet(CompanyScopedViewSet):
    queryset = SiteExpense.objects.select_related("project").all()
    serializer_class = SiteExpenseSerializer
    permission_module = "construction"

    def get_queryset(self):
        qs = super().get_queryset()
        project_id = self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs


class ChangeOrderViewSet(CompanyScopedViewSet):
    queryset = ChangeOrder.objects.select_related("project").all()
    serializer_class = ChangeOrderSerializer
    permission_module = "construction"

    def get_queryset(self):
        qs = super().get_queryset()
        project_id = self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        change_order = self.get_object()
        if change_order.status != ChangeOrder.Status.PENDING:
            raise ValidationError("Only a pending change order can be approved.")
        change_order.status = ChangeOrder.Status.APPROVED
        change_order.save(update_fields=["status"])
        project = change_order.project
        project.budget_cents += change_order.amount_cents
        project.save(update_fields=["budget_cents"])
        return Response(ChangeOrderSerializer(change_order).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        change_order = self.get_object()
        if change_order.status != ChangeOrder.Status.PENDING:
            raise ValidationError("Only a pending change order can be rejected.")
        change_order.status = ChangeOrder.Status.REJECTED
        change_order.save(update_fields=["status"])
        return Response(ChangeOrderSerializer(change_order).data)


class QualityInspectionViewSet(CompanyScopedViewSet):
    queryset = QualityInspection.objects.select_related("project", "inspected_by").all()
    serializer_class = QualityInspectionSerializer
    permission_module = "construction"

    def get_queryset(self):
        qs = super().get_queryset()
        project_id = self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs


class SafetyIncidentViewSet(CompanyScopedViewSet):
    queryset = SafetyIncident.objects.select_related("project", "reported_by").all()
    serializer_class = SafetyIncidentSerializer
    permission_module = "construction"

    def get_queryset(self):
        qs = super().get_queryset()
        project_id = self.request.query_params.get("project")
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs
