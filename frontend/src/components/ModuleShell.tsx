"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationBell } from "@/components/NotificationBell";
import { api, type Membership } from "@/lib/api";
import styles from "./moduleShell.module.css";

export type ModuleKey =
  | "hr"
  | "accounting"
  | "sales"
  | "inventory"
  | "procurement"
  | "expenses"
  | "tasks"
  | "calendar"
  | "settings"
  | "hotel"
  | "housekeeping"
  | "maintenance"
  | "conference"
  | "gym"
  | "laundry"
  | "spa"
  | "loyalty"
  | "pos"
  | "myprofile";

interface NavItem {
  href: string;
  label: string;
}

interface NavGroup {
  title?: string;
  items: NavItem[];
}

/** Every module's sidebar is one or more NavGroups — most modules are a
 * single unlabeled group (a flat list), but a module with enough
 * sub-pages to need grouping (Hotel) gets multiple titled groups
 * instead. Either shape renders through the same sidebar markup. */
const MODULE_NAV: Record<ModuleKey, { title: string; groups: NavGroup[] }> = {
  hr: {
    title: "HR",
    groups: [
      {
        items: [
          { href: "/dashboard/hr", label: "Overview" },
          { href: "/dashboard/hr/attendance", label: "Attendance" },
          { href: "/dashboard/hr/leave-and-contracts", label: "Leave & Contracts" },
          { href: "/dashboard/hr/payroll", label: "Payroll" },
          { href: "/dashboard/hr/recruitment", label: "Recruitment" },
          { href: "/dashboard/hr/performance", label: "Performance & Training" },
        ],
      },
    ],
  },
  myprofile: {
    title: "My Profile",
    groups: [
      {
        items: [{ href: "/dashboard/me", label: "My Profile" }],
      },
    ],
  },
  accounting: {
    title: "Accounting",
    groups: [
      {
        items: [
          { href: "/dashboard/accounting", label: "Overview" },
          { href: "/dashboard/accounting/banking", label: "Banking" },
          { href: "/dashboard/accounting/petty-cash", label: "Petty Cash" },
          { href: "/dashboard/accounting/budgets", label: "Budgets" },
          { href: "/dashboard/accounting/fixed-assets", label: "Fixed Assets" },
        ],
      },
    ],
  },
  sales: {
    title: "Sales & CRM",
    groups: [
      {
        items: [
          { href: "/dashboard/sales", label: "Sales & CRM" },
          { href: "/dashboard/crm", label: "Leads & Opportunities" },
        ],
      },
    ],
  },
  inventory: {
    title: "Inventory & Catalog",
    groups: [
      {
        items: [
          { href: "/dashboard/inventory", label: "Overview" },
          { href: "/dashboard/inventory/stock-counts", label: "Stock Counts" },
        ],
      },
    ],
  },
  procurement: {
    title: "Procurement",
    groups: [{ items: [{ href: "/dashboard/procurement", label: "Overview" }] }],
  },
  expenses: {
    title: "Expenses",
    groups: [{ items: [{ href: "/dashboard/expenses", label: "Overview" }] }],
  },
  tasks: {
    title: "Tasks",
    groups: [{ items: [{ href: "/dashboard/tasks", label: "Overview" }] }],
  },
  calendar: {
    title: "Calendar",
    groups: [{ items: [{ href: "/dashboard/calendar", label: "Overview" }] }],
  },
  settings: {
    title: "Settings",
    groups: [
      {
        items: [
          { href: "/dashboard/settings", label: "Company Settings" },
          { href: "/dashboard/audit-log", label: "Audit Log" },
        ],
      },
    ],
  },
  // Section J: Hotel & Hospitality, ported from AEdward/MiranErp. Group
  // structure and labels mirror MiranErp's own hotel/layout.tsx nav
  // (Front Office / Room Operations / Billing / Reports / Settings).
  hotel: {
    title: "Hotel",
    groups: [
      {
        title: "Front Office",
        items: [
          { href: "/dashboard/hotel", label: "Dashboard" },
          { href: "/dashboard/hotel/reservations", label: "Reservations" },
          { href: "/dashboard/hotel/walk-in", label: "Walk-in Guests" },
          { href: "/dashboard/hotel/check-in", label: "Check-In" },
          { href: "/dashboard/hotel/check-out", label: "Check-Out" },
          { href: "/dashboard/hotel/room-assignment", label: "Room Assignment" },
          { href: "/dashboard/hotel/room-transfers", label: "Room Transfers" },
          { href: "/dashboard/hotel/guest-directory", label: "Guest Directory" },
          { href: "/dashboard/hotel/guest-requests", label: "Guest Requests" },
          { href: "/dashboard/hotel/guest-folios", label: "Guest Folios" },
        ],
      },
      {
        title: "Room Operations",
        items: [
          { href: "/dashboard/hotel/room-status", label: "Room Status" },
          { href: "/dashboard/hotel/room-availability", label: "Room Availability" },
          { href: "/dashboard/hotel/room-blocking", label: "Room Blocking" },
          { href: "/dashboard/hotel/vip-guests", label: "VIP Guests" },
          { href: "/dashboard/hotel/group-reservations", label: "Group Reservations" },
          { href: "/dashboard/hotel/no-shows", label: "No Shows" },
          { href: "/dashboard/hotel/late-checkout", label: "Late Check-Out" },
          { href: "/dashboard/hotel/early-checkin", label: "Early Check-In" },
        ],
      },
      {
        title: "Billing",
        items: [
          { href: "/dashboard/hotel/guest-billing", label: "Guest Billing" },
          { href: "/dashboard/hotel/payments", label: "Payments" },
          { href: "/dashboard/hotel/refunds", label: "Refunds" },
          { href: "/dashboard/hotel/room-charges", label: "Room Charges" },
          { href: "/dashboard/hotel/extra-charges", label: "Extra Charges" },
          { href: "/dashboard/hotel/invoices", label: "Invoices" },
        ],
      },
      {
        title: "Reports",
        items: [
          { href: "/dashboard/hotel/reports/occupancy", label: "Occupancy Report" },
          { href: "/dashboard/hotel/reports/arrivals-departures", label: "Arrival & Departure Report" },
          { href: "/dashboard/hotel/reports/reservations", label: "Reservation Report" },
          { href: "/dashboard/hotel/reports/daily", label: "Daily Front Office Report" },
        ],
      },
      {
        title: "Settings",
        items: [{ href: "/dashboard/hotel/settings", label: "Front Office Settings" }],
      },
    ],
  },
  housekeeping: {
    title: "Housekeeping",
    groups: [{ items: [{ href: "/dashboard/housekeeping", label: "Overview" }] }],
  },
  maintenance: {
    title: "Maintenance",
    groups: [{ items: [{ href: "/dashboard/maintenance", label: "Overview" }] }],
  },
  conference: {
    title: "Conference & Events",
    groups: [{ items: [{ href: "/dashboard/conference", label: "Overview" }] }],
  },
  gym: {
    title: "Gym",
    groups: [{ items: [{ href: "/dashboard/gym", label: "Overview" }] }],
  },
  laundry: {
    title: "Laundry",
    groups: [{ items: [{ href: "/dashboard/laundry", label: "Overview" }] }],
  },
  spa: {
    title: "Spa",
    groups: [{ items: [{ href: "/dashboard/spa", label: "Overview" }] }],
  },
  loyalty: {
    title: "Guest Loyalty",
    groups: [{ items: [{ href: "/dashboard/loyalty", label: "Overview" }] }],
  },
  pos: {
    title: "POS",
    groups: [
      {
        items: [
          { href: "/dashboard/pos", label: "Overview" },
          { href: "/dashboard/kds", label: "Kitchen Display" },
        ],
      },
    ],
  },
};

