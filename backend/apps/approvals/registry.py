"""Whitelist of models that can go through apps.approvals' request/
approve/reject flow, plus a tiny hook registry that lets each of those
models react to the two moments that matter to it — a request being
raised, and a decision being made — without apps.approvals ever having
to import a specific domain app like apps.procurement. The consuming app
registers its own hooks from its AppConfig.ready(), the same
"caller reaches in, the generic app stays generic" shape already used by
apps.activity's post_save signal connection and apps.notifications'
notify_permission().

Started with just apps.procurement.PurchaseOrder — its `status` field
already had an unused APPROVED value sitting there with nothing enforcing
the transition into it, the same shape Item.tax_rate was in before
apps.tax existed. Now also PurchaseRequest, Expense, and LeaveRequest.
Add a line to APPROVABLE_TARGETS and call register_approval_hooks() from
another app's ready() when the next real approval need shows up.
"""

from django.contrib.contenttypes.models import ContentType

APPROVABLE_TARGETS = {
    "procurement.purchaseorder": {
        "permission_module": "procurement",
        "label": "Purchase Order",
        "url": "/dashboard/procurement",
    },
    "procurement.purchaserequest": {
        "permission_module": "procurement",
        "label": "Purchase Request",
        "url": "/dashboard/procurement",
    },
    "expenses.expense": {
        "permission_module": "expenses",
        "label": "Expense",
        "url": "/dashboard/expenses",
    },
    "hr.leaverequest": {
        "permission_module": "hr",
        "label": "Leave Request",
        "url": "/dashboard/hr",
    },
}


def resolve_approvable(app_label, model):
    """Returns (ContentType, permission_module, label, url) or None if
    this app_label/model pair isn't on the whitelist."""
    key = f"{(app_label or '').lower()}.{(model or '').lower()}"
    entry = APPROVABLE_TARGETS.get(key)
    if entry is None:
        return None
    try:
        content_type = ContentType.objects.get_by_natural_key(app_label.lower(), model.lower())
    except ContentType.DoesNotExist:
        return None
    return content_type, entry["permission_module"], entry["label"], entry["url"]


def modules_with_approvals():
    """Every permission_module that has at least one approvable target —
    used to gate the company-wide approvals inbox (no single target's
    permission applies there)."""
    return {entry["permission_module"] for entry in APPROVABLE_TARGETS.values()}


_HOOKS = {}


def register_approval_hooks(app_label, model, *, check_requestable, on_requested, on_decided):
    """check_requestable(instance): raise ValueError if approval can't be
    requested right now (e.g. not in Draft). on_requested(instance):
    called once the ApprovalRequest row exists, to move the record into
    its "awaiting decision" state. on_decided(instance, approved: bool):
    called once a decision is recorded, to apply it back onto the
    record's own status."""
    _HOOKS[f"{app_label}.{model}"] = {
        "check_requestable": check_requestable,
        "on_requested": on_requested,
        "on_decided": on_decided,
    }


def get_hooks(app_label, model):
    return _HOOKS.get(f"{app_label}.{model}")
