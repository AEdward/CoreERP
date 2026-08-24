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
  | "settings";

const MODULE_NAV: Record<ModuleKey, { title: string; items: { href: string; label: string }[] }> = {
  hr: {
    title: "HR",
    items: [
      { href: "/dashboard/hr", label: "Overview" },
      { href: "/dashboard/hr/attendance", label: "Attendance" },
      { href: "/dashboard/hr/leave-and-contracts", label: "Leave & Contracts" },
      { href: "/dashboard/hr/payroll", label: "Payroll" },
    ],
  },
  accounting: {
    title: "Accounting",
    items: [
      { href: "/dashboard/accounting", label: "Overview" },
      { href: "/dashboard/accounting/banking", label: "Banking" },
      { href: "/dashboard/accounting/petty-cash", label: "Petty Cash" },
      { href: "/dashboard/accounting/budgets", label: "Budgets" },
      { href: "/dashboard/accounting/fixed-assets", label: "Fixed Assets" },
    ],
  },
  sales: {
    title: "Sales & CRM",
    items: [
      { href: "/dashboard/sales", label: "Sales & CRM" },
      { href: "/dashboard/crm", label: "Leads & Opportunities" },
    ],
  },
  inventory: {
    title: "Inventory & Catalog",
    items: [
      { href: "/dashboard/inventory", label: "Overview" },
      { href: "/dashboard/inventory/stock-counts", label: "Stock Counts" },
    ],
  },
  procurement: {
    title: "Procurement",
    items: [{ href: "/dashboard/procurement", label: "Overview" }],
  },
  expenses: {
    title: "Expenses",
    items: [{ href: "/dashboard/expenses", label: "Overview" }],
  },
  tasks: {
    title: "Tasks",
    items: [{ href: "/dashboard/tasks", label: "Overview" }],
  },
  calendar: {
    title: "Calendar",
    items: [{ href: "/dashboard/calendar", label: "Overview" }],
  },
  settings: {
    title: "Settings",
    items: [
      { href: "/dashboard/settings", label: "Company Settings" },
      { href: "/dashboard/audit-log", label: "Audit Log" },
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
            <div className={styles.sidebarTitle}>{nav.title}</div>
            <nav className={styles.navList}>
              {nav.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navLink} ${pathname === item.href ? styles.navLinkActive : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <div className={styles.content}>{children}</div>
        </div>
      )}
    </div>
  );
}
