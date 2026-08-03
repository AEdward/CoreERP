# CoreERP

A multi-tenant ERP platform: authentication, company/user/role management, HR, CRM, inventory, sales, and accounting under one roof, with industry-specific modules layered on later.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full system design — module map, multi-tenancy model, data model, role/permission system, tech stack, and phased roadmap. See [`TODO.md`](TODO.md) for build progress.

## Status

Phases 1–3 (Foundation, Business Core, Finance) are working end to end, backend and frontend, plus a company overview dashboard. See `TODO.md` for what's checked off.

## Running it locally

```bash
docker compose up
```

- Backend: http://localhost:8000 (migrates automatically on start)
- Frontend: http://localhost:3000

Then seed demo data (one user per default role, all in "Demo Co", password `demopass123`):

```bash
docker compose exec backend python manage.py seed_demo_data
```

Log in at http://localhost:3000/login with e.g. `owner@demo.test` / `demopass123`.

### Without Docker

```bash
# Postgres: create a `coreerp` database, then run docker/postgres/init.sql
# against it as a superuser — it creates the non-superuser app role RLS
# depends on (see that file's comments for why).

cd backend
cp .env.example .env   # adjust DB_HOST etc. for your local Postgres
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo_data
python manage.py runserver

# in another terminal
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

### Using Supabase instead of local Postgres

1. In the Supabase Dashboard's **SQL Editor**, run `docker/postgres/supabase_init.sql` — but first edit the file and replace `CHANGE_ME_TO_A_STRONG_PASSWORD` with a real password you generate (not your project's main database password — this creates a separate, deliberately limited `coreerp_app` role). Keep that password somewhere safe; you'll need it in step 3.
2. If the `rls_definer` / `BYPASSRLS` step in that script errors with a permissions error, stop and flag it — it means Supabase restricts granting that attribute here, and needs a different fix rather than a workaround guess.
3. `cd backend && cp .env.supabase.example .env`, then fill in `DB_PASSWORD` with the password from step 1, and check `DB_HOST`/`DB_USER` match your project (Project Settings → Database → Connection pooling → **Session mode**, port 5432 — not the 6543 transaction-mode pooler; see the comments in `.env.supabase.example` for why that distinction matters here).
4. `pip install -r requirements.txt && python manage.py migrate && python manage.py seed_demo_data`
5. Run the frontend as usual (`cd frontend && npm install && npm run dev`) — it talks to the backend over HTTP, not the database directly, so nothing changes there.

## Repo layout

```
backend/    Django + DRF API (apps/users, apps/companies, apps/roles, apps/common)
frontend/   Next.js app (login, signup, permission-gated dashboard)
docker/     Postgres init scripts (non-superuser app role + RLS support role) —
            init.sql for local Docker, supabase_init.sql for a Supabase project
docs/       Architecture doc
```
