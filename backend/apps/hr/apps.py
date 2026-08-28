from django.apps import AppConfig


class HrConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.hr"
    label = "hr"

    def ready(self):
        from django.utils import timezone

        from apps.approvals.registry import register_approval_hooks

        from .models import Employee, LeaveRequest

        def check_requestable(instance):
            if instance.status != LeaveRequest.Status.DRAFT:
                raise ValueError("Approval can only be requested while a leave request is in Draft.")

        def on_requested(instance):
            instance.status = LeaveRequest.Status.SUBMITTED
            instance.save(update_fields=["status"])

        def on_decided(instance, approved):
            instance.status = LeaveRequest.Status.APPROVED if approved else LeaveRequest.Status.REJECTED
            instance.save(update_fields=["status"])
            # Approving a request that covers today is what actually sets
            # Employee.status to ON_LEAVE — a direct consequence of this
            # one decision, no scheduled job needed. Never touched on
            # rejection, and reverted by LeaveRequest.cancel (see
            # apps.hr.views) rather than by any background process once
            # the period simply ends — a known, deliberate gap.
            today = timezone.localdate()
            if approved and instance.start_date <= today <= instance.end_date:
                instance.employee.status = Employee.Status.ON_LEAVE
                instance.employee.save(update_fields=["status"])

        register_approval_hooks(
            "hr",
            "leaverequest",
            check_requestable=check_requestable,
            on_requested=on_requested,
            on_decided=on_decided,
        )
