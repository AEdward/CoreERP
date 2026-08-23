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
]

DEFAULT_ROLES = {
    "Owner": [
        "dashboard.view",
        "settings.view",
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
        "tasks.view",
        "tasks.manage",
    ],
    "Finance Manager": [
        "dashboard.view",
        "settings.view",
        "accounting.view",
        "accounting.manage",
        "tasks.view",
        "tasks.manage",
    ],
    "HR Manager": [
        "dashboard.view",
        "settings.view",
        "hr.view",
        "hr.manage",
        "tasks.view",
        "tasks.manage",
    ],
    "Sales Manager": [
        "dashboard.view",
        "settings.view",
        "sales.view",
        "sales.manage",
        "tasks.view",
        "tasks.manage",
    ],
    "Inventory Manager": [
        "dashboard.view",
        "settings.view",
        "inventory.view",
        "inventory.manage",
        "procurement.view",
        "procurement.manage",
        "tasks.view",
        "tasks.manage",
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
        role.permissions.set([permissions_by_key[key] for key in permission_keys])
        roles[role_name] = role
    return roles
