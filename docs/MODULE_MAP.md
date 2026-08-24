# CoreERP — Universal Module Map

The standing reference for the "Universal ERP" plan: Core + reusable Business/Finance/People modules, with Industry modules layered on top rather than 408 independent systems (see `docs/ARCHITECTURE.md` for the multi-tenancy/RBAC/accounting design those modules build on).

**Status legend**
- `[x]` — built and verified in CoreERP
- `[ ]` *(partial)* — something exists but doesn't cover the full item; note explains the gap
- `[ ]` — not built. Where the [AEdward/MiranErp](https://github.com/AEdward/MiranErp) Hotel build already has a portable version, that's noted — nothing from it has been merged into CoreERP yet.

Scope note: sections I onward (Manufacturing and every named industry) are Phase 4 territory — intentionally all unbuilt, in this repo, by design. They're listed in full because the ask was to include everything, not because any are scheduled.

---

## A. Core Platform

- [x] Dashboard — `apps.dashboard`, company summary + module tiles
- [x] Company Management — `apps.companies`
- [x] Branch / Location Management — `apps.branches`
- [x] User Management — `apps.users` (signup/login/me); no admin UI to manage *other* users beyond roles, no invite-by-link yet
- [x] Roles & Permissions — `apps.roles`, 5 seeded defaults, `view`/`manage` split; **custom roles per company not built**
- [x] Employee Management — `apps.hr.Employee`
- [x] Department Management — `apps.hr.Department`
- [ ] *(partial)* Organization Structure — the Company→Branch→Department→Employee hierarchy exists as data; no org-chart view
- [ ] *(partial)* CRM / Contacts — see section C; today it's just `Customer`, no unified contact model shared with Supplier/Employee
- [x] Customer Management — `apps.crm.Customer`
- [x] Supplier Management — `apps.suppliers.Supplier`
- [x] Product & Service Catalog — `apps.catalog.Item`
- [x] Document Management — `apps.documents` (generic `Document` model via `content_type`/`object_id`, whitelisted target registry, permission derived from the target record's own module). Wired into HR Employee, Sales Invoice, Procurement Purchase Order as proof across different modules; adding a new target is one line in `apps/common/targeting.py` (moved there from `apps/documents/registry.py` once Notes became a second consumer of the same whitelist).
- [x] File / Attachment Management — same module as above
- [x] Notifications — `apps.notifications` (in-app; email/SMS deliberately not built — no real trigger for it yet). Recipient-scoped, not just company-scoped — RLS is the "member of this company" backstop, the viewset itself filters to `recipient=request.user`. `notify_permission(company, module, action, message, link)` messages every user holding that permission, without the caller needing to know which roles carry it. Two real triggers wired: a low-stock crossing on `StockMovement` (only on the movement that actually crosses into shortage, not every one after), and a new `Bill` (to whoever holds `accounting.manage`). Bell icon + polling badge + dropdown in `AppHeader`, mark-one/mark-all-read.
- [x] Tasks — `apps.tasks` (standalone company-wide task list: title, description, assignee, due date, status; no generic content_type/object_id link to other records the way Documents has — nothing's needed that yet). New `tasks.view`/`tasks.manage` permission, granted to every default role (unlike most modules, no role is task-locked-out — it's shared productivity infrastructure). New `GET /api/companies/members/` endpoint backs the assignee picker.
- [x] Calendar — `apps.calendar.Event` (own standalone entries: title, start/end, all-day) plus `/dashboard/calendar` aggregating existing due dates from Tasks/Invoices/Bills client-side — no duplicate storage for those, they're fetched live and just bucketed by day. New `calendar.view`/`calendar.manage` permission, added to `SHARED_PERMISSIONS` (see Tasks entry above — this was the third addition to that list, worth the refactor). Caught and fixed a real timezone bug while building this: routing an all-day date through `Date` → `toISOString()` → back crosses UTC and can silently shift the calendar day for anyone not in UTC; fixed by treating dates as plain `YYYY-MM-DD` strings throughout instead.
- [x] Notes & Comments — `apps.notes.Note` (same generic `content_type`/`object_id` attachment pattern as Documents, sharing the same `apps.common.targeting.ALLOWED_TARGETS` whitelist — the second real consumer, which is what justified moving that registry out of `apps.documents` in the first place). Permission derived per-request from whichever target record is being touched (`view` to list, `manage` to add/edit/delete), not a fixed `permission_module`. Wired into the same three proof points as Documents (HR Employee, Sales Invoice, Procurement Purchase Order) via a `NotesPanel` component mirroring `DocumentsPanel`. Found and fixed a real bug while testing: both `DocumentViewSet.list()` and the new `NoteViewSet.list()` narrowed results by assigning `self.queryset = ...`, but each viewset overrides `get_queryset()` to ignore `self.queryset` entirely — so `list()` was silently returning every document/note in the company regardless of which record was requested. Fixed both by having `get_queryset()` read back an explicit `_list_content_type`/`_list_object_id` pair that `list()` sets before delegating, instead of relying on the unused `self.queryset` attribute. Verified end-to-end via Playwright (create/edit/delete) and direct API checks: unlisted-model rejected on both list and create, a nonexistent/cross-company `object_id` rejected on create, and a valid create against a real record succeeds.
- [x] Activity Timeline — `apps.activity.Activity` (third consumer of `apps.common.targeting.ALLOWED_TARGETS`, after Documents and Notes). Read-only: entries are never created through the API, only written from two sources — a `post_save` signal connected once per whitelisted model (wired in `ActivityConfig.ready()`, looping `ALLOWED_TARGETS`) that logs a "created" entry automatically, and explicit `log_activity()` calls from `NoteViewSet.perform_create`/`DocumentViewSet.perform_create` for "note added"/"document attached". Actor attribution for the signal case (which gets no `request`) comes from a small thread-local (`apps.common.current_user`, set/cleared by `CurrentCompanyMiddleware` per request) — the one narrowly-scoped exception to this project's usual "pass request explicitly" style. Wired into the same three proof points as Documents/Notes via an `ActivityPanel` component. Verified end-to-end via Playwright: creating an employee, adding a note, and attaching a file all produced the correct three timeline entries scoped to that one record (not leaking from other records); unlisted-model list rejected (404), missing query params rejected (404), and POST correctly unreachable (the viewset is read-only, so the router never binds `create`).
- [x] Global Search — `apps.search.GlobalSearchView` (one `GET /api/search/?q=` endpoint, not a module owning its own search box). Fourth consumer of the `ALLOWED_TARGETS` whitelist: reuses it for `permission_module`/label per model, adding only what search needs — `search_fields` and a title format — in `apps.common.search_targets.SEARCH_TARGETS`. Deliberately skips `PurchaseOrder`/`Quotation`/`SalesOrder`, which have no own text field (just `<Prefix>-<id>` over a related Customer/Supplier) — still findable by searching that related record. A model is silently excluded from a user's results if they lack `view` on its module, checked per-model before querying (not filtered after the fact). `GlobalSearch` component in `AppHeader`, debounced, ≥2 characters, capped at 30 results / 5 per model. Verified end-to-end: a new employee is findable by name from a different page within one search; a 1-character query returns no dropdown; and — the one that actually matters here — a user with only `accounting.view`/`manage` (no `hr.view`) searching the same term gets zero results, confirming the per-model permission check, not just the UI, gates what comes back.
- [x] Audit Logs — `apps.auditlog.AuditLog`, built fresh for CoreERP (no MiranErp code copied — per the "don't copy, let's talk first" instruction, the workflow was: read MiranErp's `apps.auditlog` for reference, discuss, then write CoreERP's own version). Design informed by that comparison: entries are written from exactly one place — the shared `CompanyScopedMixin.perform_create`/`perform_update`/`perform_destroy` in `apps/common/views.py`, the same base every `CompanyScopedViewSet`/`CompanyScopedReadOnlyViewSet` in the app already builds on — so all ~20 existing viewsets across every module got audit coverage from one change, with zero per-app wiring, and coverage is intentionally broader than `apps.activity`'s (not limited to the `ALLOWED_TARGETS` whitelist — master data like `Warehouse`/`Account` is covered too, verified directly). Diffs are computed by serializing the instance through the viewset's own serializer before and after `save()` (not raw model-field comparison), so a diff shows exactly what the API itself would show — FKs as ids, dates as ISO strings — with no separate field-serialization code needed. One real bug the MiranErp comparison surfaced before it was ever written into CoreERP: on delete, Django resets `instance.pk` to `None` once `.delete()` completes, so the audit entry has to be written *before* calling `instance.delete()`, not after — got this right from the start by catching it during the read-through of MiranErp's `perform_destroy`, rather than finding it via a failing test. Read access is a single strict gate — `settings.manage` (Owner-level) even to view one record's own history, not the `<module>.view` a friendlier feed like Activity uses — since a cross-module change trail is more sensitive than any one module's own data. New `/dashboard/audit-log` page (linked from Settings, admin-only) shows the company-wide ledger. Verified end-to-end via Playwright: create→update→delete on an Employee produced all three entries with an accurate field diff on the update (`last_name`, `position`) and a correct `target_label` on the delete entry (confirming the pk-reset ordering was handled correctly); a non-admin role gets 403 on both the company-wide and per-record endpoints; and a regression check confirmed CRUD still works normally across two unrelated apps (Customer, Warehouse) after the shared mixin change.
- [x] Workflow / Approval Engine — `apps.approvals.ApprovalRequest`. Single-step, not a configurable multi-stage chain — the only real consumer needs exactly one decision, and a chain-of-approvers engine would be speculative ahead of any actual need. Own whitelist (`apps.approvals.registry.APPROVABLE_TARGETS`) rather than reusing `apps.common.targeting.ALLOWED_TARGETS`, since not every attachable record makes sense to route through approval. Right now only `procurement.PurchaseOrder` is wired up — its `status` field already had an unused `APPROVED` value sitting there with nothing enforcing the transition into it, the same shape `Item.tax_rate` was in before `apps.tax` existed. A consuming app registers three hooks from its own `AppConfig.ready()` (`check_requestable`/`on_requested`/`on_decided`) so `apps.approvals` never has to import a specific domain app — the same "caller reaches in, the generic app stays generic" shape as `apps.activity`'s signal registration and `apps.notifications.notify_permission()`. Segregation of duties enforced at decision time: whoever requested approval can't also grant or deny it, checked server-side (403), not just hidden in the UI. Requesting and deciding both reuse the target's own module's `manage` permission — no new permission axis. `PurchaseOrderSerializer.validate_status()` blocks a client from setting submitted/approved/rejected directly (those come only from the approval flow now), but explicitly allows resending the *unchanged* current value — caught this distinction during testing: the order form always resends `status` alongside an unrelated edit (fixing a line item on an already-approved order), so blocking on mere presence rather than on an actual state change would have broken ordinary edits. New `ApprovalPanel` component wired into the Procurement page's Purchase Order rows, matching the Documents/Notes/Activity panel shape. Verified end-to-end via Playwright: a real UI request-approval flow flips PO status draft→submitted; a direct client PATCH to `approved` is rejected (400); the requester is blocked from approving their own request (403); a second user holding the same `procurement.manage` permission approves successfully, flipping status to `approved`; editing lines on the now-approved PO while resending the unchanged status still succeeds; re-deciding an already-decided request is rejected (400); a duplicate pending request on the same record is rejected (400); rejecting (with a decision note) flips status to `rejected` and notifies the requester; and re-requesting is correctly blocked until the record is moved back to Draft.
- [x] Settings — `/dashboard/settings`: company profile + branches
- [ ] Localization — not built (Company has `country`/`timezone` fields, nothing acts on them)
- [ ] Multi-language — not built
- [ ] *(partial)* Multi-currency — Company has one `currency` field; no multi-currency transactions/conversion (deliberately deferred earlier as "Currency Engine")
- [x] Tax Configuration — `apps.tax.TaxRate`, built fresh after comparing with MiranErp's `apps.tax` (same "don't copy, let's talk first, then build our own" workflow as Audit Logs). `Item.tax_rate` — previously a decorative flat decimal nothing computed from — is now a real FK to a company-configured `TaxRate`; tax is opt-in per item, not a single company-wide percentage. Real differences from MiranErp's version, not a port: dropped the hotel-specific `applies_to_room_charges` flag and its tax-inclusive-total variant (`compute_inclusive_tax_cents`) — Core's line items are always net-of-tax, so there's nothing industry-specific to extract; and no rates are seeded by default (MiranErp hardcodes its actual Ethiopia VAT/Tourism-levy numbers, appropriate for a single real deployment — CoreERP has no fixed jurisdiction to assume one for, so a company adds its own via Settings). `apps.tax.engine.compute_line_tax_cents(lines)` is wired into `InvoiceSerializer.create()`/`BillSerializer.create()`: when an Invoice/Bill is tied to a SalesOrder/PurchaseOrder, `tax_amount_cents` is computed from that order's lines (each taxed by its own item's rate) the same place `amount_cents` already gets snapshotted from the order's total — a standalone Invoice/Bill (no order) keeps its existing manually-entered tax amount, since there are no lines to compute from. New "Tax rates" section in Settings (`settings.manage`-gated add/edit/delete, `settings.view` to see them), and the Catalog Item form's tax input changed from a free-text percentage to a dropdown of active rates. Verified end-to-end via Playwright: a real UI flow (add a 15% VAT rate in Settings → assign it to a new Item in Inventory) followed by API-driven PO→Bill and SalesOrder→Invoice flows, confirming `tax_amount_cents` computed exactly right (1500 cents on a 10000-cent net total) on both the purchasing and selling sides; and a separate item with no rate assigned correctly produces zero tax on its invoice.
- [x] Numbering / Document Sequences — `apps.common.NumberSequence` / `next_number()`, driving Invoice/Bill numbers today

## B. Finance & Accounting

- [x] Accounting — `apps.accounting`, full double-entry
- [x] Chart of Accounts
- [x] General Ledger
- [x] Journal Entries — append-only, balanced-lines enforced
- [x] Accounts Payable — via Bill + Payment
- [x] Accounts Receivable — via Invoice + Payment
- [x] Invoices — append-only after issue, auto-posts
- [x] Bills — append-only after issue, auto-posts
- [x] Payments — append-only, both directions
- [x] Receipts — `Payment.receipt_number`, generated via the existing `apps.common.numbering.next_number()` engine (a third consumer, after Invoice/Bill — the exact reason that engine was built as one shared thing rather than each document type formatting its own id-based string), plus a printable `/dashboard/accounting/receipts/[id]` page. Deliberately just a clean HTML page with a `window.print()` button, not a generated PDF — the browser's own print-to-PDF already covers "save as a file" without adding a PDF-generation library this project doesn't otherwise need. Resolves what the payment was against (Invoice/Bill/Expense) by reusing the same list endpoints the Accounting page already fetches, no new detail-lookup endpoints needed. Verified end-to-end via Playwright: a real payment against an Invoice gets a `RCT-00001`-style number automatically, the Accounting page's new "Receipt" link opens it in a new tab showing the correct company name, receipt number, invoice reference, amount, method, and payment reference; separately confirmed the Bill-payment branch of the same page correctly shows "Paid to" and the bill number.
- [x] Expenses — `apps.expenses.Expense`, the first item worked through in Section B (Finance & Accounting) once Section A's well-scoped items ran out — genuinely useful as a second real consumer of `apps.approvals` (after Purchase Orders), which is exactly what proved that abstraction was worth building generically rather than baking approval logic into procurement alone. Posts through accounting exactly like a Bill does once approved (`apps.accounting.posting.post_expense_journal`: Dr Default Expense, Cr Accounts Payable — the same account a Bill uses, since both are "money owed to someone outside cash"), and clears the same way too: `Payment.expense` extends the existing exactly-one-of-{invoice,bill} constraint to three, and `post_payment_journal`'s existing "paid" branch didn't even need to change, since it already just debits Accounts Payable regardless of what it's against. Known simplification, documented in the model's own docstring: `expenses.manage` is granted to every default role (added to `SHARED_PERMISSIONS`) so any employee can submit their own claim — the permission model has no per-row-ownership dimension to say "only your own records" without granting "manage everyone's" too, so the real access control is segregation of duties at approval time, not a role gate on who can approve. A new `EmployeePickerView` (`apps.hr`, mirroring `CompanyMembersView`'s existing precedent for Tasks) lets any company member populate the employee dropdown without needing `hr.view`. Registered in all four existing whitelists — `apps.common.targeting.ALLOWED_TARGETS` (Documents/Notes/Activity), `apps.common.search_targets.SEARCH_TARGETS`, and `apps.approvals.registry.APPROVABLE_TARGETS` — each a one-line addition, confirming those registries generalize cleanly to a genuinely new module rather than just the ones they were designed around. Verified end-to-end via Playwright, the most complete single-feature test this session: filed via the real UI → receipt attached via Documents → approval requested → confirmed no journal entry exists yet → requester blocked from self-approving (403) → a second user with the same `expenses.manage` approves → journal entry posts with the correct Dr/Cr amounts → a real Payment recorded through the Accounting page's UI flips it to Paid → found via Global Search → the full lifecycle visible in the Audit Log.
- [x] Petty Cash — `apps.accounting.{PettyCashFund, PettyCashTransaction}`, built as the imprest-fund pattern: a fund starts at (and is periodically topped back up to) a declared `imprest_amount_cents`, and `apps.accounting.posting.post_petty_cash_transaction_journal` posts each transaction the moment it's recorded (append-only, like Payment) — a disbursement debits Default Expense and credits the fund's own GL `account`, a replenishment debits the fund's account and credits Cash. `PettyCashFund.balance_cents` is a live `SerializerMethodField` reading the fund's own account's real ledger balance, not a stored running total, so it can never drift from the journal. Custodian is an `hr.Employee` FK (`on_delete=PROTECT`), reusing the same picker (`EmployeePickerView`) Expenses uses. Caught and fixed a real bug during this build: `PettyCashTransactionViewSet.perform_create` originally called `serializer.save()` directly instead of `super().perform_create()`, which silently bypassed both the duplicate-error translation and — more importantly — the Audit Log write that every other `CompanyScopedViewSet` gets for free; fixed to call `super().perform_create(serializer)` first (so the base class's audit-log hook fires) and post the journal entry against `serializer.instance` afterward. Verified end-to-end via Playwright: created a fund against a dedicated GL account, replenished it 100000 cents then disbursed 15000, confirmed `balance_cents` read back exactly 85000; confirmed both transactions appear in the Audit Log by name (`Disbursement 15000 (...)`, `Replenishment 100000 (...)`) — proving the perform_create fix actually restored logging, not just that it stopped erroring.
- [x] Cash Management — Bank Accounts and Petty Cash Funds (below) now each expose a live, per-account `balance_cents` register view computed straight from `journal_lines`, closing the "no dedicated register/position view" gap this item used to flag; there's still no single dashboard that lists every cash-like account's position side by side, so a company with several bank accounts and funds checks each one's own page rather than one combined view.
- [x] Bank Accounts — `apps.accounting.BankAccount`, a thin wrapper (`name`, `bank_name`, `account_number`, `is_active`) around a GL `Account` (`on_delete=PROTECT`), with `balance_cents` computed live the same way as Petty Cash's. Known, documented limitation: `Payment` always posts through the single `Account.Role.CASH` account regardless of which `BankAccount` a user might mentally associate a receipt with, so a second bank account only actually changes via manual Journal Entries against its own GL account — this module is deliberately just the reconciliation/record-keeping layer, not a rework of how Payment posts.
- [x] Bank Reconciliation — `apps.accounting.BankStatementLine` (`bank_account` FK, `date`, `description`, `amount_cents` signed positive=deposit/negative=withdrawal, `is_reconciled` boolean). Deliberately manual — no CSV/OFX import and no auto-matching, avoiding a new parsing dependency for a Phase-3-scope feature — a user re-types each statement line and ticks it off against the GL as they confirm it, the same "correct over automated" tradeoff `docs/ARCHITECTURE.md` §6 sets for this phase. The new page (`/dashboard/accounting/banking`) surfaces reconciled vs. unreconciled totals alongside the account's real GL balance so the gap between "what the bank statement shows" and "what's ticked off" is always visible. Verified end-to-end via Playwright: created a bank account against the Cash GL account, added a statement line, toggled `is_reconciled` via the API and confirmed it round-trips.
- [x] Tax Management — see Section A's Tax Configuration entry (`apps.tax.TaxRate`)
- [x] Budgets — `apps.accounting.Budget` (`account` FK, free-text `period_label`, `amount_cents`; unique per `(company, account, period_label)`) plus `apps.accounting.reports.BudgetVsActualView`, a new report alongside Trial Balance/P&L/Balance Sheet/Cash Flow that pairs each budget with its account's real activity (credit-debit for Revenue, debit-credit for Expense/other) and returns the variance. Shares the exact same "no date-range filtering" limitation every other report here documents — `period_label` is free text a user chooses to match their own Financial Period labels, not something the query filters by, since there's nothing to filter *by* yet; right after closing a period, "actual" means "since that close," the same reasoning `unclosed_net_income_cents` (below) relies on. Verified end-to-end via Playwright: created a budget against a real account, confirmed the vs-actual report returned the correct `variance_cents = actual - budget`.
- [x] Financial Periods — `apps.accounting.FinancialPeriod` (`label`, `start_date`, `end_date`, `status` open/closed, `closed_at`, `closed_by`, a `net_income_cents` snapshot; unique per `(company, start_date, end_date)`). Key design decision: `JournalEntry` has no transaction-date field (only an auto `created_at`) and nothing in CoreERP supports backdating a posting, so "close as of now" and "close as of a declared `end_date`" are equivalent in practice — this is what let Period Closing ship without first adding date-range filtering to the reports, a prerequisite this doc previously (see Cash Flow's own entry) flagged as blocking.
- [x] Period Closing — `FinancialPeriodViewSet.close` (a `@action` on Financial Periods) calls `apps.accounting.posting.post_period_close_journal`: zeroes every Revenue and Expense account's current balance into Retained Earnings (`Account.Role.RETAINED_EARNINGS`, a new well-known account seeded via a data migration for every existing company) in one balanced `JournalEntry` referenced `CLOSE-<period id>`, skipping the whole entry if there's genuinely nothing to close. Periods must close in order — closing rejects if an earlier period for the company is still open — and a closed period can't be reopened, matching the append-only-ledger philosophy everywhere else in `apps.accounting`. This resolves the exact gap the Balance Sheet report used to document: `equity` now includes a real Retained Earnings line once at least one period has been closed, and the report's remaining `unclosed_net_income_cents` field (renamed from `retained_earnings_current_period_cents`) is honestly just "net income earned since the last close" rather than the whole company history. Verified end-to-end via Playwright: created and closed a period, confirmed a second close attempt is rejected 400 ("already closed"), confirmed the Balance Sheet's equity lines picked up the real Retained Earnings figure and `unclosed_net_income_cents` reset to 0 immediately after.
- [x] Fixed Assets — `apps.accounting.FixedAsset` (`name`, `category`, `purchase_date`, `cost_cents`, `salvage_value_cents`, `useful_life_months`, `accumulated_depreciation_cents`, `last_depreciated_on`, `status` active/disposed), with `@property book_value_cents` and `@property monthly_depreciation_cents` computed straight-line as `(cost - salvage) / useful_life_months`. No configurable depreciation schedules or asset disposal accounting (no gain/loss-on-disposal journal entry yet) — `status=disposed` exists as a field but nothing currently transitions an asset into it.
- [x] Asset Depreciation — `FixedAssetViewSet.depreciate` (a `@action`) calls `apps.accounting.posting.post_depreciation_journal`: Dr Depreciation Expense / Cr Accumulated Depreciation (two more new well-known account roles, seeded the same way as Retained Earnings), capped so accumulated depreciation never exceeds cost minus salvage. Guarded against double-running the same asset in the same calendar month via `last_depreciated_on`, and rejects once an asset is fully depreciated. Verified end-to-end via Playwright: created an asset (cost 1,200,000 / 0 salvage / 12 months), confirmed `monthly_depreciation_cents` computed as exactly 100,000, ran depreciation once and confirmed `accumulated_depreciation_cents`/`book_value_cents` updated correctly, then confirmed a second run in the same month is rejected 400.
- [x] Profit & Loss — `apps.accounting.reports`
- [x] Balance Sheet — `apps.accounting.reports`
- [x] Cash Flow — `apps.accounting.reports.CashFlowView`, the second Section B item (after Expenses), chosen deliberately over the also-real Financial Periods/Period Closing gap: closing the books properly would also require adding date-range filtering to the existing all-time-only reports (explicitly out of scope per `reports.py`'s own docstring), so it's a bigger, riskier two-part change to get right on a ledger feature — Cash Flow is purely additive instead, the same live-computed-report pattern as Trial Balance/P&L/Balance Sheet, no new models, no risk to existing data. Direct method, sourced from the Cash-role account's own `JournalLine`s as the total (not just `Payment` records), so nothing is missed if cash ever moves through a manual Journal Entry rather than through Payment — the Payment-derived categories (received from customers / paid to suppliers / paid to employees) are a human-readable breakdown of that same total, with any gap between them and the true total surfaced honestly as `other_cash_movements_cents` rather than silently dropped. Deliberately Operating-activities-only, not the conventional three-section statement — even now that Fixed Assets (below) exists, a purchase's `cost_cents` is just recorded on the asset, not necessarily paid for through a `Payment`, and CoreERP still generates no Financing movement (no loans, no equity contributions), so a real asset purchase paid via a manual Journal Entry debiting Cash shows up honestly in `other_cash_movements_cents` rather than a permanently-empty Investing section. Verified end-to-end via Playwright: recorded a real customer payment (12345 cents) and a real supplier payment (6789 cents), confirmed the report's category totals moved by exactly those amounts and net change moved by exactly their difference (5556 cents); confirmed the Accounting page's UI renders the updated figures and the scope-limitation note; and confirmed a non-accounting role gets 403, same guard as the other three reports. Incidentally caught a real piece of leftover test data from an earlier session (an orphaned Payment journal entry with no matching Payment row) via `other_cash_movements_cents` correctly flagging it as unaccounted-for cash movement — a live demonstration of why reconciling against the ledger's own JournalLines, not just Payment records, was the right call.
- [x] Trial Balance — `apps.accounting.reports`
- [x] Financial Reporting — the three reports above, all computed live from journal lines

## C. Sales & CRM

- [x] CRM — `apps.crm` now covers the full front-of-pipeline: Leads → convert → Customer + Opportunity, plus per-Customer Contacts. See the Leads/Opportunities/Contacts entries below for the detailed design.
- [x] Leads — `apps.crm.Lead` (`name`, `company_name`, `email`, `phone`, `source`, `status` new/contacted/qualified/disqualified/converted, `notes`, `assigned_to`). Deliberately not a Customer subtype or an Opportunity with no customer attached — a Lead might not convert at all, and letting an unqualified prospect show up everywhere a real Customer does (invoicing, sales orders) would be wrong. `LeadViewSet.convert` (a `@action`) is the one bridge: creates a real `Customer` (type `business` if `company_name` was given, else `individual`) and a Prospecting-stage `Opportunity` linked back to the lead, in one atomic transaction; a lead can only convert once. Caught and avoided a repeat of the exact `PettyCashTransactionViewSet` audit-log bug from Section B while writing this: `convert` creates two new rows via `Customer.objects.create()`/`Opportunity.objects.create()` directly rather than through `perform_create`, which would silently skip the Audit Log write — added explicit `log_audit()` calls for both, verified by checking the Audit Log actually shows both new rows after a real convert. `assigned_to` reuses the existing `/api/companies/members/` picker (a second consumer, after Tasks) and the same "must be an active member of the active company" validator pattern as `apps.tasks.TaskSerializer`. Registered in `ALLOWED_TARGETS`/`SEARCH_TARGETS` (Notes/Documents/Activity/Search all work on a Lead). Verified end-to-end via Playwright: created a lead, converted it, confirmed the resulting Customer and Opportunity have the right fields and the right link back to the lead, confirmed a second convert attempt is rejected 400, and confirmed both new rows appear in the Audit Log.
- [x] Opportunities — `apps.crm.Opportunity` (`customer` FK, optional `lead` FK, `name`, `stage` prospecting/qualification/proposal/negotiation/won/lost, `amount_cents`, `expected_close_date`, `notes`, `assigned_to`). Flat pipeline, not a configurable/branching one — no per-company custom stages yet, the same "wait for a real trigger before adding configurability nobody's asked for" call this project makes elsewhere. Also registered in `ALLOWED_TARGETS`/`SEARCH_TARGETS`. Verified end-to-end via Playwright: created an opportunity directly against a customer, updated its stage, confirmed it's findable via Global Search by name.
- [x] Customers — `apps.crm.Customer`
- [x] Contacts — `apps.crm.Contact` (`customer` FK `CASCADE`, `name`, `title`, `email`, `phone`, `is_primary`), closing the "Customer alone only has one phone/email" gap. Deliberately just a flat list per customer — no contact-level permissions or its own login, that's Customer Portal territory, a different and much bigger not-yet-triggered item. Verified end-to-end via Playwright: added a contact to a customer, confirmed the `?customer=` filter on list returns only that customer's contacts.
- [x] Sales Pipeline — Leads + Opportunities together are the pipeline; see both entries above.
- [ ] Activities — not built (see Tasks/Calendar; now that Lead/Opportunity are on the `ALLOWED_TARGETS` whitelist, Notes/Documents/Activity Timeline already attach to them, which covers most of what "Activities" would otherwise mean)
- [x] Quotations — `apps.sales.Quotation`
- [x] Sales Orders — `apps.sales.SalesOrder`
- [x] Invoices — `apps.sales.Invoice`
- [ ] Sales Returns — not built. Deliberately deferred, not skipped by oversight: `apps.sales` has no path today where issuing an Invoice or SalesOrder moves Inventory stock, so a return that restocks goods has no existing mechanism to hook into — building it now would mean first inventing "when/how does Sales debit Stock" as a side effect, a much bigger prerequisite than this one item. Credit Notes (below) covers the financial half of a return without needing that answered.
- [x] Credit Notes — `apps.sales.CreditNote` (`invoice` FK `PROTECT`, `credit_note_number`, `amount_cents`, `tax_amount_cents`, `reason`). Financial-only — reduces an Invoice's receivable/revenue without restocking anything (see Sales Returns above for why). Same two-step create-then-number pattern as Invoice/Bill (`apps.common.numbering`, a fourth real consumer after Invoice/Bill/Payment's `receipt_number`), posted by `apps.accounting.posting.post_credit_note_journal` — the exact reverse of `post_invoice_journal`'s entry (Dr Sales Revenue, Dr Tax Payable if any, Cr Accounts Receivable), wired through `apps.accounting.signals` with the identical idempotency pattern Invoice/Bill already use. Validated server-side against the invoice's real remaining balance (already-issued credit notes included), not just its original amount, so a credit note can't over-credit an invoice. `Invoice.Status.PAID` is reused for "nothing more owed, however that happened" — a Payment and a Credit Note both count toward the same settled-total check now (`_maybe_mark_invoice_paid`, shared by both signal handlers) rather than adding a separate "credited"/"written off" status; documented as a known simplification, not an oversight. Registered in `ALLOWED_TARGETS`/`SEARCH_TARGETS`. Verified end-to-end via Playwright: a credit note requesting more than the invoice's remaining balance is rejected 400 with the exact remaining amount; a partial credit note leaves the invoice not-yet-paid; a second credit note that exactly covers the rest flips the invoice to `paid`; the reversing journal entry is findable by its `CRN-` number via Global Search.
- [x] Discounts — `discount_percent` (0–100, both a model `MaxValueValidator` and a DB `CheckConstraint`) added to `QuotationLine` and `SalesOrderLine`, closing the "unit price is freely editable, no formal discount field" gap with an actual auditable field instead. A flat per-line percentage, not a flat-cents-per-line or whole-document discount — the simplest shape that still gives every line its own discount and survives a partial reorder. `line_total_cents` (both models) now computes `quantity × unit_price_cents × (100 − discount_percent) / 100`, and `Quotation.total_cents`/`SalesOrder.total_cents` were changed to sum `line_total_cents` instead of re-deriving the gross total, so Invoice's `sales_order.total_cents` snapshot picks up discounts automatically with no invoice-side change needed. `LineItemsEditor` (shared with Purchase Orders) grew an optional `showDiscount` prop rather than forcing a discount input onto Purchase Order lines, which have no such field. Verified end-to-end via Playwright: a 10-unit line at 1000 cents/unit with a 20% discount produced `line_total_cents`/`total_cents` of exactly 8000, not 10000.
- [ ] *(partial)* Pricing — Item has one flat price; no tiered or customer-specific pricing
- [ ] Price Lists — not built
- [ ] Sales Targets — not built
- [ ] Sales Commissions — not built
- [ ] Promotions — not built
- [ ] Customer Loyalty — not built in CoreERP. MiranErp has one (good bones — Customer-extension pattern, append-only points ledger) but its transaction model hard-links to Hotel's Reservation; needs generalizing before it's portable
- [ ] Customer Portal — not built (no external customer-facing login)

## D. Procurement

- [x] Procurement — `apps.procurement`
- [x] Purchase Requests — `apps.procurement.PurchaseRequest` (no supplier yet — just what's needed, `estimated_unit_cost_cents` per line, and why). Goes through `apps.approvals` the identical way `PurchaseOrder` does — a third real consumer of that registry, after PurchaseOrder and Expense, each one further confirming the abstraction generalizes rather than being procurement-specific machinery in disguise. `PurchaseRequestViewSet.convert` is the one bridge from an approved request into a real Draft `PurchaseOrder` against a chosen supplier — the same "convert" shape `apps.crm.Lead` uses for prospect → Customer — and can only run once (checked via `status != APPROVED`, mirroring `Lead.convert`'s guard). That `convert` action creates a new `PurchaseOrder` via `.objects.create()` rather than `perform_create`, so it calls `log_audit()` explicitly for the new order — the same `PettyCashTransactionViewSet` gap from Section B, avoided here rather than repeated. Verified end-to-end via Playwright: created a request, confirmed converting it before approval is rejected 400, requested approval, confirmed the requester can't self-approve (403, the same segregation-of-duties enforcement Purchase Orders and Expenses already have), a second user approved it, converted it into a real draft PO with the right lines and cost, and confirmed converting the same request again is rejected 400.
- [ ] Request for Quotation — not built
- [ ] Supplier Quotations — not built
- [x] Purchase Orders — `apps.procurement.PurchaseOrder`
- [x] Goods Receipt — `PurchaseOrderLine.received_quantity` (cumulative, so partial deliveries are supported) plus `PurchaseOrderViewSet.receive`, closing the gap the model's own dead `RECEIVED` status value had been sitting on since before `apps.approvals` existed — the same shape `PurchaseOrder.Status.APPROVED` was in before that got wired up. `receive` only runs against an `APPROVED` order, and creates real `StockMovement(type=in)` rows through `apps.inventory`'s own `StockMovementSerializer` (called directly, not duplicated) so a receipt is indistinguishable from any other stock-in movement — same `Stock` quantities, same low-stock notification path. Since that serializer is invoked directly rather than through `StockMovementViewSet.perform_create`, each movement gets an explicit `log_audit()` call too, the identical bypass this section's Purchase Requests entry (and Section B's Petty Cash fix) already had to guard against. The order flips to `RECEIVED` automatically once every line's `outstanding_quantity` reaches zero. Verified end-to-end via Playwright: receiving before the order is approved is rejected 400; a partial receipt (2 of 5) leaves the order `approved`, not `received`; over-receiving past what's outstanding is rejected 400 with the exact remaining count; the final receipt (the remaining 3) flips the order to `received`; the real `Stock` quantity and two `StockMovement` rows (referencing `PO-<id> receipt`) were confirmed directly, both audit-logged.
- [x] Supplier Bills — `apps.procurement.Bill`
- [ ] Purchase Returns — not built. A financial-only mirror of `sales.CreditNote` (a "Debit Note" against a Bill) would be just as buildable as Credit Notes was, and now that Goods Receipt exists there's also a real path to reversing the physical stock — but building either half well didn't fit in this pass alongside Purchase Requests and Goods Receipt; left for a following one rather than done half-complete.
- [x] Supplier Payments — `apps.accounting.Payment` against a Bill
- [ ] Supplier Evaluation — not built
- [ ] Contract Management — not built
- [x] Procurement Approvals — this line was stale, not actually missing: `apps.procurement.PurchaseOrder` has gone through `apps.approvals` since the Workflow Engine (Section A) was built, `PurchaseOrder.Status.SUBMITTED/APPROVED/REJECTED` are set only by that flow (`apps/procurement/apps.py`'s `ready()` hook registration), and `PurchaseOrderSerializer.validate_status` blocks a client from setting them directly. Purchase Requests (above) now goes through the identical flow.

## E. Inventory & Warehouse

- [x] Inventory — `apps.inventory`
- [x] Warehouses — `apps.inventory.Warehouse` (now with optional Branch)
- [ ] Storage Locations — not built (sub-warehouse bins/aisles)
- [x] Stock Levels — `apps.inventory.Stock`
- [x] Stock Movements — `apps.inventory.StockMovement`
- [x] Stock Transfers — `StockMovement(type=transfer)`
- [x] Stock Adjustments — `StockMovement(type=adjustment)`
- [ ] Stock Counts — not built (physical count / reconciliation workflow)
- [ ] Batch Management — not built
- [ ] Serial Number Management — not built
- [ ] Barcode Management — not built
- [ ] Expiration Management — not built
- [ ] *(partial)* Reorder Levels — `Stock.minimum_stock` exists and the dashboard shows a low-stock alert count; no automatic reorder/PO-suggestion action
- [ ] Inventory Valuation — not built (FIFO/weighted-average costing)
- [ ] Inventory Forecasting — not built
- [ ] *(partial)* Goods Receiving — same as D
- [ ] *(partial)* Goods Dispatch — `StockMovement(type=out)` covers it generically; no formal dispatch/picking document
- [ ] Warehouse Picking — not built
- [ ] Warehouse Packing — not built
- [ ] *(partial)* Warehouse Operations — loosely covered by the above; no dedicated ops workflow

## F. HR & Payroll

- [x] Human Resources — `apps.hr` baseline
- [x] Employee Records — `apps.hr.Employee`
- [x] Departments — `apps.hr.Department`
- [ ] *(partial)* Positions — `Employee.position` is free text; no separate Position/JobTitle entity
- [ ] Recruitment — not built
- [ ] Job Vacancies — not built
- [ ] Applicants — not built
- [ ] Onboarding — not built
- [ ] Employee Contracts — not built
- [ ] Attendance — not built
- [ ] Biometric Attendance — not built
- [ ] Leave Management — not built (Time Off — real gap, flagged earlier)
- [ ] Shift Management — not built
- [ ] Payroll — not built
- [ ] *(partial)* Salary Structures — `Employee.salary_cents` is one flat field; no structured components
- [ ] Allowances — not built
- [ ] Deductions — not built
- [ ] Overtime — not built
- [ ] Loans / Employee Advances — not built (seen in real-world reference screenshots as a real, common need)
- [ ] Performance Management — not built
- [ ] Training — not built
- [ ] Employee Documents — not built (depends on Document Management, A)
- [ ] Employee Self-Service — not built

## G. Asset & Maintenance

- [ ] Asset Management — not built
- [ ] Asset Register — not built
- [ ] Asset Allocation — not built
- [ ] Asset Transfer — not built
- [ ] Asset Disposal — not built
- [ ] Depreciation — not built (same item as B)
- [ ] Maintenance — not built in Core (MiranErp has a hotel-flavored one)
- [ ] Preventive Maintenance — not built
- [ ] Corrective Maintenance — not built
- [ ] Maintenance Requests — not built
- [ ] Work Orders — not built
- [ ] Equipment Management — not built
- [ ] Service History — not built
- [ ] Spare Parts — not built

## H. Project Management

- [ ] Projects — not built
- [ ] Project Planning — not built
- [x] Tasks — same `apps.tasks` module as A
- [ ] Milestones — not built
- [ ] Project Teams — not built
- [ ] Time Tracking — not built
- [ ] Project Expenses — not built
- [ ] Project Budget — not built
- [ ] Project Costing — not built
- [ ] Project Billing — not built
- [ ] Project Profitability — not built
- [ ] Project Documents — not built

Note: this whole section is genuinely Core-adjacent, not industry — it's the backbone of the "Professional Services" archetype (Law, Consulting, IT, Agencies) and useful to Construction/Real Estate too. Worth prioritizing over the industry sections below when the time comes.

## I. Manufacturing

- [ ] Manufacturing
- [ ] Bill of Materials (BOM)
- [ ] Production Orders
- [ ] Production Planning
- [ ] Material Requirements Planning (MRP)
- [ ] Work Orders
- [ ] Work Centers
- [ ] Production Scheduling
- [ ] Raw Materials
- [ ] Finished Goods
- [ ] Work in Progress
- [ ] Quality Control
- [ ] Production Costing
- [ ] Machine Management
- [ ] Manufacturing Maintenance
- [ ] Waste / Scrap Management

## J. Hotel & Hospitality

Built separately in [AEdward/MiranErp](https://github.com/AEdward/MiranErp) as the first vertical proof-of-concept — not part of CoreERP core, not merged back.

- [ ] Hotel Management
- [ ] Property Management System (PMS)
- [ ] Room Management
- [ ] Room Types
- [ ] Reservations
- [ ] Check-in / Check-out
- [ ] Guest Management
- [ ] Housekeeping
- [ ] Room Service
- [ ] Hotel Folios
- [ ] Rate Management
- [ ] Packages
- [ ] Hotel POS
- [ ] Restaurant
- [ ] Bar
- [ ] Banquet / Events
- [ ] Spa Management
- [ ] Guest Loyalty
- [ ] Channel Manager
- [ ] OTA Integration
- [ ] Online Booking
- [ ] Guest Feedback

## K. Real Estate

Real-world feature reference already gathered (see chat: OVID Real Estate's actual module list — Payment Plans, Collection Committee, Loan Management, Construction, Portfolio Management were the standout real needs beyond "leases, units").

- [ ] Real Estate Management
- [ ] Property Management
- [ ] Property Projects
- [ ] Buildings
- [ ] Units
- [ ] Unit Types
- [ ] Property Listings
- [ ] Property Sales
- [ ] Property Rentals
- [ ] Leasing
- [ ] Tenants
- [ ] Lease Contracts
- [ ] Rent Collection
- [ ] Installment Management
- [ ] Real Estate CRM
- [ ] Sales Agents
- [ ] Agent Commissions
- [ ] Property Maintenance
- [ ] Property Expenses
- [ ] Property Documents

## L. Retail

- [ ] Retail Management
- [ ] Point of Sale (POS) — MiranErp has a POS app, but it's restaurant/bar-flavored (tables, kitchen display, happy hour), not a retail-checkout shape
- [ ] Barcode POS
- [ ] Cashier Management
- [ ] Registers
- [ ] Shifts
- [ ] Product Variants
- [ ] Promotions
- [ ] Discounts
- [ ] Loyalty Program
- [ ] Gift Cards
- [ ] Returns
- [ ] Multi-store Management
- [ ] Omnichannel Commerce
- [ ] E-commerce Integration

## M. Healthcare

- [ ] Healthcare Management
- [ ] Patient Management
- [ ] Appointments
- [ ] Doctor Management
- [ ] Nurse Management
- [ ] Electronic Medical Records
- [ ] Medical History
- [ ] Pharmacy
- [ ] Prescriptions
- [ ] Laboratory
- [ ] Radiology
- [ ] Billing
- [ ] Insurance
- [ ] Inpatient Management
- [ ] Outpatient Management
- [ ] Emergency Management
- [ ] Operating Room
- [ ] Blood Bank
- [ ] Medical Inventory

## N. Construction

- [ ] Construction Management
- [ ] Projects
- [ ] Project Budgeting
- [ ] BOQ
- [ ] Cost Estimation
- [ ] Contracts
- [ ] Subcontractors
- [ ] Site Management
- [ ] Materials
- [ ] Equipment
- [ ] Labor
- [ ] Work Progress
- [ ] Site Expenses
- [ ] Construction Procurement
- [ ] Project Costing
- [ ] Change Orders
- [ ] Quality Control
- [ ] Safety Management

## O. Logistics & Transportation

- [ ] Logistics Management
- [ ] Fleet Management — seen in real-world reference screenshots (both "Ammars" and general Odoo deployments)
- [ ] Vehicle Management
- [ ] Driver Management
- [ ] Trip Management
- [ ] Dispatch
- [ ] Route Planning
- [ ] Shipment Management
- [ ] Delivery Management
- [ ] Tracking
- [ ] Fuel Management — seen in real-world reference screenshots ("Ammars" — Fuel Tracking)
- [ ] Vehicle Maintenance
- [ ] Transportation Billing
- [ ] Proof of Delivery

## P. Agriculture

- [ ] Farm Management
- [ ] Field Management
- [ ] Crop Management
- [ ] Planting
- [ ] Harvest Management
- [ ] Livestock Management
- [ ] Feed Management
- [ ] Fertilizer Management
- [ ] Pesticide Management
- [ ] Farm Equipment
- [ ] Agricultural Inventory
- [ ] Agricultural Procurement
- [ ] Agricultural Sales
- [ ] Weather / Farm Data
- [ ] Production Costing

## Q. Food & Beverage

- [ ] Restaurant Management
- [ ] Restaurant POS — MiranErp's `pos` app partially covers this (tables, kitchen display, happy hour) — built for Hotel's in-house restaurant, not standalone
- [ ] Table Management — same as above
- [ ] Reservations
- [ ] Kitchen Management — same as above
- [ ] Kitchen Display System — same as above
- [ ] Recipes
- [ ] Ingredient Management
- [ ] Food Costing
- [ ] Menu Management
- [ ] Delivery Management
- [ ] Waiter Management
- [ ] Tips
- [ ] Food Waste Management

## R. Education

- [ ] Education Management
- [ ] Student Management
- [ ] Admissions
- [ ] Enrollment
- [ ] Class Management
- [ ] Teachers
- [ ] Courses
- [ ] Subjects
- [ ] Timetable
- [ ] Attendance
- [ ] Examinations
- [ ] Grades
- [ ] Fees
- [ ] Student Payments
- [ ] Library
- [ ] Hostel
- [ ] Transportation
- [ ] Parent Portal
- [ ] Student Portal

## S. Media & Agencies

- [ ] Agency Management
- [ ] Client Management
- [ ] Campaign Management
- [ ] Projects
- [ ] Creative Production
- [ ] Content Calendar
- [ ] Media Planning
- [ ] Time Tracking
- [ ] Client Billing
- [ ] Budget Management
- [ ] Contract Management
- [ ] Commission Management

## T. Mining

- [ ] Mining Management
- [ ] Mining Sites
- [ ] Exploration
- [ ] Production
- [ ] Equipment
- [ ] Fleet
- [ ] Safety
- [ ] Environmental Management
- [ ] Material Tracking
- [ ] Mining Inventory
- [ ] Production Costing

## U. Travel & Tourism

- [ ] Travel Management
- [ ] Tour Packages
- [ ] Bookings
- [ ] Customers
- [ ] Tour Guides
- [ ] Transportation
- [ ] Hotels
- [ ] Itinerary Management
- [ ] Travel Documents
- [ ] Supplier Management
- [ ] Tour Payments
- [ ] Commission Management

## V. Jewelry

- [ ] Jewelry Management
- [ ] Product Catalog
- [ ] Product Variants
- [ ] Gold/Silver Weight Tracking
- [ ] Purity Management
- [ ] Stone Management
- [ ] POS
- [ ] Custom Orders
- [ ] Repair Management
- [ ] Valuation
- [ ] Inventory
- [ ] Customer Management

## W. Security Services

- [ ] Security Company Management
- [ ] Guard Management
- [ ] Site Management
- [ ] Shift Scheduling
- [ ] Attendance
- [ ] Patrol Management
- [ ] Incident Management
- [ ] Client Contracts
- [ ] Payroll
- [ ] Equipment

## X. Service Companies

- [ ] Service Management
- [ ] Service Requests
- [ ] Work Orders
- [ ] Technicians
- [ ] Scheduling
- [ ] Dispatch
- [ ] Service Contracts
- [ ] Recurring Billing
- [ ] Customer Portal
- [ ] Field Service
- [ ] Service Reports

## Y. E-commerce

- [ ] E-commerce
- [ ] Online Store
- [ ] Product Catalog
- [ ] Shopping Cart
- [ ] Orders
- [ ] Payments
- [ ] Shipping
- [ ] Returns
- [ ] Customer Accounts
- [ ] Coupons
- [ ] Promotions
- [ ] Reviews
- [ ] Marketplace Management

---

## Reading this list

Sections A–H are Core/Business/Finance/People — genuinely shared by nearly every future industry module, and the honest gaps there (Tasks/Calendar/Search/Workflow, Expenses, Fixed Assets, CRM pipeline, Leave Management, Project Management as a whole) are worth closing *before* they're independently rebuilt inside three different industry modules. Sections I onward are Phase 4 territory, unscheduled by design — see `TODO.md`'s "Phase 4 — Industry Modules" and "Prove the extension pattern" for how those get picked up (driven by real demand, one thin vertical slice at a time, same principle applied throughout this build).