export function ModuleShell({
  moduleKey,
  activeMembership,
  children,
}: {
  moduleKey: ModuleKey;
  activeMembership: Membership | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const nav = MODULE_NAV[moduleKey];

  async function handleLogout() {
    await api.logout();
    router.push("/login");
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dashboard" className={styles.brand}>
          <span className={styles.brandMark}>C</span>
          CoreERP
        </Link>

        <div className={styles.topbarActions}>
          {activeMembership && <GlobalSearch active={!!activeMembership} />}
          {activeMembership && <NotificationBell active={!!activeMembership} />}
          {activeMembership && (
            <span className={styles.companyBadge}>{activeMembership.company.name}</span>
          )}
          <button type="button" onClick={handleLogout} className={styles.logoutButton}>
            Log out
          </button>
        </div>
      </header>

      {!activeMembership ? (
        <p className={styles.noCompany}>
          Pick an active company on the <Link href="/dashboard">dashboard</Link> first.
        </p>
      ) : (
        <div className={styles.body}>
          <aside className={styles.sidebar}>
            {nav.groups.length === 1 && !nav.groups[0].title ? (
              <div className={styles.sidebarTitle}>{nav.title}</div>
            ) : null}
            {nav.groups.map((group, i) => (
              <nav key={group.title ?? i} className={styles.navGroup}>
                {group.title && <div className={styles.sidebarTitle}>{group.title}</div>}
                <div className={styles.navList}>
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`${styles.navLink} ${pathname === item.href ? styles.navLinkActive : ""}`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </nav>
            ))}
          </aside>
          <div className={styles.content}>{children}</div>
        </div>
      )}
    </div>
  );
}
