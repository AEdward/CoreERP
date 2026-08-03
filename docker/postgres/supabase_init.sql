-- One-time setup: run this against your Supabase project's database
-- before the first `python manage.py migrate`. Easiest way: paste it
-- into the Supabase Dashboard's SQL Editor and run it — or use psql
-- against the session-mode pooler (see backend/.env.supabase.example
-- for why session mode, not transaction mode).
--
-- This is the Supabase-hosted equivalent of docker/postgres/init.sql —
-- see that file's comments for the full rationale (a non-superuser app
-- role, because Postgres exempts superusers from Row-Level Security
-- unconditionally; a narrowly-scoped BYPASSRLS role so the
-- current_user_company_ids() function — added by the Django migration
-- apps/companies/migrations/0003 — can read company_memberships without
-- its own RLS policy recursing into itself).
--
-- Differences from the local Docker version:
--   - Targets Supabase's default `postgres` database, not `coreerp`
--   - Uses a real password you choose below, not the local-dev default
--     'coreerp_app' — this database is reachable from the internet

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'coreerp_app') THEN
        CREATE ROLE coreerp_app LOGIN PASSWORD 'CHANGE_ME_TO_A_STRONG_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE;
    END IF;
END
$$;

-- Creating a role does NOT automatically make the creator a member of
-- it. The ALTER DEFAULT PRIVILEGES FOR ROLE coreerp_app statement below
-- needs that membership (Postgres requires you to be a member of a role
-- to alter its default privileges) — without this line it fails with
-- "permission denied to change default privileges".
GRANT coreerp_app TO CURRENT_USER;

GRANT ALL PRIVILEGES ON DATABASE postgres TO coreerp_app;
GRANT ALL ON SCHEMA public TO coreerp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO coreerp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO coreerp_app;

-- If this next block fails with a permissions error, Supabase's
-- `postgres` role isn't allowed to grant BYPASSRLS here (only a true
-- superuser can grant that attribute in stock Postgres) — stop and let's
-- work out the Supabase-specific alternative rather than guessing further.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'rls_definer') THEN
        CREATE ROLE rls_definer NOLOGIN BYPASSRLS;
    END IF;
END
$$;

GRANT rls_definer TO coreerp_app;
GRANT ALL ON SCHEMA public TO rls_definer;
ALTER DEFAULT PRIVILEGES FOR ROLE coreerp_app IN SCHEMA public GRANT SELECT ON TABLES TO rls_definer;
