from django.apps import AppConfig


class ExpensesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.expenses"
    label = "expenses"

    def ready(self):
        from apps.approvals.registry import register_approval_hooks

        from .models import Expense

        def check_requestable(instance):
            if instance.status != Expense.Status.DRAFT:
                raise ValueError("Approval can only be requested while an expense is in Draft.")

        def on_requested(instance):
            instance.status = Expense.Status.SUBMITTED
            instance.save(update_fields=["status"])

        def on_decided(instance, approved):
            instance.status = Expense.Status.APPROVED if approved else Expense.Status.REJECTED
            instance.save(update_fields=["status"])

        register_approval_hooks(
            "expenses",
            "expense",
            check_requestable=check_requestable,
            on_requested=on_requested,
            on_decided=on_decided,
        )
