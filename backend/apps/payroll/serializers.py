from rest_framework import serializers

from apps.common.numbering import next_number
from apps.common.serializers import CompanyScopedSerializer

from .models import (
    EmployeeSalaryComponent,
    Loan,
    PayrollRun,
    Payslip,
    PayslipLine,
    PensionSettings,
    SalaryComponent,
    TaxBracket,
)


class SalaryComponentSerializer(CompanyScopedSerializer):
    class Meta:
        model = SalaryComponent
        fields = ["id", "name", "category", "is_taxable", "created_at"]
        read_only_fields = ["id", "created_at"]


class TaxBracketSerializer(CompanyScopedSerializer):
    class Meta:
        model = TaxBracket
        fields = ["id", "lower_bound_cents", "upper_bound_cents", "rate_percent", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class PensionSettingsSerializer(CompanyScopedSerializer):
    class Meta:
        model = PensionSettings
        fields = ["id", "employee_rate_percent", "employer_rate_percent", "created_at"]
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
        fields = ["id", "label", "line_type", "amount_cents", "source_loan"]
        read_only_fields = ["id"]


class LoanSerializer(CompanyScopedSerializer):
    same_company_fields = ["employee"]
    employee_name = serializers.SerializerMethodField()
    monthly_installment_cents = serializers.IntegerField(read_only=True)
    repaid_cents = serializers.IntegerField(read_only=True)
    remaining_balance_cents = serializers.IntegerField(read_only=True)

    class Meta:
        model = Loan
        fields = [
            "id",
            "loan_number",
            "employee",
            "employee_name",
            "principal_cents",
            "term_months",
            "start_date",
            "status",
            "notes",
            "monthly_installment_cents",
            "repaid_cents",
            "remaining_balance_cents",
            "created_at",
        ]
        read_only_fields = ["id", "loan_number", "status", "created_at"]

    def get_employee_name(self, obj):
        return str(obj.employee)

    def create(self, validated_data):
        loan = Loan.objects.create(**validated_data)
        loan.loan_number = next_number(loan.company, "LOAN")
        loan.save(update_fields=["loan_number"])
        return loan


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
            "loan_repayment_cents",
            "net_pay_cents",
            "lines",
            "created_at",
        ]
        read_only_fields = fields
