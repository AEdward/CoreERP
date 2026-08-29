"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type ShortageReportRow } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

export default function ShortageReportPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [rows, setRows] = useState<ShortageReportRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeMembership) return;
    (async () => {
      try {
        setRows(await api.getShortageReport());
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load shortage report.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  return (
    <ModuleShell moduleKey="manufacturing" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Shortage Report</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
            <p className={shared.hint} style={{ marginTop: 4 }}>
              Outstanding component requirements across every planned or in-progress production order, netted
              against current on-hand stock. Not a scheduling engine — just what&apos;s short right now.
            </p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.section}>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Warehouse</th>
                  <th>Required</th>
                  <th>On hand</th>
                  <th>Shortage</th>
                </tr>
              </thead>
              <tbody>
                {rows?.map((r) => (
                  <tr key={`${r.item}-${r.warehouse}`}>
                    <td>{r.item_name}</td>
                    <td className={shared.tableMuted}>{r.warehouse_name}</td>
                    <td className={shared.tableMuted}>{r.required_quantity}</td>
                    <td className={shared.tableMuted}>{r.on_hand_quantity}</td>
                    <td>
                      <span className={`${shared.badge} ${shared.badgeDanger}`}>{r.shortage_quantity}</span>
                    </td>
                  </tr>
                ))}
                {rows?.length === 0 && (
                  <tr>
                    <td colSpan={5} className={shared.tableMuted}>
                      No shortages — every open production order is fully covered by on-hand stock.
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
