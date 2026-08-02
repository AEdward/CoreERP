"""Default permission catalog and per-company role seeding.

See docs/ARCHITECTURE.md §8 for the permission matrix this encodes.
"""

from .models import Permission, Role

DEFAULT_PERMISSIONS = [
    ("dashboard", "view"),
    ("settings", "manage"),
    ("accounting", "view"),
    ("accounting", "manage"),
    ("hr", "view"),
    ("hr", "manage"),
    ("sales", "view"),
    ("sales", "manage"),
    ("inventory", "view"),
    ("inventory", "manage"),
]

DEFAULT_ROLES = {
    "Owner": [
        "dashboard.view",
        "settings.manage",
        "accounting.view",
        "accounting.manage",
        "hr.view",
        "hr.manage",
        "sales.view",
        "sales.manage",
        "inventory.view",
        "inventory.manage",
    ],
    "Finance Manager": ["dashboard.view", "accounting.view", "accounting.manage"],
    "HR Manager": ["dashboard.view", "hr.view", "hr.manage"],
    "Sales Manager": ["dashboard.view", "sales.view", "sales.manage"],
    "Inventory Manager": ["dashboard.view", "inventory.view", "inventory.manage"],
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
