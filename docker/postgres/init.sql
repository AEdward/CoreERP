-- Runs once, on first container init, as the superuser (POSTGRES_USER).
--
-- The Django app connects as a dedicated, non-superuser role instead of
-- the cluster superuser. This matters for Row-Level Security: Postgres
-- exempts superusers from RLS unconditionally (FORCE ROW LEVEL SECURITY
-- cannot override that), so if the app connected as the superuser, every
-- RLS policy in the companies/roles migrations would be silently inert.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'coreerp_app') THEN
        CREATE ROLE coreerp_app LOGIN PASSWORD 'coreerp_app' NOSUPERUSER NOCREATEDB NOCREATEROLE;
    END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE coreerp TO coreerp_app;
GRANT ALL ON SCHEMA public TO coreerp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO coreerp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO coreerp_app;

-- A narrowly-scoped role used only to own the current_user_company_ids()
-- SECURITY DEFINER function (see apps/companies/migrations/0003).
-- BYPASSRLS is what lets that one function's internal query read
-- company_memberships without RLS re-applying to itself — without this,
-- a membership policy that queries company_memberships from within its
-- own policy recurses infinitely (Postgres rejects it outright). This
-- role has no LOGIN and no other privileges beyond schema CREATE (needed
-- only so ALTER FUNCTION ... OWNER TO rls_definer is legal — Postgres
-- requires the new owner be able to create in the object's schema, not
-- just that you're a member of it), so it can't be connected to or used
-- for anything beyond owning that function.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'rls_definer') THEN
        CREATE ROLE rls_definer NOLOGIN BYPASSRLS;
    END IF;
END
$$;

GRANT rls_definer TO coreerp_app;
GRANT ALL ON SCHEMA public TO rls_definer;

-- BYPASSRLS only skips the RLS check itself — the role still needs the
-- ordinary table-level GRANT to read company_memberships at all. Tables
-- don't exist yet at cluster-init time (migrations haven't run), so this
-- has to be a default-privilege rule for objects coreerp_app creates.
ALTER DEFAULT PRIVILEGES FOR ROLE coreerp_app IN SCHEMA public GRANT SELECT ON TABLES TO rls_definer;
