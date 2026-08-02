"""Row-Level Security backstop for roles and role assignments.

Uses apps.companies' current_user_company_ids() (created in its 0003
migration) — see that migration's docstring and docs/ARCHITECTURE.md §3
for the reasoning.
"""

from django.db import migrations

IS_PLATFORM_ADMIN = "current_setting('app.is_platform_admin', true) = 'true'"

ENABLE_ROLES = f"""
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;

CREATE POLICY roles_tenant_isolation ON roles
    USING (
        {IS_PLATFORM_ADMIN}
        OR company_id IS NULL
        OR company_id IN (SELECT current_user_company_ids())
    )
    WITH CHECK (
        {IS_PLATFORM_ADMIN}
        OR company_id IS NULL
        OR company_id IN (SELECT current_user_company_ids())
    );
"""

DISABLE_ROLES = """
DROP POLICY IF EXISTS roles_tenant_isolation ON roles;
ALTER TABLE roles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
"""

ENABLE_MEMBERSHIP_ROLES = f"""
ALTER TABLE membership_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_roles FORCE ROW LEVEL SECURITY;

CREATE POLICY membership_roles_tenant_isolation ON membership_roles
    USING (
        {IS_PLATFORM_ADMIN}
        OR EXISTS (
            SELECT 1 FROM company_memberships target
            WHERE target.id = membership_roles.membership_id
              AND target.company_id IN (SELECT current_user_company_ids())
        )
    )
    WITH CHECK (
        {IS_PLATFORM_ADMIN}
        OR EXISTS (
            SELECT 1 FROM company_memberships target
            WHERE target.id = membership_roles.membership_id
              AND target.company_id IN (SELECT current_user_company_ids())
        )
    );
"""

DISABLE_MEMBERSHIP_ROLES = """
DROP POLICY IF EXISTS membership_roles_tenant_isolation ON membership_roles;
ALTER TABLE membership_roles NO FORCE ROW LEVEL SECURITY;
ALTER TABLE membership_roles DISABLE ROW LEVEL SECURITY;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("roles", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_ROLES, reverse_sql=DISABLE_ROLES),
        migrations.RunSQL(ENABLE_MEMBERSHIP_ROLES, reverse_sql=DISABLE_MEMBERSHIP_ROLES),
    ]
