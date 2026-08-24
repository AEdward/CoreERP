"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { api, ApiError, type StockCount, type Warehouse } from "@/lib/api";
import { useSession } from "@/lib/useSession";

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

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("inventory.manage") ?? false;
  const warehouseName = (id: number) => warehouses?.find((w) => w.id === id)?.name ?? "—";

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <AppHeader activeMembership={activeMembership} />

      {!activeMembership ? (
        <p style={{ color: "#666" }}>
          Pick an active company on the <a href="/dashboard">dashboard</a> first.
        </p>
      ) : (
        <>
          <h1 style={{ fontSize: 20 }}>Stock counts — {activeMembership.company.name}</h1>
          <p style={{ color: "#666", fontSize: 13 }}>
            <a href="/dashboard/inventory">&larr; Back to Inventory</a>
          </p>
          <p style={{ fontSize: 12, color: "#999", maxWidth: 600 }}>
            Starting a count snapshots every item&apos;s current system quantity for a warehouse.
            Fill in what staff actually counted, then finalize to post one adjustment per line that
            differs — the same audit trail and low-stock alerts as any other stock movement.
          </p>
          {loadError && <p style={{ color: "crimson" }}>{loadError}</p>}

          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Counts
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}></th>
                  <th style={{ padding: "6px 4px" }}>Warehouse</th>
                  <th style={{ padding: "6px 4px" }}>Status</th>
                  <th style={{ padding: "6px 4px" }}>Lines</th>
                  <th style={{ padding: "6px 4px" }}>Completed</th>
                </tr>
              </thead>
              <tbody>
                {counts?.map((c) => (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: "1px solid #eee",
                      background: c.id === selectedId ? "#f5f5f5" : undefined,
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <td style={{ padding: "6px 4px" }}>
                      <input type="radio" checked={c.id === selectedId} onChange={() => setSelectedId(c.id)} />
                    </td>
                    <td style={{ padding: "6px 4px" }}>{warehouseName(c.warehouse)}</td>
                    <td style={{ padding: "6px 4px" }}>
                      <span style={{ color: c.status === "completed" ? "#1565c0" : "#2e7d32", fontWeight: 600 }}>
                        {c.status === "completed" ? "Completed" : "Open"}
                      </span>
                    </td>
                    <td style={{ padding: "6px 4px" }}>{c.lines.length}</td>
                    <td style={{ padding: "6px 4px" }}>{c.completed_at ?? "—"}</td>
                  </tr>
                ))}
                {counts?.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "6px 4px", color: "#999" }}>
                      No stock counts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form
                onSubmit={handleCreateCount}
                style={{ marginTop: 16, display: "flex", gap: 8, maxWidth: 500 }}
              >
                <select
                  required
                  value={newWarehouse}
                  onChange={(e) => setNewWarehouse(e.target.value)}
                  style={{ padding: 8, flex: 1 }}
                >
                  <option value="">Warehouse…</option>
                  {warehouses?.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={createWorking || !newWarehouse} style={{ padding: 8 }}>
                  Start count
                </button>
              </form>
            )}
            {createError && <p style={{ color: "crimson" }}>{createError}</p>}
          </section>

          {selectedCount && (
            <section style={{ marginTop: 40, marginBottom: 40 }}>
              <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
                {warehouseName(selectedCount.warehouse)} — {selectedCount.status === "completed" ? "Completed" : "Open"}
              </h2>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                    <th style={{ padding: "6px 4px" }}>Item</th>
                    <th style={{ padding: "6px 4px" }}>System qty</th>
                    <th style={{ padding: "6px 4px" }}>Counted qty</th>
                    <th style={{ padding: "6px 4px" }}>Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCount.lines.map((line) => (
                    <tr key={line.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "6px 4px" }}>{line.item_name}</td>
                      <td style={{ padding: "6px 4px" }}>{line.system_quantity}</td>
                      <td style={{ padding: "6px 4px" }}>
                        {selectedCount.status === "open" && canManage ? (
                          <input
                            type="number"
                            value={countedValues[line.id] ?? ""}
                            onChange={(e) =>
                              setCountedValues({ ...countedValues, [line.id]: e.target.value })
                            }
                            style={{ padding: 4, width: 100 }}
                          />
                        ) : (
                          line.counted_quantity ?? "—"
                        )}
                      </td>
                      <td
                        style={{
                          padding: "6px 4px",
                          color:
                            line.variance === null || line.variance === 0
                              ? undefined
                              : line.variance < 0
                                ? "#c62828"
                                : "#2e7d32",
                        }}
                      >
                        {line.variance ?? "—"}
                      </td>
                    </tr>
                  ))}
                  {selectedCount.lines.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: "6px 4px", color: "#999" }}>
                        No stock at this warehouse to count.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {canManage && selectedCount.status === "open" && (
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button type="button" disabled={saveWorking} onClick={handleSaveCounts} style={{ padding: "8px 16px" }}>
                    Save counts
                  </button>
                  <button
                    type="button"
                    disabled={finalizeWorking}
                    onClick={handleFinalize}
                    style={{ padding: "8px 16px" }}
                  >
                    Finalize
                  </button>
                </div>
              )}
              {saveError && <p style={{ color: "crimson" }}>{saveError}</p>}
              {finalizeError && <p style={{ color: "crimson" }}>{finalizeError}</p>}
            </section>
          )}
        </>
      )}
    </main>
  );
}
