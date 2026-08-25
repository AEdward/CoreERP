# CoreERP — Frontend Design Reference

*How Odoo structures its frontend, what CoreERP already does that rhymes with it, and a concrete adoption path — written as a reference to build against, not a rewrite mandate. The app launcher landing screen (§3) and the module chrome (§2, §4 — left sidebar nav + shared CSS system) have since shipped off the back of this doc; §5-9 and §11 are still reference-only — each ends with what changing it would actually take.*

---

## 1. Why this doc exists

CoreERP's frontend today is functional but flat: every module page (`/dashboard/hr`, `/dashboard/sales`, `/dashboard/procurement`, ...) is a standalone Next.js page with its own hand-written `<table>`, its own inline `style={{...}}` props, its own copy-pasted add/edit form. That's been the right call while the product surface was growing fast — Sections A through F all shipped this way — but it doesn't scale visually: ~15 pages now each reinvent the same table, the same form-in-a-grid, the same edit/delete buttons, with no shared visual language and no way to add a new module's UI without writing a new page from scratch.

Odoo — a 20-year-old ERP with hundreds of business apps — solved exactly this problem, and its solution is worth borrowing the *shape* of, not the code. This doc extracts that shape (researched directly against `odoo/odoo` branch `19.0`, file paths cited throughout) and maps each piece onto what CoreERP should build in React/Next.js.

Two requirements came from the user directly, informed by first-hand screenshots of Odoo, and are the concrete near-term target this doc is scoped around:

1. **The app grid only shows apps a user has access to.** An Owner sees every module tile; someone with a narrower role sees only the ones their role's permissions cover. *(Already implemented — see §9.)*
2. **Clicking into a module opens that module's own dashboard, not a flat list.** Odoo's Accounting app lands on a kanban-card "Accounting Dashboard" (Customer Invoices, Vendor Bills, Bank, Cash, ...); its Time Off app has its own top sub-nav (*Time Off · My Time · Overview · Management · Reporting · Configuration*) before you ever see a record list.

---

## 2. App shell layout

Odoo 19 is flatter than older versions expect: there's no persistent left sidebar. The shell is three stacked pieces:

- `addons/web/static/src/webclient/webclient.js` / `.xml` — the root `WebClient`: `<NavBar/>`, then `<ActionContainer/>` (whatever the current view/action renders), then an overlay layer for dialogs and toasts.
- `addons/web/static/src/webclient/navbar/navbar.js` — the top bar: the app-switcher grid trigger on the left, the *current app's* section tabs in the middle, a right-aligned "systray" (a registry of slots — user menu, notifications, company switcher, debug menu).
- `addons/web/static/src/search/control_panel/control_panel.js` / `.xml` — a second bar rendered *per view*, under the navbar: breadcrumbs, create/action buttons, the list/kanban/calendar view-switcher icons, and the pager. This is not part of the navbar — every view type renders its own.

**Status: shipped, in CoreERP's own shape rather than Odoo's.** The single-top-row `AppHeader.tsx` (company switcher, global search, notification bell, a flat row of links to every module) is gone — deleted, no longer imported anywhere. It's replaced by `ModuleShell.tsx`: a minimal top bar (brand → `/dashboard`, search, notifications, company badge, log out) plus a **left sidebar scoped to only the current module's own pages** (HR's sidebar shows Overview/Attendance/Leave & Contracts/Payroll; Accounting's shows Overview/Banking/Petty Cash/Budgets/Fixed Assets; and so on). This is a deliberate product decision, not an Odoo mirror: Odoo 19 itself dropped the persistent left sidebar (see the note above), but CoreERP's explicit requirement is the opposite — cross-module navigation happens *only* by going back to the launcher grid (§3) and picking a different tile; the sidebar never links outside its own module. `<PageHeader>` (breadcrumbs + title + primary action) as originally scoped here didn't ship separately — each page's own `shared.pageHeader`/`shared.pageTitle` block (§10) does that job inline instead.

---

## 3. The app launcher grid

Odoo's app grid (the screen you land on after login) only ever shows apps installed *and* accessible to you — there's no "greyed out, no access" tile — inside a full-bleed pastel gradient with a minimal top bar (no text-link nav row; that's a per-app concern once you're inside one).

**Status: done, on both counts.** `/dashboard/page.tsx` was rewritten as a dedicated launcher screen, separate from the module chrome every *other* page uses (`ModuleShell`, §2/§4 — originally `AppHeader`, since replaced):

