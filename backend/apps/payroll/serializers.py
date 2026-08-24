from rest_framework import serializers

from apps.common.serializers import CompanyScopedSerializer

from .models import EmployeeSalaryComponent, PayrollRun, Payslip, PayslipLine, SalaryComponent


class SalaryComponentSerializer(CompanyScopedSerializer):
    class Meta:
        model = SalaryComponent
        fields = ["id", "name", "category", "is_taxable", "created_at"]
        read_only_fields = ["id", "created_at"]


class EmployeeSalaryComponentSerializer(CompanyScopedSerializer):
    same_company_fields = ["employee", "component"]
    component_name = serializers.CharField(source="component.name", read_only=True)
    component_category = serializers.CharField(source="component.category", read_only=True)

    class Meta:
        model = EmployeeSalaryComponent
        fields = [
            "id",
            "employee",
            "component",
            "component_name",
            "component_category",
            "amount_cents",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class PayrollRunSerializer(CompanyScopedSerializer):
    total_net_pay_cents = serializers.IntegerField(read_only=True)

    class Meta:
        model = PayrollRun
        fields = [
            "id",
            "label",
            "start_date",
            "end_date",
            "status",
            "processed_at",
            "paid_at",
            "total_net_pay_cents",
            "created_at",
        ]
        read_only_fields = ["id", "status", "processed_at", "paid_at", "created_at"]


class PayslipLineSerializer(CompanyScopedSerializer):
    class Meta:
        model = PayslipLine
        fields = ["id", "label", "line_type", "amount_cents"]
        read_only_fields = ["id"]


class PayslipSerializer(CompanyScopedSerializer):
    lines = PayslipLineSerializer(many=True, read_only=True)

    class Meta:
        model = Payslip
        fields = [
            "id",
            "payroll_run",
            "employee",
            "gross_cents",
            "taxable_income_cents",
            "paye_tax_cents",
            "pension_employee_cents",
            "pension_employer_cents",
            "other_deductions_cents",
            "net_pay_cents",
            "lines",
            "created_at",
        ]
        read_only_fields = fields
