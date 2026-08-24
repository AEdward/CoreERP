"""Per-model config for the global search endpoint (apps.search): which
text fields to match against `q`, and which frontend page a hit should
link to. Every key here is also a key in apps.common.targeting's
ALLOWED_TARGETS, and search reuses that for permission_module/label
rather than repeating them — it's the fourth consumer of that whitelist,
after Documents, Notes, and Activity.

Deliberately excludes models with no field of their own worth matching
(PurchaseOrder, Quotation, SalesOrder — all just "<Prefix>-<id>" over a
related Customer/Supplier, no own text field); those stay findable by
searching for that related Customer/Supplier instead.
"""

SEARCH_TARGETS = {
    "hr.employee": {
        "search_fields": ["first_name", "last_name", "email"],
        "title": lambda obj: f"{obj.first_name} {obj.last_name}".strip(),
        "url": "/dashboard/hr",
    },
    "hr.department": {
        "search_fields": ["name"],
        "title": lambda obj: obj.name,
        "url": "/dashboard/hr",
    },
    "crm.customer": {
        "search_fields": ["name", "email", "phone"],
        "title": lambda obj: obj.name,
        "url": "/dashboard/sales",
    },
    "crm.lead": {
        "search_fields": ["name", "company_name", "email", "phone"],
        "title": lambda obj: obj.name,
        "url": "/dashboard/crm",
    },
    "crm.opportunity": {
        "search_fields": ["name"],
        "title": lambda obj: f"{obj.name} ({obj.customer})",
        "url": "/dashboard/crm",
    },
    "suppliers.supplier": {
        "search_fields": ["name", "email", "phone"],
        "title": lambda obj: obj.name,
        "url": "/dashboard/procurement",
    },
    "procurement.purchaserequest": {
        "search_fields": ["justification"],
        "title": lambda obj: f"PR-{obj.pk}",
        "url": "/dashboard/procurement",
    },
    "catalog.item": {
        "search_fields": ["name", "category"],
        "title": lambda obj: obj.name,
        "url": "/dashboard/inventory",
    },
    "procurement.bill": {
        "search_fields": ["bill_number"],
        "title": lambda obj: obj.bill_number or f"Bill #{obj.pk}",
        "url": "/dashboard/procurement",
    },
    "procurement.purchasereturn": {
        "search_fields": ["debit_note_number", "reason"],
        "title": lambda obj: obj.debit_note_number or f"Debit Note #{obj.pk}",
        "url": "/dashboard/procurement",
    },
    "sales.invoice": {
        "search_fields": ["invoice_number"],
        "title": lambda obj: obj.invoice_number or f"Invoice #{obj.pk}",
        "url": "/dashboard/sales",
    },
    "sales.creditnote": {
        "search_fields": ["credit_note_number", "reason"],
        "title": lambda obj: obj.credit_note_number or f"Credit Note #{obj.pk}",
        "url": "/dashboard/sales",
    },
    "accounting.journalentry": {
        "search_fields": ["reference", "memo"],
        "title": lambda obj: obj.reference or f"Journal Entry #{obj.pk}",
        "url": "/dashboard/accounting",
    },
    "accounting.payment": {
        "search_fields": ["reference"],
        "title": lambda obj: obj.reference or f"Payment #{obj.pk}",
        "url": "/dashboard/accounting",
    },
    "branches.branch": {
        "search_fields": ["name", "code"],
        "title": lambda obj: obj.name,
        "url": "/dashboard/settings",
    },
    "expenses.expense": {
        "search_fields": ["category", "description", "employee__first_name", "employee__last_name"],
        "title": lambda obj: f"{obj.employee} — {obj.category}",
        "url": "/dashboard/expenses",
    },
}
