# CoreERP

A multi-tenant ERP platform: authentication, company/user/role management, HR, CRM, inventory, sales, and accounting under one roof, with industry-specific modules layered on later.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full system design — module map, multi-tenancy model, data model, role/permission system, tech stack, and phased roadmap. See [`TODO.md`](TODO.md) for build progress.

## Status

Phase 1 (Foundation) in progress: auth, multi-company, roles/permissions, and Postgres Row-Level Security are working end to end. See `TODO.md` for what's checked off.

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

## Repo layout

```
backend/    Django + DRF API (apps/users, apps/companies, apps/roles, apps/common)
frontend/   Next.js app (login, signup, permission-gated dashboard)
docker/     Postgres init script (non-superuser app role + RLS support role)
docs/       Architecture doc
```
