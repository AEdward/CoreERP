"""Default permission catalog and per-company role seeding.

See docs/ARCHITECTURE.md §8 for the original permission matrix this
encodes. Phase 2 added a `procurement` module (Suppliers + Purchase
Orders) that the original matrix didn't anticipate — it's granted to
Inventory Manager rather than creating a new default role, since
purchasing-to-replenish-stock is the same job function in most small
companies. Revisit if that pairing doesn't hold up in practice.
"""

from .models import Permission, Role

DEFAULT_PERMISSIONS = [
    ("dashboard", "view"),
    ("settings", "view"),
    ("settings", "manage"),
    ("accounting", "view"),
    ("accounting", "manage"),
    ("hr", "view"),
    ("hr", "manage"),
    ("sales", "view"),
    ("sales", "manage"),
    ("inventory", "view"),
    ("inventory", "manage"),
    ("procurement", "view"),
    ("procurement", "manage"),
    ("tasks", "view"),
    ("tasks", "manage"),
    ("calendar", "view"),
    ("calendar", "manage"),
    ("expenses", "view"),
    ("expenses", "manage"),
    ("hotel", "view"),
    ("hotel", "manage"),
    ("housekeeping", "view"),
    ("housekeeping", "manage"),
    ("maintenance", "view"),
    ("maintenance", "manage"),
    ("conference", "view"),
    ("conference", "manage"),
    ("gym", "view"),
    ("gym", "manage"),
    ("laundry", "view"),
    ("laundry", "manage"),
    ("spa", "view"),
    ("spa", "manage"),
    ("loyalty", "view"),
    ("loyalty", "manage"),
    ("pos", "view"),
    ("pos", "manage"),
    # Section I: Manufacturing.
    ("manufacturing", "view"),
    ("manufacturing", "manage"),
    # Section K: Real Estate.
    ("realestate", "view"),
    ("realestate", "manage"),
]

# Every role gets these automatically — shared productivity/platform
# infrastructure, not gated by job function the way business modules
# are. Was hand-duplicated onto every DEFAULT_ROLES entry until this
# was the third addition (settings.view, then tasks.*, now calendar.*);
# past two, that's a real pattern, not premature abstraction.
SHARED_PERMISSIONS = [
    "dashboard.view",
    "settings.view",
    "tasks.view",
    "tasks.manage",
    "calendar.view",
    "calendar.manage",
    # expenses.manage (not just .view) is deliberately here too: any
    # employee needs to be able to submit their own expense claim, and
    # the permission model has no per-row-ownership dimension to grant
    # "create your own" without granting "manage everyone's" — see
    # apps.expenses.models.Expense's docstring for the tradeoff this
    # accepts (segregation of duties at approval time is the real
    # control, not a role gate on who can approve).
    "expenses.view",
    "expenses.manage",
]

# Per-role permissions beyond SHARED_PERMISSIONS — the actual job-function
# split.
DEFAULT_ROLES = {
    "Owner": [
        "settings.manage",
        "accounting.view",
        "accounting.manage",
        "hr.view",
        "hr.manage",
        "sales.view",
        "sales.manage",
        "inventory.view",
        "inventory.manage",
        "procurement.view",
        "procurement.manage",
        "hotel.view",
        "hotel.manage",
        "housekeeping.view",
        "housekeeping.manage",
        "maintenance.view",
        "maintenance.manage",
        "conference.view",
        "conference.manage",
        "gym.view",
        "gym.manage",
        "laundry.view",
        "laundry.manage",
        "spa.view",
        "spa.manage",
        "loyalty.view",
        "loyalty.manage",
        "pos.view",
        "pos.manage",
        "manufacturing.view",
        "manufacturing.manage",
        "realestate.view",
        "realestate.manage",
    ],
    "Finance Manager": ["accounting.view", "accounting.manage"],
    "HR Manager": ["hr.view", "hr.manage"],
    "Sales Manager": ["sales.view", "sales.manage"],
    "Inventory Manager": ["inventory.view", "inventory.manage", "procurement.view", "procurement.manage"],
    # Section I: Manufacturing — plans BOMs/production, needs inventory
    # visibility to know what's on hand for a run without owning general
    # stock management itself (same shape as Procurement Officer's
    # narrower cut of Inventory Manager's own permission set).
    "Production Manager": [
        "manufacturing.view",
        "manufacturing.manage",
        "inventory.view",
        "procurement.view",
    ],
    # Section K: Real Estate — runs properties/sales/leasing day-to-day;
    # accounting.view so they can see payment collection against the
    # company's books without owning the general ledger itself.
    "Property Manager": [
        "realestate.view",
        "realestate.manage",
        "accounting.view",
    ],
    # Section J roles, ported from AEdward/MiranErp's own role seeding —
    # full visibility across every module (view-only, not the day-to-day
    # write access plain Owner has) for a hotel principal who wants
    # oversight without operational write access to modules they don't
    # personally run.
    "Hotel Owner": [
        "settings.manage",
        "accounting.view",
        "hr.view",
        "sales.view",
        "inventory.view",
        "procurement.view",
        "hotel.view",
        "housekeeping.view",
        "maintenance.view",
        "pos.view",
        "laundry.view",
        "spa.view",
        "gym.view",
        "conference.view",
        "loyalty.view",
    ],
    # Front-desk/POS payment collection — hotel.view to look up a
    # reservation's folio, pos.manage to actually ring up and close
    # orders. Not accounting.manage: they take payments through the
    # already-permission-gated POS/folio flows, not the general ledger.
    "Cashier": ["hotel.view", "pos.view", "pos.manage", "accounting.view"],
    # Narrower than Inventory Manager (which already carries
    # procurement.*) — a dedicated purchasing role that also needs to
    # see current stock levels to know what to reorder, without owning
    # inventory management itself.
    "Procurement Officer": ["procurement.view", "procurement.manage", "inventory.view"],
    "Marketing Manager": [
        "sales.view",
        "sales.manage",
        "loyalty.view",
        "loyalty.manage",
        "pos.view",
        "pos.manage",
    ],
    # Read-only oversight across every business module — plus
    # settings.manage, which is the only way to reach the audit log
    # today (apps.auditlog.views.AuditLogViewSet is gated on
    # settings.manage, not a dedicated audit permission — the same known
    # coupling MiranErp's own Auditor role accepted rather than reworking
    # the permission model for one role).
    "Auditor": [
        "settings.manage",
        "accounting.view",
        "hr.view",
        "sales.view",
        "inventory.view",
        "procurement.view",
        "hotel.view",
        "housekeeping.view",
        "maintenance.view",
        "pos.view",
        "laundry.view",
        "spa.view",
        "gym.view",
        "conference.view",
        "loyalty.view",
        "manufacturing.view",
        "realestate.view",
    ],
}


def seed_default_permissions():
    for module, action in DEFAULT_PERMISSIONS:
        Permission.objects.get_or_create(module=module, action=action)


def create_default_roles_for_company(company):
    """Idempotent: safe to call every time a company is created."""
    seed_default_permissions()
    permissions_by_key = {f"{p.module}.{p.action}": p for p in Permission.objects.all()}

    roles = {}
    for role_name, permission_keys in DEFAULT_ROLES.items():
        role, _ = Role.objects.get_or_create(
            company=company, name=role_name, defaults={"is_system_role": True}
        )
        all_keys = SHARED_PERMISSIONS + permission_keys
        role.permissions.set([permissions_by_key[key] for key in all_keys])
        roles[role_name] = role
    return roles
