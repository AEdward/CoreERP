"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type RetailReturn, type RetailSale } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function RetailReturnsPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [returns, setReturns] = useState<RetailReturn[] | null>(null);
  const [sales, setSales] = useState<RetailSale[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [saleId, setSaleId] = useState("");
  const [reason, setReason] = useState("");
  const [quantities, setQuantities] = useState<Record<number, string>>({});

  async function loadAll() {
    try {
      const [r, s] = await Promise.all([api.listRetailReturns(), api.listRetailSales()]);
      setReturns(r);
      setSales(s.filter((sale) => sale.status !== "returned"));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load returns.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  const selectedSale = sales?.find((s) => String(s.id) === saleId) ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSale) return;
    const lines = Object.entries(quantities)
      .filter(([, qty]) => Number(qty) > 0)
      .map(([saleLineId, qty]) => ({ sale_line: Number(saleLineId), quantity: Number(qty) }));
    if (lines.length === 0) {
      setActionError("Enter a quantity for at least one line.");
      return;
    }
    setWorking(true);
    setActionError(null);
    try {
      await api.createRetailReturn({ sale: selectedSale.id, reason, lines });
      setSaleId("");
      setReason("");
      setQuantities({});
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to process return.");
    } finally {
      setWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("retail.manage") ?? false;

  return (
    <ModuleShell moduleKey="retail" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Returns</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}
        {actionError && <p className={shared.errorText}>{actionError}</p>}

        {canManage && (
          <div className={shared.section}>
            <h2 className={shared.sectionTitle}>Process a return</h2>
            <div className={shared.card}>
              <form onSubmit={handleSubmit}>
                <div className={shared.formRow}>
                  <select
                    required
                    value={saleId}
                    onChange={(e) => {
                      setSaleId(e.target.value);
                      setQuantities({});
                    }}
                    className={shared.select}
                  >
                    <option value="">Sale…</option>
                    {sales?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.number}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={shared.input}
                  />
                </div>

                {selectedSale && (
                  <table className={shared.table} style={{ marginTop: 12 }}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Sold</th>
                        <th>Return quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSale.lines.map((l) => (
                        <tr key={l.id}>
                          <td>
                            {l.item_name}
                            {l.variant_name ? ` — ${l.variant_name}` : ""}
                          </td>
                          <td className={shared.tableMuted}>{l.quantity}</td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              max={l.quantity}
                              value={quantities[l.id] ?? ""}
                              onChange={(e) => setQuantities({ ...quantities, [l.id]: e.target.value })}
                              className={shared.input}
                              style={{ maxWidth: 90 }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <button
                  type="submit"
                  disabled={working || !selectedSale}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                  style={{ marginTop: 12 }}
                >
                  Process return
                </button>
              </form>
            </div>
          </div>
        )}

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Return history</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Sale</th>
                  <th>Reason</th>
                  <th>Refund</th>
                </tr>
              </thead>
              <tbody>
                {returns?.map((r) => (
                  <tr key={r.id}>
                    <td>{r.number}</td>
                    <td className={shared.tableMuted}>{r.sale_number}</td>
                    <td className={shared.tableMuted}>{r.reason || "—"}</td>
                    <td className={shared.tableMuted}>{formatCents(r.refund_amount_cents)}</td>
                  </tr>
                ))}
                {returns?.length === 0 && (
                  <tr>
                    <td colSpan={4} className={shared.tableMuted}>
                      No returns yet.
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
