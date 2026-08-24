# CoreERP — Frontend Design Reference

*How Odoo structures its frontend, what CoreERP already does that rhymes with it, and a concrete adoption path — written as a reference to build against, not a rewrite mandate. No page has been redesigned off the back of this doc yet; each section below ends with what changing it would actually take.*

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

**CoreERP today**: `AppHeader.tsx` is a single persistent top bar (company switcher, global search, notification bell, module links) rendered by every page. That's already the right shape for the navbar layer — it's the second layer (a per-page action/breadcrumb bar) that doesn't exist yet; each page currently puts its own `<h1>` where that bar would go.

**What changing this takes**: a `<PageHeader>` component (breadcrumbs + page title + primary action button, e.g. "+ New Employee") rendered by every module page below `<AppHeader>`, replacing the current ad hoc `<h1>{module} — {company}</h1>` line each page writes today.

---

## 3. The app launcher grid

Odoo's app grid (the screen you land on after login) only ever shows apps installed *and* accessible to you — there's no "greyed out, no access" tile. CoreERP's dashboard (`/dashboard/page.tsx`) used to show every module tile always, greyed out with a "No access" label if the active role lacked the permission.

**Status: done.** `MODULE_TILES` is now filtered by `activeMembership.permissions.includes(tile.permission)` before rendering — a role without `inventory.view` simply never sees an Inventory tile, the same way Odoo never shows an app you can't open. Owner already holds every permission in the seeded role set, so Owner continues to see everything without any special-casing.

---

## 4. Per-module landing = a dashboard, not a list

This is the biggest structural gap and the next concrete target. In Odoo, opening an app never drops you straight into a record table. Accounting opens to a kanban-card dashboard (Customer Invoices card with its own mini bar chart and quick actions, Vendor Bills card, one card per bank/cash journal). Time Off opens with its own sub-nav — *Time Off · My Time · Overview · Management · Reporting · Configuration* — tabs that exist only inside that app, distinct from the global navbar.

CoreERP's dashboard already does a version of the *company-level* version of this (the "— overview" section with `StatCard`s for revenue/expenses/employees/stock), but only at the top level. Once you click into `/dashboard/hr` or `/dashboard/procurement`, you land straight on the Departments table — there's no HR-specific overview screen first, and no sub-nav distinguishing "HR's dashboard" from "HR's employee list" from "HR's payroll runs" (payroll and leave/attendance today are just links in a paragraph of text on the HR page).

**What changing this takes**, concretely, per module:
- A `<ModuleLayout appKey="hr" tabs={[...]}>` shell component: renders a second-level tab strip (mirroring Odoo's per-app section tabs) — e.g. for HR: *Overview · Employees · Payroll · Leave & Attendance · Recruitment*. `/dashboard/hr` becomes that tab strip's *Overview* tab; the existing employee table moves to `/dashboard/hr/employees`; `/dashboard/hr/payroll` and `/dashboard/hr/attendance` (which already exist as separate pages) become tabs instead of footnote links.
- A small `<DashboardCard>` primitive (title, one primary stat, a couple of quick-action buttons, optionally a tiny trend) — reusable across every module's Overview tab, the CoreERP equivalent of Odoo's Accounting Dashboard cards. HR's Overview could show "Employees" / "Open leave requests" / "Latest payroll run status" as three cards; Procurement's could show "Open purchase requests" / "Pending approvals" / "This month's spend."
- This is additive, not a rewrite: existing pages (the Employees table, the Payroll page) don't change internally, they just move one level deeper in the URL tree and gain a sibling Overview tab.

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

CoreERP today has *no* token layer at all — every page hand-writes `color: "#666"`, `padding: "6px 4px"`, `border: "1px solid #eee"` inline, independently, page by page. The specific hex/pixel values are already consistent by convention (whoever wrote each page copied the pattern from the last one), which is exactly the smell of "this should be tokens, not repetition."

**What adopting this takes**: a `tokens.ts` (or CSS custom properties) capturing the handful of values already in de facto use — the gray scale (`#666`, `#999`, `#eee`, `#ddd`), spacing (`4px`/`6px`/`8px`/`16px`/`24px`/`40px` show up constantly), border-radius, the status colors already duplicated per page (`STATUS_COLORS` maps redefined nearly identically in Expenses, Leave Requests, Payroll Runs, Attendance) — collapsed into one shared source, then a light component library (`<Table>`, `<Badge status>`, `<Button variant>`) built on top of the tokens rather than raw `<table>`/`<button style={{...}}>`. This is the lowest-risk, highest-visual-payoff piece to start with, and doesn't depend on §5's bigger view-engine work at all.

---

## 11. Navigation, breadcrumbs, and routing

Odoo keeps an in-memory action stack (`core/browser/router.js` + each view's `breadcrumbs` config in `views/view.js`) — drilling into a record pushes a breadcrumb entry with a reactive name rather than a full page navigation, and going back restores prior list/filter state instead of refetching. CoreERP is plain Next.js file-based routing today (`/dashboard/hr`, `/dashboard/hr/payroll`, ...), with no breadcrumb trail and no state-preserving back navigation — going back to a list after opening a record (where "opening a record" exists at all; most modules today use inline expandable rows instead of navigating to a detail page) means the list re-fetches.

**What adopting this takes**: lowest priority of everything in this doc. CoreERP's inline-expandable-row pattern (used throughout Procurement, Sales, Payroll) already sidesteps most of the problem breadcrumbs solve, by not navigating away from the list in the first place. Worth revisiting only once/if individual record detail *pages* (not expandable rows) become the norm — a `<PageHeader>` breadcrumb prop (§2) is enough for that when it happens; a full action-stack router is not warranted at CoreERP's current scale.

---

## 12. Suggested adoption order

Roughly cheapest-and-most-visible first, each step usable and shippable on its own — no big-bang rewrite:

1. **Design tokens** (§10) — a few hours, touches nothing structurally, immediately makes every future page more consistent.
2. **Per-module landing dashboard + sub-nav** (§4) — the two things the user asked for directly. Start with one module (HR is the natural pilot — it already has the most sub-pages: Employees, Payroll, Leave & Attendance).
3. **Shared `<ListView>`/`<RecordForm>`** (§5, §6) — the big one. Worth prototyping against one already-simple page (e.g. Departments or Positions) before rolling out module by module.
4. **Filter sidebar + grouping** (§7) — natural extension of step 3, not a separate effort.
5. **Statusbar / smart-button visual treatment** (§8) — cosmetic on top of data that already exists; can happen anytime after step 3.
6. Breadcrumbs/routing (§11) — only if/when detail pages replace inline-expandable rows as the dominant pattern.

Nothing here blocks continuing to ship new backend/business-logic modules in the meantime, the way the last several sections have — this is a parallel track, not a prerequisite.
