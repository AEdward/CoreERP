"""Reusable Row-Level Security policy generator for tenant-owned tables.

Every Phase 2+ business table (employees, customers, items, ...) is
tenant data in the narrower sense described in docs/ARCHITECTURE.md §3:
scoped to "companies this user belongs to at all" as a defense-in-depth
backstop, via the same current_user_company_ids() SECURITY DEFINER
function created in apps/companies/migrations/0003. The active-company
narrowing ("which one company am I looking at right now") stays an
app-layer concern, enforced by CompanyScopedViewSet.get_queryset.

Unlike apps.companies' company_memberships table, none of these tables
reference themselves within their own policy, so there's no recursion
concern here — this is the plain, no-surprises case.
"""

IS_PLATFORM_ADMIN = "current_setting('app.is_platform_admin', true) = 'true'"


def tenant_policy_sql(table_name: str) -> tuple[str, str]:
    """Returns (enable_sql, disable_sql) for a simple company_id-scoped
    RLS policy on `table_name`. Use as a migrations.RunSQL pair."""
    policy_name = f"{table_name}_tenant_isolation"
    condition = f"{IS_PLATFORM_ADMIN} OR company_id IN (SELECT current_user_company_ids())"

    enable_sql = f"""
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY;

CREATE POLICY {policy_name} ON {table_name}
    USING ({condition})
    WITH CHECK ({condition});
"""

    disable_sql = f"""
DROP POLICY IF EXISTS {policy_name} ON {table_name};
ALTER TABLE {table_name} NO FORCE ROW LEVEL SECURITY;
ALTER TABLE {table_name} DISABLE ROW LEVEL SECURITY;
"""
    return enable_sql, disable_sql