- `MODULE_TILES` is filtered by `activeMembership.permissions.includes(tile.permission)` before rendering — a role without `inventory.view` simply never sees an Inventory tile. Owner already holds every permission in the seeded role set, so Owner continues to see everything without any special-casing. Verified with two real logins: Owner sees all 9 tiles, an HR Manager role sees only the 5 it holds permissions for.
- New `launcher.module.css` (a real CSS Module, not inline `style={{...}}` — the first place in the codebase using one) implements the visual shell: `--launcher-gradient` full-bleed background, a minimal top bar (brand mark, global search, notification bell, a compact company-switcher dropdown replacing the old "Your companies" card row, log out), and the icon-tile grid itself (`ModuleIcon` components, already Odoo-style flat geometric marks, unchanged).
- The company overview stat cards (revenue/expenses/profit/stock/employees) — which Odoo's launcher doesn't show at all, that's a per-app dashboard concern per §4 — moved to a collapsed-by-default "▸ Company overview" toggle below the grid, so the grid is the dominant first-viewport element like Odoo's, without dropping the KPI data entirely.
- `globals.css` gained the design-token layer §10 below describes (gray scale, brand color, spacing/radius/shadow scale) — `launcher.module.css` is the first consumer; every future page redesign should pull from the same tokens rather than inventing new hex values.
- A genuinely new state got surfaced by this rework, not previously handled explicitly: a fresh login with no active company selected yet now shows a proper "Welcome to CoreERP — pick a company from the switcher, or create a new one" onboarding screen instead of an empty/broken grid.

---

## 4. Per-module landing: a left sidebar, not a flat top-nav

