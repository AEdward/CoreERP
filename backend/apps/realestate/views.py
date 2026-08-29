import calendar
from datetime import date

from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.common.numbering import next_number
from apps.common.views import CompanyScopedViewSet

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
from .serializers import (
    AgentCommissionSerializer,
    BuildingSerializer,
    LeaseContractSerializer,
    PaymentInstallmentSerializer,
    PropertyExpenseSerializer,
    PropertyListingSerializer,
    PropertyMaintenanceRequestSerializer,
    PropertyProjectSerializer,
    PropertySaleSerializer,
    RentPaymentSerializer,
    SalesAgentSerializer,
    UnitSerializer,
    UnitTypeSerializer,
)


def add_months(d: date, months: int) -> date:
    """Plain calendar-month arithmetic — no python-dateutil dependency
    for one helper. Clamps the day to the target month's actual length
    (e.g. Jan 31 + 1 month -> Feb 28/29, not an invalid Feb 31)."""
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


class PropertyProjectViewSet(CompanyScopedViewSet):
    queryset = PropertyProject.objects.all()
    serializer_class = PropertyProjectSerializer
    permission_module = "realestate"


class BuildingViewSet(CompanyScopedViewSet):
    queryset = Building.objects.select_related("project").all()
    serializer_class = BuildingSerializer
    permission_module = "realestate"


class UnitTypeViewSet(CompanyScopedViewSet):
    queryset = UnitType.objects.all()
    serializer_class = UnitTypeSerializer
    permission_module = "realestate"


class UnitViewSet(CompanyScopedViewSet):
    queryset = Unit.objects.select_related("building", "unit_type").all()
    serializer_class = UnitSerializer
    permission_module = "realestate"

    def get_queryset(self):
        qs = super().get_queryset()
        building_id = self.request.query_params.get("building")
        if building_id:
            qs = qs.filter(building_id=building_id)
        return qs


class PropertyListingViewSet(CompanyScopedViewSet):
    queryset = PropertyListing.objects.select_related("unit").all()
    serializer_class = PropertyListingSerializer
    permission_module = "realestate"


class SalesAgentViewSet(CompanyScopedViewSet):
    queryset = SalesAgent.objects.select_related("employee").all()
    serializer_class = SalesAgentSerializer
    permission_module = "realestate"


class PaymentInstallmentViewSet(CompanyScopedViewSet):
    http_method_names = ["get", "head", "options", "post"]
    queryset = PaymentInstallment.objects.select_related("sale").all()
    serializer_class = PaymentInstallmentSerializer
    permission_module = "realestate"

    def get_queryset(self):
        qs = super().get_queryset()
        sale_id = self.request.query_params.get("sale")
        if sale_id:
            qs = qs.filter(sale_id=sale_id)
        return qs

    @action(detail=True, methods=["post"])
    def record_payment(self, request, pk=None):
        installment = self.get_object()
        if installment.status == PaymentInstallment.Status.PAID:
            raise ValidationError("This installment is already paid.")
        installment.paid_amount_cents = installment.amount_cents
        installment.paid_date = request.data.get("paid_date") or timezone.localdate().isoformat()
        installment.status = PaymentInstallment.Status.PAID
        installment.save(update_fields=["paid_amount_cents", "paid_date", "status"])
        return Response(PaymentInstallmentSerializer(installment).data)


class AgentCommissionViewSet(CompanyScopedViewSet):
    http_method_names = ["get", "head", "options", "post"]
    queryset = AgentCommission.objects.select_related("agent", "sale").all()
    serializer_class = AgentCommissionSerializer
    permission_module = "realestate"

    def get_queryset(self):
        qs = super().get_queryset()
        sale_id = self.request.query_params.get("sale")
        if sale_id:
            qs = qs.filter(sale_id=sale_id)
        agent_id = self.request.query_params.get("agent")
        if agent_id:
            qs = qs.filter(agent_id=agent_id)
        return qs

    @action(detail=True, methods=["post"])
    def mark_paid(self, request, pk=None):
        commission = self.get_object()
        if commission.status == AgentCommission.Status.PAID:
            raise ValidationError("This commission is already paid.")
        commission.status = AgentCommission.Status.PAID
        commission.paid_date = timezone.localdate()
        commission.save(update_fields=["status", "paid_date"])
        return Response(AgentCommissionSerializer(commission).data)


