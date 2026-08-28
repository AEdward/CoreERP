from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.common.views import CompanyScopedReadOnlyViewSet, CompanyScopedViewSet

from .engine import mark_payroll_run_paid, process_payroll_run
from .models import EmployeeSalaryComponent, Loan, PayrollRun, Payslip, SalaryComponent
from .serializers import (
    EmployeeSalaryComponentSerializer,
    LoanSerializer,
    PayrollRunSerializer,
    PayslipSerializer,
    SalaryComponentSerializer,
)


class SalaryComponentViewSet(CompanyScopedViewSet):
    queryset = SalaryComponent.objects.all()
    serializer_class = SalaryComponentSerializer
    permission_module = "hr"


class EmployeeSalaryComponentViewSet(CompanyScopedViewSet):
    queryset = EmployeeSalaryComponent.objects.select_related("employee", "component").all()
    serializer_class = EmployeeSalaryComponentSerializer
    permission_module = "hr"

    def get_queryset(self):
        qs = super().get_queryset()
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        return qs


class PayrollRunViewSet(CompanyScopedViewSet):
    queryset = PayrollRun.objects.prefetch_related("payslips").all()
    serializer_class = PayrollRunSerializer
    permission_module = "hr"

    def perform_update(self, serializer):
        if serializer.instance.status != PayrollRun.Status.DRAFT:
            raise ValidationError("Only a draft payroll run can be edited.")
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        if instance.status != PayrollRun.Status.DRAFT:
            raise ValidationError("Only a draft payroll run can be deleted.")
        super().perform_destroy(instance)

    @action(detail=True, methods=["post"])
    def process(self, request, pk=None):
        run = self.get_object()
        process_payroll_run(request, run)
        run.refresh_from_db()
        return Response(PayrollRunSerializer(run).data)

    @action(detail=True, methods=["post"])
    def mark_paid(self, request, pk=None):
        run = self.get_object()
        mark_payroll_run_paid(request, run)
        run.refresh_from_db()
        return Response(PayrollRunSerializer(run).data)


class LoanViewSet(CompanyScopedViewSet):
    queryset = Loan.objects.select_related("employee").prefetch_related("repayment_lines").all()
    serializer_class = LoanSerializer
    permission_module = "hr"

    def get_queryset(self):
        qs = super().get_queryset()
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        return qs

    def perform_update(self, serializer):
        if serializer.instance.repaid_cents:
            raise ValidationError("Cannot edit a loan once repayments have started — cancel it instead.")
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        if instance.repaid_cents:
            raise ValidationError("Cannot delete a loan once repayments have started — cancel it instead.")
        super().perform_destroy(instance)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        loan = self.get_object()
        if loan.status != Loan.Status.ACTIVE:
            raise ValidationError("Only an active loan can be cancelled.")
        loan.status = Loan.Status.CANCELLED
        loan.save(update_fields=["status"])
        return Response(LoanSerializer(loan).data)


class PayslipViewSet(CompanyScopedReadOnlyViewSet):
    """Read-only — a Payslip is only ever created in bulk by
    PayrollRunViewSet.process, never directly."""

    queryset = Payslip.objects.select_related("employee", "payroll_run").prefetch_related("lines").all()
    serializer_class = PayslipSerializer
    permission_module = "hr"

    def get_queryset(self):
        qs = super().get_queryset()
        payroll_run_id = self.request.query_params.get("payroll_run")
        if payroll_run_id:
            qs = qs.filter(payroll_run_id=payroll_run_id)
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        return qs
