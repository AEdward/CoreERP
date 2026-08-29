"use client";

import { Fragment, useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type RetailSale } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const STATUS_BADGES: Record<RetailSale["status"], string> = {
  completed: shared.badgeSuccess,
  partially_returned: shared.badgeWarn,
  returned: shared.badgeDanger,
};

export default function RetailSalesPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [sales, setSales] = useState<RetailSale[] | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeMembership) return;
    (async () => {
      try {
        setSales(await api.listRetailSales());
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load sales.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  return (
    <ModuleShell moduleKey="retail" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Sales</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.section}>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Register</th>
                  <th>Cashier</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sales?.map((s) => (
                  <Fragment key={s.id}>
                    <tr
                      onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>{s.number}</td>
                      <td className={shared.tableMuted}>{s.register_name}</td>
                      <td className={shared.tableMuted}>{s.cashier_name}</td>
                      <td className={shared.tableMuted}>{s.payment_method}</td>
                      <td className={shared.tableMuted}>{formatCents(s.total_cents)}</td>
                      <td>
                        <span className={`${shared.badge} ${STATUS_BADGES[s.status]}`}>{s.status}</span>
                      </td>
                    </tr>
                    {expanded === s.id && (
                      <tr key={`${s.id}-detail`}>
                        <td colSpan={6}>
                          <table className={shared.table} style={{ margin: "6px 0" }}>
                            <thead>
                              <tr>
                                <th>Item</th>
                                <th>Qty</th>
                                <th>Unit price</th>
                                <th>Discount</th>
                                <th>Line total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.lines.map((l) => (
                                <tr key={l.id}>
                                  <td>
                                    {l.item_name}
                                    {l.variant_name ? ` — ${l.variant_name}` : ""}
                                  </td>
                                  <td className={shared.tableMuted}>{l.quantity}</td>
                                  <td className={shared.tableMuted}>{formatCents(l.unit_price_cents)}</td>
                                  <td className={shared.tableMuted}>{l.discount_percent}%</td>
                                  <td className={shared.tableMuted}>{formatCents(l.line_total_cents)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <p className={shared.hint}>
                            Subtotal {formatCents(s.subtotal_cents)} — Discount {formatCents(s.discount_cents)} — Tax{" "}
                            {formatCents(s.tax_cents)} — Total {formatCents(s.total_cents)}
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {sales?.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No sales yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
