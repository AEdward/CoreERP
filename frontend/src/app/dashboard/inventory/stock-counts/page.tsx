"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type StockCount, type Warehouse } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

export default function StockCountsPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null);
  const [counts, setCounts] = useState<StockCount[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newWarehouse, setNewWarehouse] = useState("");
  const [createWorking, setCreateWorking] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [countedValues, setCountedValues] = useState<Record<number, string>>({});
  const [saveWorking, setSaveWorking] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [finalizeWorking, setFinalizeWorking] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [w, c] = await Promise.all([api.listWarehouses(), api.listStockCounts()]);
      setWarehouses(w);
      setCounts(c);
      if (selectedId === null && c.length > 0) setSelectedId(c[0].id);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load stock counts.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  const selectedCount = counts?.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedCount) {
      const values: Record<number, string> = {};
      for (const line of selectedCount.lines) {
        values[line.id] = line.counted_quantity === null ? "" : String(line.counted_quantity);
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCountedValues(values);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCount?.id]);

  async function handleCreateCount(e: React.FormEvent) {
    e.preventDefault();
    if (!newWarehouse) return;
    setCreateWorking(true);
    setCreateError(null);
    try {
      const created = await api.createStockCount(Number(newWarehouse));
      setNewWarehouse("");
      await loadAll();
      setSelectedId(created.id);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Failed to start a stock count.");
    } finally {
      setCreateWorking(false);
    }
  }

  async function handleSaveCounts() {
    if (!selectedCount) return;
    setSaveWorking(true);
    setSaveError(null);
    try {
      const lines = selectedCount.lines.map((line) => ({
        id: line.id,
        counted_quantity: countedValues[line.id] === "" ? null : Number(countedValues[line.id]),
      }));
      await api.recordStockCounts(selectedCount.id, lines);
      await loadAll();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Failed to save counts.");
    } finally {
      setSaveWorking(false);
    }
  }

  async function handleFinalize() {
    if (!selectedCount) return;
    setFinalizeWorking(true);
    setFinalizeError(null);
    try {
      await handleSaveCounts();
      await api.finalizeStockCount(selectedCount.id);
      await loadAll();
    } catch (err) {
      setFinalizeError(err instanceof ApiError ? err.message : "Failed to finalize count.");
    } finally {
      setFinalizeWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("inventory.manage") ?? false;
  const warehouseName = (id: number) => warehouses?.find((w) => w.id === id)?.name ?? "—";

  return (
    <ModuleShell moduleKey="inventory" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Stock counts</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
          <div className={shared.pageActions}>
            <a href="/dashboard/inventory" className={shared.btn}>
              &larr; Back to Inventory
            </a>
          </div>
        </div>
        <p className={shared.hint} style={{ maxWidth: 600, marginBottom: 16 }}>
          Starting a count snapshots every item&apos;s current system quantity for a warehouse.
          Fill in what staff actually counted, then finalize to post one adjustment per line that
          differs — the same audit trail and low-stock alerts as any other stock movement.
        </p>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Counts</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th></th>
                  <th>Warehouse</th>
                  <th>Status</th>
                  <th>Lines</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {counts?.map((c) => (
                  <tr
                    key={c.id}
                    style={{
                      background: c.id === selectedId ? "var(--gray-50)" : undefined,
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <td>
                      <input type="radio" checked={c.id === selectedId} onChange={() => setSelectedId(c.id)} />
                    </td>
                    <td>{warehouseName(c.warehouse)}</td>
                    <td>
                      <span
                        className={`${shared.badge} ${c.status === "completed" ? shared.badgeInfo : shared.badgeSuccess}`}
                      >
                        {c.status === "completed" ? "Completed" : "Open"}
                      </span>
                    </td>
                    <td>{c.lines.length}</td>
                    <td>{c.completed_at ?? "—"}</td>
                  </tr>
                ))}
                {counts?.length === 0 && (
                  <tr>
                    <td colSpan={5} className={shared.tableMuted}>
                      No stock counts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form onSubmit={handleCreateCount} className={shared.formRow} style={{ marginTop: 16, maxWidth: 500 }}>
                <select
                  required
                  value={newWarehouse}
                  onChange={(e) => setNewWarehouse(e.target.value)}
                  className={shared.select}
                  style={{ flex: 1 }}
                >
                  <option value="">Warehouse…</option>
                  {warehouses?.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={createWorking || !newWarehouse}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Start count
                </button>
              </form>
            )}
            {createError && <p className={shared.errorText}>{createError}</p>}
          </div>
        </div>

        {selectedCount && (
          <div className={shared.section}>
            <h2 className={shared.sectionTitle}>
              {warehouseName(selectedCount.warehouse)} — {selectedCount.status === "completed" ? "Completed" : "Open"}
            </h2>
            <div className={shared.card}>
              <table className={shared.table}>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>System qty</th>
                    <th>Counted qty</th>
                    <th>Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCount.lines.map((line) => (
                    <tr key={line.id}>
                      <td>{line.item_name}</td>
                      <td>{line.system_quantity}</td>
                      <td>
                        {selectedCount.status === "open" && canManage ? (
                          <input
                            type="number"
                            value={countedValues[line.id] ?? ""}
                            onChange={(e) =>
                              setCountedValues({ ...countedValues, [line.id]: e.target.value })
                            }
                            className={shared.input}
                            style={{ width: 100, padding: 4 }}
                          />
                        ) : (
                          line.counted_quantity ?? "—"
                        )}
                      </td>
                      <td
                        style={{
                          color:
                            line.variance === null || line.variance === 0
                              ? undefined
                              : line.variance < 0
                                ? "var(--status-danger)"
                                : "var(--status-success)",
                        }}
                      >
                        {line.variance ?? "—"}
                      </td>
                    </tr>
                  ))}
                  {selectedCount.lines.length === 0 && (
                    <tr>
                      <td colSpan={4} className={shared.tableMuted}>
                        No stock at this warehouse to count.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {canManage && selectedCount.status === "open" && (
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button
                    type="button"
                    disabled={saveWorking}
                    onClick={handleSaveCounts}
                    className={shared.btn}
                  >
                    Save counts
                  </button>
                  <button
                    type="button"
                    disabled={finalizeWorking}
                    onClick={handleFinalize}
                    className={`${shared.btn} ${shared.btnPrimary}`}
                  >
                    Finalize
                  </button>
                </div>
              )}
              {saveError && <p className={shared.errorText}>{saveError}</p>}
              {finalizeError && <p className={shared.errorText}>{finalizeError}</p>}
            </div>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
