# CoreERP — Build Todo

Tracks work against the roadmap in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#10-development-roadmap). Checked items are done; nothing below Phase 1 is started.

## Phase 1 — Foundation

Goal: a user can sign up, create or join a company, and land on an empty but permission-gated dashboard. Nothing else is buildable without this.

- [x] **Scaffolding**: Django + DRF project (`backend/`), Next.js project (`frontend/`), Docker Compose (`postgres`, `backend`, `frontend`). Note: verified by running each component directly (local Postgres, `manage.py runserver`, `npm run dev`) since this sandbox has no Docker daemon — the `docker-compose.yml`/Dockerfiles are written and reviewed but not yet run through `docker compose up` itself; worth a real run before relying on it.
- [x] **Users**: custom `User` model (email as `USERNAME_FIELD`), signup/login/logout/`me` endpoints, session auth + CSRF
  - [ ] Password reset — not built yet
- [x] **Companies**: `Company` model, self-serve create-company flow (creator becomes Owner automatically)
  - [ ] Join-an-existing-company flow (invite-by-link) — deferred; this is really Phase 2 team-invite scope per the architecture doc, not a Phase 1 blocker
- [x] **CompanyMemberships**: join table, "active company" session context (`request.company`, set by `CurrentCompanyMiddleware`), company switcher UI (frontend dashboard)
- [x] **Roles & Permissions**: `Role`, `Permission`, `RolePermission`, `MembershipRole` models; `apps/roles/seed.py` seeds the five default roles with their permissions on every company creation
- [x] **Authorization layer**: `user_has_permission(user, company, module, action)` + DRF `HasCompanyPermission`, used directly in the company-settings PATCH endpoint
- [x] **Tenancy enforcement**: `CurrentCompanyMiddleware` scopes `request.company`; Postgres RLS (`FORCE ROW LEVEL SECURITY` + a `SECURITY DEFINER` bypass function to avoid self-referential policy recursion) on `companies`, `company_memberships`, `roles`, `membership_roles` — verified end-to-end: an unrelated user gets an empty company list and a 404 on direct access, not a leak
- [x] **Settings**: company profile GET (any member) / PATCH (`settings.manage` only) — verified a non-Owner role is blocked
- [x] **Dashboard shell**: Next.js login/signup/dashboard; dashboard renders module tiles gated by the active membership's flattened permission list — verified in a real browser that an Owner sees all five tiles enabled and a Sales Manager sees only Sales & CRM
- [x] **Seed data**: `manage.py seed_demo_data` — "Demo Co" with one user per default role, password `demopass123`

## Phase 2 — Business Core

Not started. Sequencing depends on Phase 1 landing cleanly (RLS pattern and permission checks get reused, not reinvented, per module).

- [ ] Employees & Departments
- [ ] Customers (CRM)
- [ ] Suppliers
- [ ] Product & Service Catalog (`Items`, type `product`/`service`)
- [ ] Inventory Engine (Warehouses, Stock, Stock Movements)
- [ ] Procurement Engine
- [ ] Sales Engine (Quotations → Sales Orders → Invoices)

## Phase 3 — Finance

Not started.

- [ ] Chart of Accounts (seeded default set per company)
- [ ] Journal Entries / General Ledger posting engine (balanced-transaction invariant enforced at posting time)
- [ ] Accounts Payable / Accounts Receivable ledgers
- [ ] Payment Engine
- [ ] Company dashboard (revenue, expenses, profit, sales, inventory, employees, pending payments)
- [ ] Financial Reports (P&L, Balance Sheet) — stretch goal within this phase

## Phase 4 — Industry Modules

Backlog, unscheduled. Pick based on real demand once Phases 1–3 are live, not speculatively.

- [ ] Hotel (room bookings, folios)
- [ ] Real Estate (leases, units)
- [ ] Retail (POS)
- [ ] Healthcare (patient records)
- [ ] Construction (project costing)

## Cross-cutting Platform Services

Built as shared services when the first module needs them — not a phase of their own, and not built speculatively ahead of that need.

- [ ] Document Management (attach a file to any record in any module)
- [ ] Notification System (in-app first; email later)
- [ ] Workflow Engine (configurable approval chains)

## Open risks to revisit (from architecture doc §11)

- [x] RLS policies written and tested for the Phase 1 tables — pattern established (`current_user_company_ids()` SECURITY DEFINER function) for Phase 2 tables to reuse rather than reinvent. Learned two sharp edges worth remembering: (1) a policy can't safely reference its own table in a subquery — Postgres detects it as infinite recursion; (2) `INSERT ... RETURNING` (which Django's ORM always uses) is subject to the `USING`/SELECT policy too, not just `WITH CHECK` — so a row that grants its own visibility (like a company's first membership) needs a scoped `SET LOCAL` bypass at creation time.
- [ ] Multi-company "active company" UX validated with a real multi-membership user, not just the data model
- [ ] Decide Django admin's role for Super Admin platform-operator tooling before Phase 1 settings work locks in the pattern
