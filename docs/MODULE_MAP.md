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
- [ ] Global Search — not built
- [ ] Audit Logs — not built in CoreERP. MiranErp has a clean, portable one (`apps.auditlog`, hooked into `CompanyScopedMixin`) — reviewed, not yet merged
- [ ] Workflow / Approval Engine — backlog (Phase 3.5), not built
- [x] Settings — `/dashboard/settings`: company profile + branches
- [ ] Localization — not built (Company has `country`/`timezone` fields, nothing acts on them)
- [ ] Multi-language — not built
- [ ] *(partial)* Multi-currency — Company has one `currency` field; no multi-currency transactions/conversion (deliberately deferred earlier as "Currency Engine")
- [ ] Tax Configuration — not built in CoreERP. `Item.tax_rate` exists but is decorative — nothing computes from it. MiranErp has a real, well-designed `TaxRate` + engine, reviewed, not yet merged
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
- [ ] *(partial)* Receipts — a Payment record exists; no separate printable Receipt document
- [ ] Expenses — not built (employee expense claims — real gap, flagged earlier)
- [ ] Petty Cash — not built
- [ ] *(partial)* Cash Management — Cash is just an Account in the COA; no dedicated register/position view
- [ ] *(partial)* Bank Accounts — same as Cash — an Account, not a dedicated entity
- [ ] Bank Reconciliation — not built
- [ ] Tax Management — not built in CoreERP (see A — MiranErp has it)
- [ ] Budgets — not built
- [ ] Financial Periods — not built (no period-close concept)
- [ ] Period Closing — not built — the Balance Sheet report already documents this exact gap (net income shown as a period line, not folded into Retained Earnings)
- [ ] Fixed Assets — not built
- [ ] Asset Depreciation — not built
- [x] Profit & Loss — `apps.accounting.reports`
- [x] Balance Sheet — `apps.accounting.reports`
- [ ] Cash Flow — not built (no Cash Flow statement; only P&L/Balance Sheet/Trial Balance exist)
- [x] Trial Balance — `apps.accounting.reports`
- [x] Financial Reporting — the three reports above, all computed live from journal lines

## C. Sales & CRM

- [ ] *(partial)* CRM — just `Customer` records today, no pipeline
- [ ] Leads — not built
- [ ] Opportunities — not built
- [x] Customers — `apps.crm.Customer`
- [ ] *(partial)* Contacts — Customer has contact fields, no separate multi-contact-per-customer model
- [ ] Sales Pipeline — not built
- [ ] Activities — not built (see Tasks/Calendar)
- [x] Quotations — `apps.sales.Quotation`
- [x] Sales Orders — `apps.sales.SalesOrder`
- [x] Invoices — `apps.sales.Invoice`
- [ ] Sales Returns — not built
- [ ] Credit Notes — not built
- [ ] *(partial)* Discounts — line unit price is freely editable; no formal discount field/audit trail
- [ ] *(partial)* Pricing — Item has one flat price; no tiered or customer-specific pricing
- [ ] Price Lists — not built
- [ ] Sales Targets — not built
- [ ] Sales Commissions — not built
- [ ] Promotions — not built
- [ ] Customer Loyalty — not built in CoreERP. MiranErp has one (good bones — Customer-extension pattern, append-only points ledger) but its transaction model hard-links to Hotel's Reservation; needs generalizing before it's portable
- [ ] Customer Portal — not built (no external customer-facing login)

## D. Procurement

- [x] Procurement — `apps.procurement`
- [ ] Purchase Requests — not built (internal request-to-purchase, before a PO exists)
- [ ] Request for Quotation — not built
- [ ] Supplier Quotations — not built
- [x] Purchase Orders — `apps.procurement.PurchaseOrder`
- [ ] *(partial)* Goods Receipt — `StockMovement(type=in)` covers the physical receipt; not formally tied to a PO's receiving step
- [x] Supplier Bills — `apps.procurement.Bill`
- [ ] Purchase Returns — not built
- [x] Supplier Payments — `apps.accounting.Payment` against a Bill
- [ ] Supplier Evaluation — not built
- [ ] Contract Management — not built
- [ ] Procurement Approvals — not built (depends on Workflow Engine, A)

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
