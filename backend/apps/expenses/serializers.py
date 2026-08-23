from rest_framework import serializers

from apps.common.serializers import CompanyScopedSerializer

from .models import Expense


class ExpenseSerializer(CompanyScopedSerializer):
    same_company_fields = ["employee"]

    class Meta:
        model = Expense
        fields = [
            "id",
            "employee",
            "category",
            "description",
            "amount_cents",
            "expense_date",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate_status(self, value):
        # Submitted/approved/rejected are set only by apps.approvals (see
        # apps/expenses/apps.py's hook registration) — same restriction
        # as PurchaseOrder's. Paid is left freely settable, matching
        # Invoice/Bill's existing precedent (that transition is normally
        # driven by apps.accounting's Payment signal, but neither of
        # those blocks a direct client set either).
        if self.instance and value == self.instance.status:
            return value
        blocked = {Expense.Status.SUBMITTED, Expense.Status.APPROVED, Expense.Status.REJECTED}
        if value in blocked:
            raise serializers.ValidationError(
                "Submitted/approved/rejected are set by the approval flow, not edited directly."
            )
        return value
