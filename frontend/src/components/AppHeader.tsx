"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NotificationBell } from "@/components/NotificationBell";
import { api, type Membership } from "@/lib/api";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/hr", label: "HR" },
  { href: "/dashboard/inventory", label: "Inventory & Catalog" },
  { href: "/dashboard/sales", label: "Sales & CRM" },
  { href: "/dashboard/procurement", label: "Procurement" },
  { href: "/dashboard/accounting", label: "Accounting" },
  { href: "/dashboard/tasks", label: "Tasks" },
  { href: "/dashboard/calendar", label: "Calendar" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function AppHeader({ activeMembership }: { activeMembership: Membership | null }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await api.logout();
    router.push("/login");
  }

  return (
    <header style={{ borderBottom: "1px solid #ddd", marginBottom: 24, paddingBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Link href="/dashboard" style={{ fontSize: 20, fontWeight: 700 }}>
            CoreERP
          </Link>
          {activeMembership && (
            <span style={{ marginLeft: 12, color: "#666" }}>{activeMembership.company.name}</span>
          )}
        </div>
        <div>
          <NotificationBell active={!!activeMembership} />
          <button onClick={handleLogout} style={{ padding: "6px 14px" }}>
            Log out
          </button>
        </div>
      </div>
      <nav style={{ display: "flex", gap: 16, marginTop: 12 }}>
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              fontWeight: pathname === link.href ? 700 : 400,
              borderBottom: pathname === link.href ? "2px solid #333" : "2px solid transparent",
              paddingBottom: 4,
            }}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
