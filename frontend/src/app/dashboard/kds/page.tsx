"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type KitchenStatus, type PosOrder, type PosOrderLine } from "@/lib/api";
import { useSession } from "@/lib/useSession";

interface BoardLine extends PosOrderLine {
  orderLabel: string;
  isVip: boolean;
}

const COLUMNS: { status: KitchenStatus; title: string; action: string; color: string; sinceField: keyof BoardLine }[] = [
  { status: "queued", title: "Queued", action: "Start preparing", color: "var(--status-warn)", sinceField: "created_at" },
  { status: "preparing", title: "Preparing", action: "Mark ready", color: "#2563eb", sinceField: "started_preparing_at" },
  { status: "ready", title: "Ready", action: "Mark served", color: "var(--status-success)", sinceField: "ready_at" },
];

// Priority queue ordering within a column: rush-flagged lines first, then
// VIP-guest orders, then plain FIFO (oldest first).
function priorityRank(l: BoardLine) {
  if (l.is_rush) return 0;
  if (l.isVip) return 1;
  return 2;
}

function sortByPriority(lines: BoardLine[]) {
  return [...lines].sort((a, b) => {
    const rankDiff = priorityRank(a) - priorityRank(b);
    if (rankDiff !== 0) return rankDiff;
    return a.created_at.localeCompare(b.created_at);
  });
}

function elapsedSeconds(since: string | null, now: number) {
  if (!since) return 0;
  return Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
}

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function KdsPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [lines, setLines] = useState<BoardLine[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  async function loadAll() {
    try {
      const orders = await api.listOrders();
      const board = orders
        .filter((o: PosOrder) => o.status === "open")
        .flatMap((o) =>
          o.lines
            .filter((l) => l.kitchen_status !== "served")
            .map((l) => ({
              ...l,
              orderLabel: o.tab_name ? `Tab: ${o.tab_name}` : o.table_name || `Order #${o.id}`,
              isVip: o.is_vip_guest,
            }))
        );
      setLines(board);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load kitchen display.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  // Live elapsed-time ticker — a plain client-side clock, not a poll of
  // fresh server data (loadAll only re-runs after an actual action).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function handleAdvance(lineId: number, from: KitchenStatus) {
    setWorkingId(lineId);
    setActionError(null);
    try {
      if (from === "queued") await api.startPreparing(lineId);
      else if (from === "preparing") await api.markLineReady(lineId);
      else if (from === "ready") await api.markLineServed(lineId);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update kitchen status.");
    } finally {
      setWorkingId(null);
    }
  }

  async function handleToggleRush(line: BoardLine) {
    setWorkingId(line.id);
    setActionError(null);
    try {
      if (line.is_rush) await api.unmarkLineRush(line.id);
      else await api.markLineRush(line.id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update priority.");
    } finally {
      setWorkingId(null);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("pos.manage") ?? false;

  return (
    <ModuleShell moduleKey="pos" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px" }}>
        <h1 style={{ fontSize: 20, color: "var(--status-success)" }}>
          Kitchen Display — {activeMembership?.company.name}
        </h1>
        {loadError && <p style={{ color: "crimson" }}>{loadError}</p>}
        {actionError && <p style={{ color: "crimson" }}>{actionError}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 24 }}>
          {COLUMNS.map((col) => {
            const columnLines = sortByPriority(lines?.filter((l) => l.kitchen_status === col.status) ?? []);
            return (
              <div key={col.status} style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
                <div
                  style={{
                    padding: "8px 12px",
                    background: col.color,
                    color: "white",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {col.title} ({columnLines.length})
                </div>
                <div style={{ padding: 8, minHeight: 120 }}>
                  {columnLines.map((l) => {
                    const since = (l[col.sinceField] as string | null) ?? l.created_at;
                    const seconds = elapsedSeconds(since, now);
                    const isOverdue =
                      col.status === "preparing" &&
                      l.item_prep_time_minutes != null &&
                      seconds > l.item_prep_time_minutes * 60;
                    return (
                      <div
                        key={l.id}
                        style={{
                          border: l.is_rush ? "2px solid crimson" : isOverdue ? "2px solid #b45309" : "1px solid #eee",
                          borderRadius: 6,
                          padding: 8,
                          marginBottom: 8,
                          fontSize: 13,
                          background: isOverdue && !l.is_rush ? "#fff7ed" : "transparent",
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>
                          {l.quantity}x {l.item_name}
                          {l.is_rush && (
                            <span style={{ color: "crimson", fontSize: 11, marginLeft: 6 }}>RUSH</span>
                          )}
                          {!l.is_rush && l.isVip && (
                            <span style={{ color: "var(--status-warn)", fontSize: 11, marginLeft: 6 }}>VIP</span>
                          )}
                        </div>
                        <div style={{ color: "#999", fontSize: 12 }}>{l.orderLabel}</div>
                        <div style={{ fontSize: 12, marginTop: 2, color: isOverdue ? "#b45309" : "#666" }}>
                          {formatElapsed(seconds)}
                          {col.status === "preparing" && l.item_prep_time_minutes != null && (
                            <> / {l.item_prep_time_minutes}:00 est.</>
                          )}
                          {isOverdue && (
                            <span style={{ fontWeight: 600, marginLeft: 4 }}>OVERDUE</span>
                          )}
                        </div>
                        {canManage && (
                          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                            <button
                              onClick={() => handleAdvance(l.id, col.status)}
                              disabled={workingId === l.id}
                              style={{ padding: "4px 8px", fontSize: 12 }}
                            >
                              {col.action}
                            </button>
                            <button
                              onClick={() => handleToggleRush(l)}
                              disabled={workingId === l.id}
                              style={{ padding: "4px 8px", fontSize: 12 }}
                            >
                              {l.is_rush ? "Unrush" : "Rush"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {columnLines.length === 0 && (
                    <p style={{ color: "#999", fontSize: 12, margin: 0 }}>Nothing here.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </ModuleShell>
  );
}