class PropertySaleViewSet(CompanyScopedViewSet):
    queryset = PropertySale.objects.select_related("unit", "buyer", "agent").prefetch_related(
        "installments", "commissions"
    )
    serializer_class = PropertySaleSerializer
    permission_module = "realestate"

    def perform_create(self, serializer):
        super().perform_create(serializer)
        # Same simplification WorkOrderPart-style features make elsewhere:
        # creating a sale flips the unit to reserved so it drops off the
        # available-units list immediately, without a separate "reserve"
        # step. A cancelled sale (see cancel() below) puts it back.
        sale = serializer.instance
        if sale.unit.status == Unit.Status.AVAILABLE:
            sale.unit.status = Unit.Status.RESERVED
            sale.unit.save(update_fields=["status"])

    @action(detail=True, methods=["post"])
    def generate_installments(self, request, pk=None):
        sale = self.get_object()
        if sale.installments.exists():
            raise ValidationError("Installments have already been generated for this sale.")
        count = request.data.get("count")
        start_date = request.data.get("start_date")
        if not count or int(count) <= 0:
            raise ValidationError({"count": "Must be a positive whole number."})
        if not start_date:
            raise ValidationError({"start_date": "Required."})
        count = int(count)
        start = date.fromisoformat(start_date)

        remaining = sale.sale_price_cents - sale.down_payment_cents
        if remaining <= 0:
            raise ValidationError("Nothing left to schedule — down payment already covers the sale price.")
        base_amount = remaining // count
        installments = []
        for i in range(count):
            amount = base_amount if i < count - 1 else remaining - base_amount * (count - 1)
            installments.append(
                PaymentInstallment(
                    company=sale.company,
                    sale=sale,
                    installment_number=i + 1,
                    due_date=add_months(start, i),
                    amount_cents=amount,
                )
            )
        PaymentInstallment.objects.bulk_create(installments)
        # sale came from self.get_object(), whose queryset prefetches
        # installments/commissions — that cache was populated (empty) at
        # fetch time and bulk_create() above never touched it, so
        # re-serializing `sale` as-is would show a stale empty list.
        # refresh_from_db() clears _prefetched_objects_cache, forcing the
        # serializer's nested installments field to query fresh.
        sale.refresh_from_db()
        return Response(PropertySaleSerializer(sale).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        sale = self.get_object()
        if sale.status != PropertySale.Status.PENDING:
            raise ValidationError("Only a pending sale can be completed.")
        sale.status = PropertySale.Status.COMPLETED
        sale.save(update_fields=["status"])
        sale.unit.status = Unit.Status.SOLD
        sale.unit.save(update_fields=["status"])

        if sale.agent and sale.agent.is_active:
            rate = sale.agent.commission_rate_percent
            AgentCommission.objects.create(
                company=sale.company,
                sale=sale,
                agent=sale.agent,
                rate_percent=rate,
                amount_cents=int(sale.sale_price_cents * rate / 100),
            )
        # Same stale-prefetch-cache reasoning as generate_installments —
        # the commission above was created through a different manager
        # than sale.commissions, so the cached (pre-commission) prefetch
        # would otherwise still show none.
        sale.refresh_from_db()
        return Response(PropertySaleSerializer(sale).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        sale = self.get_object()
        if sale.status != PropertySale.Status.PENDING:
            raise ValidationError("Only a pending sale can be cancelled.")
        sale.status = PropertySale.Status.CANCELLED
        sale.save(update_fields=["status"])
        if sale.unit.status == Unit.Status.RESERVED:
            sale.unit.status = Unit.Status.AVAILABLE
            sale.unit.save(update_fields=["status"])
        return Response(PropertySaleSerializer(sale).data)


class RentPaymentViewSet(CompanyScopedViewSet):
    http_method_names = ["get", "head", "options", "post"]
    queryset = RentPayment.objects.select_related("lease").all()
    serializer_class = RentPaymentSerializer
    permission_module = "realestate"

    def get_queryset(self):
        qs = super().get_queryset()
        lease_id = self.request.query_params.get("lease")
        if lease_id:
            qs = qs.filter(lease_id=lease_id)
        return qs

    @action(detail=True, methods=["post"])
    def record_payment(self, request, pk=None):
        payment = self.get_object()
        if payment.status == RentPayment.Status.PAID:
            raise ValidationError("This period is already paid.")
        payment.paid_amount_cents = payment.amount_cents
        payment.paid_date = request.data.get("paid_date") or timezone.localdate().isoformat()
        payment.status = RentPayment.Status.PAID
        payment.save(update_fields=["paid_amount_cents", "paid_date", "status"])
        return Response(RentPaymentSerializer(payment).data)


class LeaseContractViewSet(CompanyScopedViewSet):
    queryset = LeaseContract.objects.select_related("unit", "tenant").prefetch_related("rent_payments")
    serializer_class = LeaseContractSerializer
    permission_module = "realestate"

    def perform_create(self, serializer):
        super().perform_create(serializer)
        lease = serializer.instance
        lease.unit.status = Unit.Status.RENTED
        lease.unit.save(update_fields=["status"])

    @action(detail=True, methods=["post"])
    def generate_rent_schedule(self, request, pk=None):
        lease = self.get_object()
        if lease.rent_payments.exists():
            raise ValidationError("A rent schedule has already been generated for this lease.")
        payments = []
        period_start = lease.start_date
        i = 0
        while period_start < lease.end_date:
            period_end = min(add_months(period_start, 1), lease.end_date)
            payments.append(
                RentPayment(
                    company=lease.company,
                    lease=lease,
                    period_start=period_start,
                    period_end=period_end,
                    due_date=period_start,
                    amount_cents=lease.monthly_rent_cents,
                )
            )
            period_start = period_end
            i += 1
            if i > 600:  # 50 years of monthly periods — a sane runaway guard, not a real limit.
                break
        RentPayment.objects.bulk_create(payments)
        # Same stale-prefetch-cache reasoning as
        # PropertySaleViewSet.generate_installments.
        lease.refresh_from_db()
        return Response(LeaseContractSerializer(lease).data)

    @action(detail=True, methods=["post"])
    def terminate(self, request, pk=None):
        lease = self.get_object()
        if lease.status != LeaseContract.Status.ACTIVE:
            raise ValidationError("Only an active lease can be terminated.")
        lease.status = LeaseContract.Status.TERMINATED
        lease.save(update_fields=["status"])
        if lease.unit.status == Unit.Status.RENTED:
            lease.unit.status = Unit.Status.AVAILABLE
            lease.unit.save(update_fields=["status"])
        return Response(LeaseContractSerializer(lease).data)


class PropertyMaintenanceRequestViewSet(CompanyScopedViewSet):
    queryset = PropertyMaintenanceRequest.objects.select_related("unit", "reported_by").all()
    serializer_class = PropertyMaintenanceRequestSerializer
    permission_module = "realestate"

    def get_queryset(self):
        qs = super().get_queryset()
        unit_id = self.request.query_params.get("unit")
        if unit_id:
            qs = qs.filter(unit_id=unit_id)
        return qs

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        req = self.get_object()
        if req.status == PropertyMaintenanceRequest.Status.COMPLETED:
            raise ValidationError("This request is already resolved.")
        req.status = PropertyMaintenanceRequest.Status.COMPLETED
        req.resolved_at = timezone.now()
        req.save(update_fields=["status", "resolved_at"])
        return Response(PropertyMaintenanceRequestSerializer(req).data)


class PropertyExpenseViewSet(CompanyScopedViewSet):
    queryset = PropertyExpense.objects.select_related("building", "unit").all()
    serializer_class = PropertyExpenseSerializer
    permission_module = "realestate"

    def get_queryset(self):
        qs = super().get_queryset()
        building_id = self.request.query_params.get("building")
        if building_id:
            qs = qs.filter(building_id=building_id)
        return qs
