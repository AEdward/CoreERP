from django.apps import AppConfig


class ProcurementConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.procurement"
    label = "procurement"

    def ready(self):
        from apps.approvals.registry import register_approval_hooks

        from .models import PurchaseOrder, PurchaseRequest

        def check_requestable(instance):
            if instance.status != PurchaseOrder.Status.DRAFT:
                raise ValueError("Approval can only be requested while a purchase order is in Draft.")

        def on_requested(instance):
            instance.status = PurchaseOrder.Status.SUBMITTED
            instance.save(update_fields=["status"])

        def on_decided(instance, approved):
            instance.status = PurchaseOrder.Status.APPROVED if approved else PurchaseOrder.Status.REJECTED
            instance.save(update_fields=["status"])

        register_approval_hooks(
            "procurement",
            "purchaseorder",
            check_requestable=check_requestable,
            on_requested=on_requested,
            on_decided=on_decided,
        )

        def pr_check_requestable(instance):
            if instance.status != PurchaseRequest.Status.DRAFT:
                raise ValueError("Approval can only be requested while a purchase request is in Draft.")

        def pr_on_requested(instance):
            instance.status = PurchaseRequest.Status.SUBMITTED
            instance.save(update_fields=["status"])

        def pr_on_decided(instance, approved):
            instance.status = (
                PurchaseRequest.Status.APPROVED if approved else PurchaseRequest.Status.REJECTED
            )
            instance.save(update_fields=["status"])

        register_approval_hooks(
            "procurement",
            "purchaserequest",
            check_requestable=pr_check_requestable,
            on_requested=pr_on_requested,
            on_decided=pr_on_decided,
        )
