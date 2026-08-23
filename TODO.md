# CoreERP — Build Todo

Tracks work against the roadmap in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#10-development-roadmap). Checked items are done.

For the full "Universal ERP" module inventory — every module across Core, Finance, Sales, HR, and every planned industry, each marked built/partial/not-built — see [`docs/MODULE_MAP.md`](docs/MODULE_MAP.md).

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

Backend APIs done for all seven areas, reusing the Phase 1 pattern end to end (`apps/common/rls.py`'s `tenant_policy_sql()`, `apps/common/views.py`'s `CompanyScopedViewSet`/`CompanyScopedReadOnlyViewSet`, `apps/common/serializers.py`'s `CompanyScopedSerializer`) — no module reinvented tenancy or permission checks. Verified via curl: nested line items, computed totals, stock movements updating materialized stock, cross-module permission gating, RLS + same-company FK validation on a real two-company user.

**Frontend**: all seven modules have working screens now.
- `dashboard/hr` — departments, employees
- `dashboard/inventory` — items, warehouses, live stock levels (read-only), stock movements
- `dashboard/procurement` — suppliers, purchase orders (with line items, computed totals)
- `dashboard/sales` — customers, quotations, sales orders, invoices (all with line items where relevant; invoicing from a sales order snapshots its total)

`components/LineItemsEditor.tsx` is shared by purchase orders, quotations, and sales orders — the "pick an item, quantity, price, add/remove line" interaction is identical across all three, differing only in which field name the price maps to server-side. Verified in a real browser end to end: every create flow, computed totals matching hand-checked math, the invoice-from-sales-order snapshot picking up the *correct* order's total (caught and fixed a wrong assumption in the test script itself — the order list is newest-first, so "last dropdown option" was the wrong element to pick), and a role without a module's view permission (HR Manager hitting Sales or Procurement directly by URL) getting a clean permission error with empty tables, not a crash or a data leak.

Building HR/Inventory surfaced a real backend bug, now fixed: a `UniqueConstraint` on `(company, ...)` can't be validated by DRF's automatic uniqueness check, because `company` is deliberately not a client-writable serializer field — a duplicate name was crashing as a raw 500 instead of a clean 400. `CompanyScopedMixin.perform_create`/`perform_update` now catch `IntegrityError` and turn it into a normal validation error, for every Phase 2+ module at once.

**Known gaps**: no edit/delete UI anywhere yet (list + create only, matching the API's scope choices so far); the permission-denied message on Sales/Procurement is technically accurate but generic (it surfaces whichever endpoint's 403 happened to reject first in the page's `Promise.all`, not a purpose-written "you don't have access to this module" message).

- [x] Employees & Departments (`apps/hr`) — gated by `hr.view`/`hr.manage`
- [x] Customers (`apps/crm`) — gated by `sales.view`/`sales.manage` per the existing matrix (Customers were always grouped under Sales Manager, not a separate CRM role)
- [x] Suppliers (`apps/suppliers`) — gated by a new `procurement` permission (see below)
- [x] Product & Service Catalog (`apps/catalog`, `Items` with `type` product/service) — gated by `inventory.manage` to write, but `inventory.view` OR `sales.view` to read (Sales needs to list items to build quotations) — the one module that doesn't fit the single-module pattern, handled with a small override rather than complicating the shared base for one case
- [x] Inventory Engine (`apps/inventory`: Warehouses, Stock, StockMovement) — Stock is read-only over the API; only StockMovement (in/out/transfer/adjustment) mutates it, inside a transaction with `select_for_update`, so every quantity change has an audit-trail row explaining it
- [x] Procurement Engine (`apps/procurement`: PurchaseOrder + line items) — added a `procurement` permission module the original Phase 1 matrix didn't anticipate, granted to Inventory Manager (purchasing-to-replenish-stock is usually the same job function) rather than inventing a new default role
- [x] Sales Engine (`apps/sales`: Quotation → SalesOrder → Invoice, all with line items and computed totals) — an Invoice tied to a SalesOrder snapshots `amount_cents` from the order's total at creation time, so later changes to the order's lines never retroactively change an already-issued invoice (same locking principle ClipBirr uses for CPM)

**Known gaps**: frontend UI now exists for all seven modules (see Phase 3 below — building Accounting added Bills to the Procurement page and finished the loop); still no "convert Quotation to SalesOrder" convenience action (create the order manually, referencing the quotation).

## Phase 3 — Finance

All of Phase 3 is done and verified end-to-end — including the hardest part, that a Balance Sheet generated from real transactions actually balances.

- [x] Chart of Accounts (`apps/accounting.Account`) — seeded default set per company (`apps/accounting/seed.py`, hooked into company creation the same way default roles are) via `Account.role` marking the "well-known" accounts (Cash, Accounts Receivable, Accounts Payable, Sales Revenue, Tax Payable, Default Expense) the posting engine looks up by meaning, not by name
- [x] Journal Entries / General Ledger posting engine (`apps/accounting.JournalEntry`/`JournalLine`) — append-only (`http_method_names` excludes PATCH/DELETE, same pattern as StockMovement: correcting a mistake means a reversing entry, not editing history); balanced-debits-equal-credits enforced in the serializer for manual entries, and structurally guaranteed for auto-posted ones since `posting.py` always writes matched pairs; a DB `CheckConstraint` also blocks a line from being both a debit and a credit at once
- [x] Accounts Payable / Accounts Receivable — genuinely "thin ledgers over the same journal-line mechanism" as the architecture doc says, not separate balance tables: issuing an `Invoice` (`apps.sales`) or a new `Bill` (`apps.procurement`, the AP counterpart to Invoice) auto-posts Dr AR/Cr Revenue or Dr Expense/Cr AP; recording a `Payment` (`apps.accounting`) auto-posts the clearing entry and flips the Invoice/Bill to `paid` once fully covered. Wired via Django signals in `apps/accounting/signals.py` — `apps.sales`/`apps.procurement` have zero awareness accounting exists, same one-directional-dependency principle as everywhere else in this codebase
- [x] Payment Engine — `apps.accounting.Payment`, unified for both directions (received from a customer against an Invoice, paid to a supplier against a Bill); append-only like JournalEntry
- [x] Financial Reports (`apps/accounting/reports.py`) — Trial Balance, Profit & Loss, Balance Sheet, all computed live from `journal_lines` aggregates, no summary tables to keep in sync. Balance Sheet is honest about its one real simplification: there's no period-close mechanism yet, so the current period's net income shows as its own "retained earnings (this period)" line rather than being folded into a real Retained Earnings equity account — the report says so explicitly in a `note` field rather than silently fudging the number
- [x] Company dashboard (`apps/dashboard/views.py`'s `CompanySummaryView`, one endpoint at `/api/dashboard/summary/`) — revenue, expenses, profit, pending receivable/payable (finance), sales order count + value (sales), item count + stock units + low-stock alerts (inventory), active employee count (hr). No dashboard-owned copies of any other app's logic: reuses `apps.accounting.reports._account_totals` for the finance numbers and queries each other app's models directly. Each section is included only if the requesting user has *that section's own* module permission — not one permission gating the whole endpoint — so a single-role user gets a smaller dashboard, not a 403; verified live that an HR Manager sees only the Employees stat while the Owner sees all eleven. Rendered as stat cards on the main `/dashboard` page, above the module tiles.

Frontend: `dashboard/accounting` (Chart of Accounts, Journal Entries with a manual-entry form, Payments, all three reports) and Bills added to `dashboard/procurement` (next to Purchase Orders, matching Invoice's placement next to Sales Orders — both gated by their existing module's permission, not a new one).

Verified end-to-end, backend via curl and frontend via a real browser: an invoice's auto-posted entry (Dr AR 10500 = Cr Revenue 10000 + Cr Tax Payable 500), a payment against it clearing AR to zero and flipping the invoice to paid, the identical loop on the AP side (Bill → Payment paid), an unbalanced manual entry rejected with a clear message, append-only enforcement (405 on PATCH/DELETE) for both JournalEntry and Payment, permission gating (Sales Manager 403, Finance Manager 200) and RLS (a brand-new company gets its own isolated seeded COA and sees zero of another company's journal entries) — and the Balance Sheet identity holding exactly against hand-checked math after a mix of invoice, bill, payment, and manual entries: Assets (450200) = Liabilities (500) + Equity (500000) + Net Income (-50300).

One real bug caught along the way, not in the accounting logic but in a test script: Playwright's `section:has-text("Payments")` does case-insensitive substring matching, and the Journal Entries section's own description text happens to contain the word "payments" — so a locator scoped that way silently grabbed a dropdown from the wrong section. Fixed by scoping via an exact-match heading instead. Worth remembering for any future test that reuses this pattern.

## Phase 3.5 — Platform Hardening (before Industry Modules)

The strategic plan is Core-first, then build Industry-Specific ERPs (Hotel, Real Estate, Retail, Healthcare, Construction) *on top of* this core. That reframes what "done" means here: Phase 4 verticals will reuse Items, Customers, Inventory, Sales, and Accounting rather than duplicating them, so any gap in the core becomes a gap repeated in every vertical built later. This phase is that gap list, grouped the same way it was scoped in conversation.

### Cross-cutting services
- [x] Document Management (attach a file to any record in any module) — `apps.documents`; generic content-type-based attachment with a whitelisted target registry and permission derived from the target record's own module, not a fixed one. Files are served only through a permission-checked `download` action, never a public `/media/` URL. Verified end-to-end: upload/list/download/delete on HR Employee, Sales Invoice, and Procurement Purchase Order; rejected an unlisted-model attach attempt and a nonexistent/cross-company `object_id` cleanly (400, not a crash); confirmed `/media/` itself returns 404 with no route.
- [x] Notification System (in-app first; email later) — `apps.notifications`; `notify_permission()` helper reaches every user holding a given `module.action` permission without callers needing to know which roles carry it. Wired to two real events (low-stock crossing, new Bill) rather than built speculatively ahead of a trigger. Verified end-to-end: both triggers fire with correct message/link, bell badge + dropdown work, mark-one and mark-all-read both work, a user without the relevant permission gets zero notifications, and cross-recipient isolation holds (RLS is the company-membership backstop, the viewset itself narrows to `recipient=request.user`).
- [ ] Workflow Engine (configurable approval chains)

### Team growth
- [ ] Invite-by-link flow (join an existing company — today you can only create one and become its Owner)
- [ ] Custom roles per company (beyond the five seeded defaults)

### Platform primitives (surfaced reviewing what Hotel/Real Estate/Retail/Healthcare/Construction will actually need — see chat)
Two of these are structural enough that retrofitting them after several vertical modules exist would be much more painful than adding them now, so they jump the queue ahead of the cross-cutting/team-growth items above:
- [x] **Branch/Location Management** — almost every real company in the target verticals (a hotel with multiple properties, a retail chain, a real-estate office network) operates across more than one physical location. `apps/branches.Branch` (company-scoped, same RLS pattern as everything else), with an optional `branch` FK added to Department, Employee, and Warehouse — the three models where "which location" is obviously meaningful today. Gated by a new `settings.view`/`settings.manage` split (previously only `settings.manage` existed, which would've locked everyone but the Owner out of even seeing the branch list needed to assign records to one) — `settings.view` was added to every default role's seeded permissions, with a data migration re-seeding existing companies so the change applies retroactively, not just to newly-created ones. Frontend: new `/dashboard/settings` page (Company profile edit + Branch management), and the previously-inert "Settings" dashboard tile now links to it. Extending `branch` to other modules (Customers, Sales/Procurement documents, etc.) is deliberately left for whenever a real need shows up rather than done exhaustively now.
  - Caught a real bug while building this: the data migration's `Company.objects.all()` returned zero rows and silently did nothing, because migrations run outside a request — `CurrentCompanyMiddleware` never fires, so the RLS session vars are unset and `companies`' `FORCE ROW LEVEL SECURITY` policy hides every row. Same root cause as the documented company-bootstrap RLS gotcha; fixed with the same `SET LOCAL app.is_platform_admin = 'true'` bypass, scoped to the migration's own transaction.
  - Verified in a real browser: Owner adds a branch, edits its address, assigns an Employee and a Warehouse to it (both show the branch name back correctly); a non-Owner role (HR Manager) can see the branch list but gets no Add/Edit/Delete controls and disabled company-profile fields — permission split confirmed both ways.
- [x] **Numbering Engine** — `apps/common.NumberSequence` + `next_number(company, code)`, a shared per-company/per-document-type atomic counter (`select_for_update` inside a transaction), replacing the ad hoc `f"INV-{company_id}-{id:05d}"` string-building that Invoice and Bill each had independently. Ready for Purchase Orders, Sales Orders, Quotations, or Employee numbers whenever those modules want a real number instead of `PO-{id}`/`SO-{id}` — not retrofitted onto them speculatively here. Verified via curl: three invoices in a row issued `INV-00001`, `INV-00002`, `INV-00003`; a bill issued `BILL-00001` independently. Known cosmetic quirk, not a bug: this dev database already had a few invoices numbered under the old `INV-{company_id}-{id}` format from earlier sessions — those keep their old-format numbers (no backfill/renumbering was done, and the two formats can't collide under the `unique(company, invoice_number)` constraint since they're different shapes), so a from-day-one company won't see this at all.
- Deliberately **deferred until a real trigger**, not built speculatively: Currency Engine (wait for an actual multi-currency company — FX revaluation is expensive to get right without a real case to validate against), Tax Engine beyond the current flat `tax_rate` field (wait for the first vertical that needs more than one flat rate, e.g. Hotel's Tourism Tax), Activity Timeline, Comments, Tagging (all cheap to bolt on later, don't shape the schema), Background Jobs / async (Celery+Redis stood up with nothing queued yet is premature — trigger off the first real async need, e.g. sending an invite email), PDF Engine, Import/Export.
- Deliberately **out of scope**, reconsider only if a specific vertical demands it: global Search, Dashboard Builder, Calendar/Tasks/Chat/Announcements — these are products in their own right (Slack/Asana territory) and would dilute focus from "foundation for industry verticals." API versioning (`/api/v1/`) costs nothing to add later by prefixing routes, so there's no reason to do it ahead of need. Mobile API is already satisfied — it's plain REST/JSON already, nothing vertical-specific to build.

### Trust & safety
- [x] Edit/delete UI across all modules that should have it — `components/RowActions.tsx` (shared Edit/Delete buttons, delete always confirms) added to HR (Departments, Employees), Catalog/Inventory (Items, Warehouses), CRM (Customers), Suppliers, Procurement (Purchase Orders), Sales (Quotations, Sales Orders), Accounting (Accounts). Every editable module's existing create form now doubles as the edit form (an `editing*Id` state switches Create → Save/Cancel), so no new form code was needed — just wiring, matching the "reuse the create form" pattern rather than a separate modal system.
  - Deliberately **not** editable/deletable: StockMovement, JournalEntry, Payment (already append-only — correcting a mistake means a reversing entry), and now also **Invoice and Bill** — these auto-post a journal entry on creation (`apps.accounting.signals`), so editing or deleting them after the fact would desync the ledger from the document. `InvoiceViewSet`/`BillViewSet` picked up the same `http_method_names = ["get", "post", "head", "options"]` restriction JournalEntry/Payment already had; this was a real latent gap, not just an omitted UI.
  - Chart of Accounts specifically: accounts with a `role` set (the well-known accounts the posting engine looks up by meaning — Cash, AR, AP, Tax Payable, Sales Revenue, Operating Expenses) show a "System account" label instead of Edit/Delete, since editing type or deleting one would break auto-posting silently.
  - Backend hardening alongside the UI: `CompanyScopedMixin.perform_destroy` (`apps/common/views.py`) now catches `IntegrityError` (most master data — Item, Customer, Supplier, Warehouse, Account — is FK-`PROTECT`'d from rows that depend on it) and turns it into a clean 400 instead of a raw 500, same pattern as the existing duplicate-name handling on create/update.
  - Verified in a real browser via Playwright, backend on real Postgres with RLS active: full edit→save and delete round-trips for a department, employee, item, warehouse, customer, supplier, purchase order (incl. line-item edit recomputing the total), quotation (incl. line edit), and a non-system account; confirmed Invoice/Bill sections render with no Edit/Delete buttons at all and that PATCH/DELETE against `/api/sales/invoices/<id>/` and `/api/procurement/bills/<id>/` return 405 directly via curl; confirmed the FK-protect path end-to-end — created a customer, attached a quotation to it, attempted delete (got the clean "still referenced by other records" 400, not a crash), deleted the quotation, then the customer delete succeeded.
- [ ] Automated test suite (backend + frontend) — everything so far has been verified manually per session via curl/Playwright, nothing regression-checked automatically
- [ ] Password reset
- [ ] Verified `docker compose up` end-to-end run (components have only been run individually in this sandbox so far, no Docker daemon available here)
- [ ] Audit log (who changed what, when — distinct from the accounting journal, which is financial-only)

### Platform-operator tooling
- [ ] Super Admin UI for managing companies/billing (`is_platform_admin` exists as a flag on `User`; nothing built on top of it yet)

### Prove the extension pattern
- [ ] Build a thin real vertical slice (Hotel: room bookings on top of the existing Items/Inventory models, folios on top of the existing Invoice model) to validate that verticals genuinely *extend* the core rather than needing to duplicate it, before committing to that pattern across five industries

## Phase 4 — Industry Modules

Backlog, unscheduled. Pick based on real demand once Phases 1–3.5 are live, not speculatively.

- [ ] Hotel (room bookings, folios)
- [ ] Real Estate (leases, units)
- [ ] Retail (POS)
- [ ] Healthcare (patient records)
- [ ] Construction (project costing)

## Open risks to revisit (from architecture doc §11)

- [x] RLS policies written and tested for the Phase 1 tables — pattern established (`current_user_company_ids()` SECURITY DEFINER function) for Phase 2 tables to reuse rather than reinvent. Learned two sharp edges worth remembering: (1) a policy can't safely reference its own table in a subquery — Postgres detects it as infinite recursion; (2) `INSERT ... RETURNING` (which Django's ORM always uses) is subject to the `USING`/SELECT policy too, not just `WITH CHECK` — so a row that grants its own visibility (like a company's first membership) needs a scoped `SET LOCAL` bypass at creation time.
- [x] Multi-company "active company" UX validated with a real multi-membership user — gave a user memberships in two companies and confirmed the `same_company_fields` check (not RLS, which is member-of-any-company-scoped by design) is what actually catches "wrong company active" mistakes on FK fields
- [ ] Decide Django admin's role for Super Admin platform-operator tooling — tracked under Phase 3.5 platform-operator tooling above
