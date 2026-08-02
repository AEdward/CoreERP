# CoreERP — Build Todo

Tracks work against the roadmap in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#10-development-roadmap). Checked items are done; nothing below Phase 1 is started.

## Phase 1 — Foundation

Goal: a user can sign up, create or join a company, and land on an empty but permission-gated dashboard. Nothing else is buildable without this.

- [ ] **Scaffolding**: Django + DRF project, Next.js project, Docker Compose (`postgres`, `backend`, `frontend`) — `docker compose up` boots all three locally
- [ ] **Users**: custom `User` model, signup/login (session or token auth), password reset
- [ ] **Companies**: `Company` model, create-company and join-company flows
- [ ] **CompanyMemberships**: join table (`users` ↔ `companies`), "active company" session/context resolution, company switcher for users in more than one company
- [ ] **Roles & Permissions**: `Role`, `Permission`, `RolePermission`, `MembershipRole` models; seed the five default roles (Owner, Finance Manager, HR Manager, Sales Manager, Inventory Manager) with their default `ROLE_PERMISSIONS`
- [ ] **Authorization layer**: `permission_required(company, module, action)` check + DRF permission class, applied uniformly rather than per-view ad hoc
- [ ] **Tenancy enforcement**: request-scoped "current company" query scoping + Postgres Row-Level Security policies on the first tenant tables (`companies`, `company_memberships`, `roles` where `company_id` is set)
- [ ] **Settings**: company profile (name, logo, industry, country, currency, timezone, tax number) view/edit
- [ ] **Dashboard shell**: empty, permission-gated landing page in Next.js (proves auth + company context + RBAC end to end)
- [ ] **Seed data**: fixtures/management command for demo companies, users, and roles for local dev

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

- [ ] RLS policies written and tested per tenant table as each module ships, not retrofitted later
- [ ] Multi-company "active company" UX validated with a real multi-membership user, not just the data model
- [ ] Decide Django admin's role for Super Admin platform-operator tooling before Phase 1 settings work locks in the pattern
