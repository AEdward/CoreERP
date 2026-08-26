"use client";

import { useEffect, useMemo, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type Reservation, type Room, type RoomBlock } from "@/lib/api";
import { useSession } from "@/lib/useSession";

const DAYS_IN_WINDOW = 14;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatShort(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

type CellState = "available" | "reserved" | "blocked";

export default function RoomAvailabilityPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [blocks, setBlocks] = useState<RoomBlock[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rangeStart, setRangeStart] = useState(todayStr());

  async function loadAll() {
    try {
      const [rm, res, bl] = await Promise.all([api.listRooms(), api.listReservations(), api.listRoomBlocks()]);
      setRooms(rm);
      setReservations(res);
      setBlocks(bl);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load room availability.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  const dates = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < DAYS_IN_WINDOW; i++) out.push(addDays(rangeStart, i));
    return out;
  }, [rangeStart]);

  const activeReservations = useMemo(
    () => (reservations ?? []).filter((r) => r.status === "confirmed" || r.status === "checked_in"),
    [reservations]
  );

  function cellState(roomId: number, date: string): CellState {
    const reserved = activeReservations.some((r) => r.room === roomId && date >= r.check_in_date && date < r.check_out_date);
    if (reserved) return "reserved";
    const blocked = (blocks ?? []).some((b) => b.room === roomId && date >= b.start_date && date <= b.end_date);
    if (blocked) return "blocked";
    return "available";
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const sortedRooms = [...(rooms ?? [])].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1200, margin: "40px auto", padding: "0 16px 40px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 className="page-title">Room Availability</h1>
            <p className="page-subtitle">A {DAYS_IN_WINDOW}-day grid of which rooms are free, reserved, or blocked.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRangeStart((d) => addDays(d, -DAYS_IN_WINDOW))}>
              ← Previous
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRangeStart(todayStr())}>
              Today
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRangeStart((d) => addDays(d, DAYS_IN_WINDOW))}>
              Next →
            </button>
          </div>
        </div>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 13, color: "#555" }}>
          <span><span className="badge badge-green" style={{ marginRight: 6 }}>&nbsp;</span>Available</span>
          <span><span className="badge badge-gold" style={{ marginRight: 6 }}>&nbsp;</span>Reserved / Occupied</span>
          <span><span className="badge badge-red" style={{ marginRight: 6 }}>&nbsp;</span>Blocked</span>
        </div>

        <div className="panel" style={{ marginTop: 14 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ position: "sticky", left: 0, background: "var(--panel-bg, #fff)" }}>Room</th>
                  {dates.map((d) => (
                    <th key={d} style={{ textAlign: "center", whiteSpace: "nowrap", fontWeight: d === todayStr() ? 700 : 500 }}>
                      {formatShort(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRooms.map((room) => (
                  <tr key={room.id}>
                    <td style={{ fontWeight: 600, position: "sticky", left: 0, background: "var(--panel-bg, #fff)" }}>
                      Room {room.number}
                      <div style={{ fontSize: 11, color: "#888", fontWeight: 400 }}>{room.room_type_name}</div>
                    </td>
                    {dates.map((d) => {
                      const state = cellState(room.id, d);
                      const bg = state === "reserved" ? "#f4d35e" : state === "blocked" ? "#e07a5f" : "#8fbf8f";
                      return (
                        <td key={d} style={{ textAlign: "center", padding: 4 }}>
                          <div style={{ width: "100%", height: 22, borderRadius: 4, background: bg, opacity: state === "available" ? 0.35 : 0.85 }} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {sortedRooms.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={DAYS_IN_WINDOW + 1}>No rooms configured.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </ModuleShell>
  );
}