CoreERP resolved this differently than the tab-strip approach originally sketched below (kept for context — it's what got superseded, not what shipped). In Odoo, opening an app never drops you straight into a record table: Accounting opens to a kanban-card dashboard, Time Off opens with its own sub-nav (*Time Off · My Time · Overview · Management · Reporting · Configuration*) that only exists inside that app.

**Status: shipped, as a left sidebar rather than a tab strip.** `ModuleShell.tsx` renders a left `<aside>` populated from a per-module nav config (`MODULE_NAV` in that file) — e.g. HR: *Overview · Attendance · Leave & Contracts · Payroll*; Accounting: *Overview · Banking · Petty Cash · Budgets · Fixed Assets*; Sales & CRM: *Sales & CRM · Leads & Opportunities* (the `sales` and `crm` routes share one module). Every page under a module renders inside `<ModuleShell moduleKey="...">`, so the sidebar is present and correctly scoped on every route — nothing links outside its own module, and the brand/home link in the top bar is the only way back to the launcher grid to switch modules. Single-page modules (Expenses, Tasks, Calendar, Procurement) still get a sidebar, just with one "Overview" entry, for visual consistency.

What this doc originally proposed instead (a `<ModuleLayout appKey="hr" tabs={[...]}>` top tab strip + per-module `<DashboardCard>` KPI tiles as a dedicated Overview screen) did not ship — each module's existing landing page (the Departments/Employees table for HR, the Chart of Accounts for Accounting, etc.) remains the entry point, now just wrapped in the sidebar shell rather than gaining a separate dashboard-card screen in front of it. That KPI-dashboard-per-module idea is still open if wanted later; it would slot in as the sidebar's "Overview" page content rather than requiring new navigation infrastructure, since the nav shell itself is now already scoped per module.

---

## 5. The view-type system (the actual leverage)

This is Odoo's real architectural trick, and the one worth adopting even partially: a **generic view engine** driven by metadata, not one hand-written component per business object.

- `addons/web/static/src/views/view.js` — the `View` component. It resolves a `jsClass` (defaults to the view type — "list", "form", "kanban", ...) against `registry.category("views")`, gets back a `{ Controller, Renderer, ArchParser, Model }` descriptor, and renders that. Adding a new business object's UI in Odoo means writing an XML "arch" (field list + widget hints), not a new React-equivalent component.
- Per view type, its own folder: `views/list/`, `views/form/`, `views/kanban/`, `views/graph/`, `views/pivot/`, `views/calendar/`, each with `*_controller.js` / `*_renderer.js` / `*_arch_parser.js`.
- `addons/web/static/src/core/registry.js` — the generic string-keyed `Registry` class this pattern (and services, systray items, field widgets) all reuse.

CoreERP is at the opposite end of this spectrum today: every page hand-writes its own `<table>` and its own `<form>`. That's been fine at ~15 pages; it will not be fine at 40.

**What adopting a version of this takes** (this is the multi-week piece, not a quick add):
- A `columns: ColumnDef[]` + `rows: T[]` driven `<ListView>` component (sortable headers, optional row selection, an "empty state" row) to replace the copy-pasted `<table><thead>...<tbody>{items.map(...)}</tbody></table>` block that's currently duplicated near-verbatim across every module page.
- A `fields: FieldDef[]` driven `<RecordForm>` for the add/edit forms (currently one hand-rolled `<form>` grid per page, e.g. the Employee form, the Purchase Order form).
- These don't need Odoo's full registry-of-registries depth to be worth it — even a single shared `<ListView>`/`<RecordForm>` pair, with each page supplying its column/field config instead of its own markup, removes most of the duplication and gives every page the same look for free.

---

## 6. Field widgets

Each primitive field type (text, many2one/relation, monetary, date, selection, boolean, statusbar) is its own small registered component in Odoo — `views/fields/many2one/`, `views/fields/monetary/`, `views/fields/statusbar/`, etc. — dispatched by a generic `<Field name type widget/>` component (`views/fields/field.js`) that looks up `registry.category("fields")`.

**Translation for CoreERP**: this only matters once §5's `<ListView>`/`<RecordForm>` exist — at that point, a `fieldRegistry: Record<string, Component>` (`TextField`, `SelectField`, `RelationField` — a dropdown backed by e.g. `api.listEmployeePicker()`, `MoneyField` formatting cents as currency) is what lets a single `<RecordForm fields={[...]}/>` render every module's form correctly instead of every page writing its own `<select>{items.map(...)}</select>` block, which is the single most-repeated pattern in the current codebase (Department pickers, Employee pickers, Item pickers, Warehouse pickers — all hand-written per page today).

---

## 7. List view conventions: the filter sidebar and grouping

The Time Off and Employees screenshots both show a **left-side filter panel** (Status: All/To Approve/Approved/Second Approval; Department: All/Management/...) plus **grouped rows** (a collapsible "Paid Time Off (4)" header above its rows, with an aggregated count). This is `addons/web/static/src/search/search_panel/search_panel.js` — a component distinct from the search-bar dropdowns, specifically for exactly this quick-filter-by-category use case — combined with the shared `search_model.js` (`addons/web/static/src/search/search_model.js`) that every list/kanban/calendar view of the same resource reads its active filter/group-by state from.

CoreERP has no equivalent today — filtering is either absent or done via a single `<select>` a page wires up itself (e.g. the Attendance page's `?employee=` query param). There's no shared "group these rows by X, show a collapsible header with a count" primitive anywhere in the codebase yet.

**What adopting this takes**: a `<FilterSidebar sections={[{label: "Status", options: [...]}]}/>` alongside `<ListView>`, and a `groupBy` prop on `<ListView>` itself that renders a collapsible header row per group with a count — both natural extensions of §5's `<ListView>`, not a separate system.

---

## 8. Form view conventions: statusbar, smart buttons, tabs, activity panel

This section is where CoreERP has already independently converged on something close to Odoo's shape, which is worth naming explicitly rather than treating as a gap:

- **Statusbar** (Odoo: `views/fields/statusbar/statusbar_field.js`, a clickable Draft→Confirmed→Done pill stepper in the form header) — CoreERP's closest equivalent is the plain-text `status` column/badge every module already has (Purchase Order's draft/approved/received, Sales Order's pending/processing/fulfilled, Leave Request's draft/submitted/approved/rejected). The data model is already there; what's missing is only the visual stepper treatment.
- **Smart buttons** (Odoo: `views/form/button_box/button_box.js`, a row of small "5 Invoices →" stat buttons in the form header linking to related records, auto-collapsing into a "More" dropdown on narrow screens) — CoreERP has no equivalent yet. The closest today is a plain text link (e.g. Sales page's "Leads, opportunities & contacts →").
- **Chatter / activity panel** — Odoo notably does *not* build this into its core form view; it's patched on by the separate `mail` module (`addons/mail/static/src/chatter/web/form_renderer.js` patches `FormRenderer`; a `<chatter/>` arch tag is what opts a form into it). **CoreERP already has this, independently, as four small composable panel components** — `DocumentsPanel`, `NotesPanel`, `ActivityPanel`, `ApprovalPanel` — each self-contained, each taking a generic `{appLabel, model, objectId}` target and mounted a la carte per row on whichever module pages need them (Employee rows get all four; Invoice rows get three; Journal Entry rows get two). This is the same "core stays generic, capability bolts on per-record-type" architecture Odoo's chatter uses, arrived at independently. Nothing to change here — just worth recognizing as already correct, and worth keeping in mind as the template for how any *new* per-record capability (e.g. a future "linked records" smart-button panel) should be built: a standalone component taking a generic target, not baked into any one page.
- **Notebook/tabs** (Odoo: `<notebook>`/`<page>` arch tags grouping secondary fields, e.g. "Other Info", "Invoicing") — no CoreERP equivalent yet; today every field on a form is always visible in one flat grid. Only worth adding once a form genuinely has enough fields to need hiding some by default (Employee's add form, with 9+ fields already in a `repeat(auto-fit, minmax(160px,1fr))` grid, is the nearest candidate).

---

## 9. Search, filters, and saved views

Odoo unifies free-text search, filter chips, group-by, and named "favorites" (saved searches) under one `SearchModel` shared by every view of a resource (`search/with_search/with_search.js` wraps every view in it). CoreERP's `GlobalSearch.tsx` is a global cross-module search box (closer to Odoo's separate omnibox), not a per-list-view filter system — those are two different, both-legitimate features, and CoreERP already has the first one. The per-list filter/group-by/saved-search piece is the same gap named in §7; no separate work beyond that.

---

## 10. Design tokens and styling approach

Odoo is Bootstrap underneath, with a heavy SCSS variable-override layer rather than a from-scratch design system: `addons/web/static/src/scss/primary_variables.scss` defines the actual tokens (a full `$o-gray-100`...`$o-gray-900` scale, rem-based font sizes, brand colors) as `!default` SCSS variables consumed before Bootstrap imports them; component-scoped `.scss` files (e.g. `list_renderer.scss`) sit next to each component rather than one global stylesheet.

**Status: shipped.** `globals.css` now carries the token layer this section proposed — a gray scale (`--gray-50`...`--gray-900`), brand colors (`--brand-50`...`--brand-700`), status colors (`--status-info/warn/danger/success`), a spacing scale (`--space-1`...`--space-10`), radius and shadow tokens, and `--launcher-gradient`. `src/styles/shared.module.css` is the light component library built on top: `.page`/`.pageHeader`/`.pageTitle`/`.card`/`.section` for layout, `.btn` (+ `.btnPrimary`/`.btnDanger`/`.btnGhost`/`.btnSmall`), `.input`/`.select`/`.textarea`/`.formGrid`, `.table` (styles bare `<th>`/`<td>` automatically), and `.badge` (+ `.badgeSuccess`/`.badgeWarn`/`.badgeDanger`/`.badgeInfo` — replacing the near-identical `STATUS_COLORS` maps that used to be redefined per page in Expenses, Payroll, Attendance, Audit Log). Every page under `/dashboard` now imports this module instead of hand-writing `color: "#666"`/`padding: "6px 4px"` inline; `src/styles/auth.module.css` does the same job for Login/Signup. Inline `style={{...}}` still appears for genuinely one-off layout (e.g. `gridColumn: "1 / -1"` on a specific form field, or the Calendar page's bespoke month-grid cell coloring) — that's intentional, not leftover debt.

---

## 11. Navigation, breadcrumbs, and routing

Odoo keeps an in-memory action stack (`core/browser/router.js` + each view's `breadcrumbs` config in `views/view.js`) — drilling into a record pushes a breadcrumb entry with a reactive name rather than a full page navigation, and going back restores prior list/filter state instead of refetching. CoreERP is plain Next.js file-based routing today (`/dashboard/hr`, `/dashboard/hr/payroll`, ...), with no breadcrumb trail and no state-preserving back navigation — going back to a list after opening a record (where "opening a record" exists at all; most modules today use inline expandable rows instead of navigating to a detail page) means the list re-fetches.

**What adopting this takes**: lowest priority of everything in this doc. CoreERP's inline-expandable-row pattern (used throughout Procurement, Sales, Payroll) already sidesteps most of the problem breadcrumbs solve, by not navigating away from the list in the first place. Worth revisiting only once/if individual record detail *pages* (not expandable rows) become the norm — a `<PageHeader>` breadcrumb prop (§2) is enough for that when it happens; a full action-stack router is not warranted at CoreERP's current scale.

---

## 12. Suggested adoption order

Roughly cheapest-and-most-visible first, each step usable and shippable on its own — no big-bang rewrite:

1. ~~**Design tokens** (§10)~~ — shipped: `globals.css` tokens + `shared.module.css` + `auth.module.css`, applied to every `/dashboard` page and Login/Signup.
2. ~~**Per-module landing sub-nav** (§4)~~ — shipped, as a left sidebar (`ModuleShell.tsx`) rather than the tab-strip originally sketched here. The per-module *dashboard-card* KPI screen part of the original §4 proposal did not ship — each module still lands on its existing table/list page, now just inside the sidebar shell.
3. **Shared `<ListView>`/`<RecordForm>`** (§5, §6) — the big one. Worth prototyping against one already-simple page (e.g. Departments or Positions) before rolling out module by module.
4. **Filter sidebar + grouping** (§7) — natural extension of step 3, not a separate effort.
5. **Statusbar / smart-button visual treatment** (§8) — cosmetic on top of data that already exists; can happen anytime after step 3.
6. Breadcrumbs/routing (§11) — only if/when detail pages replace inline-expandable rows as the dominant pattern.

Nothing here blocks continuing to ship new backend/business-logic modules in the meantime, the way the last several sections have — this is a parallel track, not a prerequisite.
