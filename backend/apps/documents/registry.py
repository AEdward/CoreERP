"""Whitelist of models that documents can attach to, mapping
"app_label.model" -> (permission_module, human label). A model has to be
listed here on purpose — this is what stops a client from attaching a
file to an arbitrary table (User, CompanyMembership, ...) it was never
meant to be attached to, and it's what tells the API which module's
`view`/`manage` permission governs a given attachment.

Add a line here when a new module wants attachments; nothing else in
apps.documents needs to change.
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
