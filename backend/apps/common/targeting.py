"""Whitelist of models that "attach something generic to any record"
features (Documents, Notes, ...) can point at, mapping
"app_label.model" -> (permission_module, human label). A model has to be
listed here on purpose — this is what stops a client from attaching
something to an arbitrary table (User, CompanyMembership, ...) it was
never meant to be attached to, and it's what tells each feature which
module's `view`/`manage` permission governs a given attachment.

Started life as apps.documents.registry; moved here once apps.notes
needed the identical mechanism — one shared whitelist rather than two
that could quietly drift apart. Add a line here when a new module wants
either feature; nothing else needs to change.
"""

from django.contrib.contenttypes.models import ContentType

ALLOWED_TARGETS = {
    "hr.employee": ("hr", "Employee"),
    "hr.department": ("hr", "Department"),
    "crm.customer": ("sales", "Customer"),
    "suppliers.supplier": ("procurement", "Supplier"),
    "catalog.item": ("inventory", "Item"),
    "procurement.purchaseorder": ("procurement", "Purchase Order"),
    "procurement.bill": ("procurement", "Bill"),
    "sales.quotation": ("sales", "Quotation"),
    "sales.salesorder": ("sales", "Sales Order"),
    "sales.invoice": ("sales", "Invoice"),
    "accounting.journalentry": ("accounting", "Journal Entry"),
    "accounting.payment": ("accounting", "Payment"),
    "branches.branch": ("settings", "Branch"),
    "expenses.expense": ("expenses", "Expense"),
}


def resolve_target(app_label: str, model: str):
    """Returns (ContentType, permission_module, label) or None if this
    app_label/model pair isn't on the whitelist."""
    key = f"{(app_label or '').lower()}.{(model or '').lower()}"
    entry = ALLOWED_TARGETS.get(key)
    if entry is None:
        return None
    permission_module, label = entry
    try:
        content_type = ContentType.objects.get_by_natural_key(app_label.lower(), model.lower())
    except ContentType.DoesNotExist:
        return None
    return content_type, permission_module, label
