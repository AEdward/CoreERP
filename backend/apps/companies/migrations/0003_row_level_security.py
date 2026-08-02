"""Row-Level Security backstop for the tenant identity tables.

Scoped to "companies this user is a member of at all" (via
app.current_user_id), not the single active company — this is a coarse
defense-in-depth backstop against cross-tenant leaks, not the mechanism
for "which one company is currently selected" (that's request.company,
set by apps.common.middleware.CurrentCompanyMiddleware, and enforced by
ordinary queryset filtering in views). See docs/ARCHITECTURE.md §3.

FORCE ROW LEVEL SECURITY matters here: without it, Postgres exempts the
owning role from its own table's policies, which would make this a no-op
for whichever role runs migrations/queries — see the Postgres app-role
setup in docker/postgres/init.sql.

current_user_company_ids() is a SECURITY DEFINER function owned by the
`rls_definer` role (BYPASSRLS, created in docker/postgres/init.sql). A
policy on company_memberships cannot query company_memberships from
within its own USING/WITH CHECK clause — Postgres detects that as
infinite recursion and refuses it outright. Routing the membership
lookup through this function sidesteps that: the function's internal
query runs as its BYPASSRLS owner, so RLS never re-applies to itself.
"""

from django.db import migrations

CURRENT_USER = "NULLIF(current_setting('app.current_user_id', true), '')::int"
IS_PLATFORM_ADMIN = "current_setting('app.is_platform_admin', true) = 'true'"

CREATE_FUNCTION = """
CREATE FUNCTION current_user_company_ids() RETURNS SETOF integer
LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT company_id FROM company_memberships
    WHERE user_id = NULLIF(current_setting('app.current_user_id', true), '')::int
      AND status = 'active'
$$;

ALTER FUNCTION current_user_company_ids() OWNER TO rls_definer;
"""

DROP_FUNCTION = "DROP FUNCTION IF EXISTS current_user_company_ids();"

ENABLE_COMPANIES = f"""
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;

CREATE POLICY companies_tenant_isolation ON companies
    USING (
        {IS_PLATFORM_ADMIN}
        OR id IN (SELECT current_user_company_ids())
    )
    WITH CHECK (
        {IS_PLATFORM_ADMIN} OR {CURRENT_USER} IS NOT NULL
    );
"""

DISABLE_COMPANIES = """
DROP POLICY IF EXISTS companies_tenant_isolation ON companies;
ALTER TABLE companies NO FORCE ROW LEVEL SECURITY;
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
"""

ENABLE_MEMBERSHIPS = f"""
ALTER TABLE company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY company_memberships_tenant_isolation ON company_memberships
    USING (
        {IS_PLATFORM_ADMIN}
        OR user_id = {CURRENT_USER}
        OR company_id IN (SELECT current_user_company_ids())
    )
    WITH CHECK (
        {IS_PLATFORM_ADMIN} OR user_id = {CURRENT_USER}
    );
"""

DISABLE_MEMBERSHIPS = """
DROP POLICY IF EXISTS company_memberships_tenant_isolation ON company_memberships;
ALTER TABLE company_memberships NO FORCE ROW LEVEL SECURITY;
ALTER TABLE company_memberships DISABLE ROW LEVEL SECURITY;
"""


class Migration(migrations.Migration):
    dependencies = [("companies", "0002_initial")]

    operations = [
        migrations.RunSQL(CREATE_FUNCTION, reverse_sql=DROP_FUNCTION),
        migrations.RunSQL(ENABLE_COMPANIES, reverse_sql=DISABLE_COMPANIES),
        migrations.RunSQL(ENABLE_MEMBERSHIPS, reverse_sql=DISABLE_MEMBERSHIPS),
    ]
