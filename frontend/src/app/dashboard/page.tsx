"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ModuleIcon } from "@/components/ModuleIcons";
import { NotificationBell } from "@/components/NotificationBell";
import { api, ApiError, type CompanySummary } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import styles from "./launcher.module.css";

const MODULE_TILES = [
  { key: "settings", label: "Settings", permission: "settings.view", href: "/dashboard/settings" },
  {
    key: "accounting",
    label: "Accounting",
    permission: "accounting.view",
    href: "/dashboard/accounting",
  },
  { key: "hr", label: "HR", permission: "hr.view", href: "/dashboard/hr" },
  { key: "sales", label: "Sales & CRM", permission: "sales.view", href: "/dashboard/sales" },
  {
    key: "inventory",
    label: "Inventory & Catalog",
    permission: "inventory.view",
    href: "/dashboard/inventory",
  },
  {
    key: "procurement",
    label: "Procurement",
    permission: "procurement.view",
    href: "/dashboard/procurement",
  },
  { key: "expenses", label: "Expenses", permission: "expenses.view", href: "/dashboard/expenses" },
  { key: "tasks", label: "Tasks", permission: "tasks.view", href: "/dashboard/tasks" },
  { key: "calendar", label: "Calendar", permission: "calendar.view", href: "/dashboard/calendar" },
  // Section J: Hotel & Hospitality, ported from AEdward/MiranErp.
  { key: "hotel", label: "Hotel", permission: "hotel.view", href: "/dashboard/hotel" },
  {
    key: "housekeeping",
    label: "Housekeeping",
    permission: "housekeeping.view",
    href: "/dashboard/housekeeping",
  },
  {
    key: "maintenance",
    label: "Maintenance",
    permission: "maintenance.view",
    href: "/dashboard/maintenance",
  },
  { key: "pos", label: "POS", permission: "pos.view", href: "/dashboard/pos" },
  {
    key: "conference",
    label: "Conference & Events",
    permission: "conference.view",
    href: "/dashboard/conference",
  },
  { key: "spa", label: "Spa", permission: "spa.view", href: "/dashboard/spa" },
  { key: "gym", label: "Gym", permission: "gym.view", href: "/dashboard/gym" },
  { key: "laundry", label: "Laundry", permission: "laundry.view", href: "/dashboard/laundry" },
  {
    key: "loyalty",
    label: "Guest Loyalty",
    permission: "loyalty.view",
    href: "/dashboard/loyalty",
  },
];

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function DashboardPage() {
  const { me, activeMembership, error: sessionError, refresh } = useSession();
  const router = useRouter();

  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [summary, setSummary] = useState<CompanySummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    if (activeMembership) {
      (async () => {
        try {
          setSummary(await api.companySummary());
        } catch (err) {
          setSummaryError(err instanceof ApiError ? err.message : "Failed to load overview.");
        }
      })();
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSummary(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setCompanyMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSwitch(companyId: number) {
    setWorking(true);
    try {
      await api.setActiveCompany(companyId);
      await refresh();
      setCompanyMenuOpen(false);
    } finally {
      setWorking(false);
    }
  }

  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    try {
      const company = await api.createCompany({ name: newCompanyName });
      await api.setActiveCompany(company.id);
      setNewCompanyName("");
      await refresh();
      setCompanyMenuOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create company.");
    } finally {
      setWorking(false);
    }
  }

  async function handleLogout() {
    await api.logout();
    router.push("/login");
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  // "My Profile" isn't permission-gated like the rest — every company
  // member should be able to reach their own Employee Self-Service page
  // regardless of what module permissions their role does or doesn't
  // carry (a plain staff member typically has none of the above).
  const MY_PROFILE_TILE = { key: "myprofile", label: "My Profile", href: "/dashboard/me" };
  const visibleTiles = activeMembership
    ? [MY_PROFILE_TILE, ...MODULE_TILES.filter((tile) => activeMembership.permissions.includes(tile.permission))]
    : [];

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

          <div className={styles.companySwitcher} ref={menuRef}>
            <button
              type="button"
              className={styles.companyButton}
              onClick={() => setCompanyMenuOpen((v) => !v)}
            >
              <span className={styles.avatar}>
                {activeMembership ? initials(activeMembership.company.name) : "?"}
              </span>
              {activeMembership ? activeMembership.company.name : "Select company"}
            </button>

            {companyMenuOpen && (
              <div className={styles.companyMenu}>
                {me.memberships.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    disabled={working}
                    onClick={() => handleSwitch(m.company.id)}
                    className={`${styles.companyMenuItem} ${
                      m.company.id === me.active_company_id ? styles.active : ""
                    }`}
                  >
                    {m.company.name}
                    <div className={styles.companyMenuRole}>{m.roles.map((r) => r.name).join(", ")}</div>
                  </button>
                ))}
                <div className={styles.companyMenuDivider} />
                <form onSubmit={handleCreateCompany} className={styles.companyMenuForm}>
                  <input
                    placeholder="New company name"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    className={styles.companyMenuInput}
                  />
                  <button
                    type="submit"
                    disabled={working || !newCompanyName}
                    className={styles.logoutButton}
                  >
                    Add
                  </button>
                </form>
                {error && (
                  <p style={{ color: "crimson", fontSize: 12, padding: "6px 8px 0" }}>{error}</p>
                )}
              </div>
            )}
          </div>

          <button type="button" onClick={handleLogout} className={styles.logoutButton}>
            Log out
          </button>
        </div>
      </header>

      {!activeMembership ? (
        <div className={styles.onboarding}>
          <h1 style={{ fontSize: 20, color: "var(--gray-800)" }}>Welcome to CoreERP</h1>
          <p style={{ color: "var(--gray-600)", fontSize: 14, marginTop: 8 }}>
            {me.memberships.length === 0
              ? "You're not a member of any company yet — create one to get started."
              : "Pick a company from the switcher above, or create a new one."}
          </p>
          <div className={styles.onboardingCard}>
            <form onSubmit={handleCreateCompany} style={{ display: "flex", gap: 8 }}>
              <input
                placeholder="New company name"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                className={styles.companyMenuInput}
              />
              <button
                type="submit"
                disabled={working || !newCompanyName}
                className={styles.logoutButton}
              >
                Create
              </button>
            </form>
            {error && <p style={{ color: "crimson", fontSize: 12, marginTop: 8 }}>{error}</p>}
          </div>
        </div>
      ) : (
        <>
          <div className={styles.gridWrap}>
            {visibleTiles.length === 0 ? (
              <p className={styles.emptyState}>
                Your role doesn&apos;t have access to any module yet — ask your company&apos;s Owner
                to grant you permissions.
              </p>
            ) : (
              <div className={styles.grid}>
                {visibleTiles.map((tile) => (
                  <Link key={tile.key} href={tile.href} className={styles.tile}>
                    <span className={styles.tileIcon}>
                      <ModuleIcon moduleKey={tile.key} muted={false} />
                    </span>
                    <span className={styles.tileLabel}>{tile.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className={styles.overview}>
            <button
              type="button"
              className={styles.overviewToggle}
              onClick={() => setOverviewOpen((v) => !v)}
            >
              {overviewOpen ? "▾" : "▸"} {activeMembership.company.name} overview
            </button>
            {overviewOpen && (
              <>
                {summaryError && <p style={{ color: "crimson", fontSize: 13 }}>{summaryError}</p>}
                {summary && Object.keys(summary).length === 0 && (
                  <p style={{ color: "var(--gray-500)", fontSize: 13 }}>
                    Nothing to show — your role doesn&apos;t have view access to any module with
                    overview data yet.
                  </p>
                )}
                <div className={styles.overviewCards}>
                  {summary?.finance && (
                    <>
                      <StatCard label="Revenue" value={formatCents(summary.finance.revenue_cents)} />
                      <StatCard label="Expenses" value={formatCents(summary.finance.expense_cents)} />
                      <StatCard label="Profit" value={formatCents(summary.finance.profit_cents)} />
                      <StatCard
                        label="Pending receivable"
                        value={formatCents(summary.finance.pending_receivable_cents)}
                      />
                      <StatCard
                        label="Pending payable"
                        value={formatCents(summary.finance.pending_payable_cents)}
                      />
                    </>
                  )}
                  {summary?.sales && (
                    <>
                      <StatCard label="Sales orders" value={String(summary.sales.order_count)} />
                      <StatCard label="Sales value" value={formatCents(summary.sales.total_sales_cents)} />
                    </>
                  )}
                  {summary?.inventory && (
                    <>
                      <StatCard label="Items" value={String(summary.inventory.item_count)} />
                      <StatCard label="Stock units" value={String(summary.inventory.total_units)} />
                      <StatCard
                        label="Low stock alerts"
                        value={String(summary.inventory.low_stock_count)}
                        warn={summary.inventory.low_stock_count > 0}
                      />
                    </>
                  )}
                  {summary?.hr && (
                    <StatCard label="Employees" value={String(summary.hr.employee_count)} />
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statLabel}>{label}</div>
      <div className={`${styles.statValue} ${warn ? styles.warn : ""}`}>{value}</div>
    </div>
  );
}
