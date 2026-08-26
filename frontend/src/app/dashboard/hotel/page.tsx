"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type CompanySummary, type Reservation, type RoomStatus } from "@/lib/api";
import { useSession } from "@/lib/useSession";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  available: "Available",
  occupied: "Occupied",
  dirty: "Vacant dirty",
  clean: "Vacant clean",
  inspected: "Inspected",
  out_of_order: "Out of order",
  maintenance: "Maintenance",
};

const ROOM_STATUS_COLORS: Record<RoomStatus, string> = {
  occupied: "var(--brand-green)",
  available: "#4caf82",
  clean: "#2f6f9e",
  dirty: "var(--brand-gold)",
  inspected: "#7c5cbf",
  out_of_order: "#a6392c",
  maintenance: "#d97706",
};

const DEPARTMENT_LABELS: Record<string, string> = {
  room: "Rooms",
  restaurant: "Restaurant",
  bar: "Bar",
  laundry: "Laundry",
  spa: "Spa & Wellness",
  conference: "Conference Hall",
  misc: "Miscellaneous",
};
const DEPARTMENT_ORDER = ["room", "restaurant", "bar", "laundry", "spa", "conference", "misc"];

export default function FrontDeskDashboardPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [summary, setSummary] = useState<CompanySummary | null>(null);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAll() {
      try {
        const [s, r] = await Promise.all([api.companySummary(), api.listReservations()]);
        setSummary(s);
        setReservations(r);
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load the dashboard.");
      }
    }
    if (activeMembership) {
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  const hotel = summary?.hotel;
  const today = todayStr();

  const inHouseCount = useMemo(
    () => (reservations ?? []).filter((r) => r.status === "checked_in").length,
    [reservations]
  );
  const arrivalsToday = useMemo(
    () => (reservations ?? []).filter((r) => r.check_in_date === today && r.status === "confirmed"),
    [reservations, today]
  );
  const departuresToday = useMemo(
    () => (reservations ?? []).filter((r) => r.check_out_date === today && r.status === "checked_in"),
    [reservations, today]
  );

  const roomStatusEntries = useMemo(() => {
    if (!hotel) return [];
    return (Object.entries(hotel.room_status_counts) as [RoomStatus, number][]).filter(([, c]) => c > 0);
  }, [hotel]);
  const roomStatusTotal = roomStatusEntries.reduce((sum, [, c]) => sum + c, 0);

  let cumulative = 0;
  const donutStops = roomStatusEntries.map(([status, count]) => {
    const start = cumulative;
    cumulative += (count / roomStatusTotal) * 100;
    return `${ROOM_STATUS_COLORS[status]} ${start}% ${cumulative}%`;
  });

  const revenueTotal = hotel ? Object.values(hotel.revenue_by_department_cents).reduce((a, b) => a + b, 0) : 0;

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1200, margin: "40px auto", padding: "0 16px 40px" }}>
        <h1 className="page-title">Front Desk Dashboard</h1>
        <p className="page-subtitle">Manage today&apos;s arrivals, departures and guest services — {activeMembership?.company.name}.</p>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        {!hotel ? (
          <p className="page-subtitle" style={{ marginTop: 20 }}>Loading front office data…</p>
        ) : (
          <>
            {/* KPI tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 20 }}>
              <div className="panel">
                <div className="section-label">Occupancy Rate</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{hotel.occupancy_pct}%</div>
                <div style={{ fontSize: 11, color: "#8a8577", marginTop: 4 }}>
                  {hotel.occupied_count} / {hotel.room_count} rooms
                </div>
              </div>
              <div className="panel">
                <div className="section-label">Arrivals Today</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--brand-green)", marginTop: 6 }}>
                  {hotel.today_arrivals}
                </div>
                <div style={{ fontSize: 11, color: "#8a8577", marginTop: 4 }}>Expected check-ins</div>
              </div>
              <div className="panel">
                <div className="section-label">Departures Today</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--brand-gold)", marginTop: 6 }}>
                  {hotel.today_departures}
                </div>
                <div style={{ fontSize: 11, color: "#8a8577", marginTop: 4 }}>Expected check-outs</div>
              </div>
              <div className="panel">
                <div className="section-label">In-House Guests</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{inHouseCount}</div>
                <div style={{ fontSize: 11, color: "#8a8577", marginTop: 4 }}>Currently staying</div>
              </div>
              <Link href="/dashboard/hotel/guest-folios" style={{ textDecoration: "none", color: "inherit" }}>
                <div className="panel" style={{ cursor: "pointer" }}>
                  <div className="section-label">Open Folios</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: hotel.pending_folio_count ? "#a6392c" : undefined, marginTop: 6 }}>
                    {hotel.pending_folio_count}
                  </div>
                  <div style={{ fontSize: 11, color: "#8a8577", marginTop: 4 }}>With a pending balance</div>
                </div>
              </Link>
            </div>

            {/* Room status donut + Today's arrivals/departures */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12, marginTop: 12 }}>
              <div className="panel">
                <h2 className="section-label">Room Status</h2>
                <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", marginTop: 12 }}>
                  <div
                    style={{
                      position: "relative",
                      width: 130,
                      height: 130,
                      borderRadius: "50%",
                      background: roomStatusTotal > 0 ? `conic-gradient(${donutStops.join(", ")})` : "#eee",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 20,
                        borderRadius: "50%",
                        background: "var(--brand-white, #fff)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div style={{ fontSize: 20, fontWeight: 700, color: "var(--brand-green)" }}>{roomStatusTotal}</div>
                      <div style={{ fontSize: 10, color: "#8a8577" }}>Total rooms</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {roomStatusEntries.map(([status, count]) => (
                      <div key={status} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: ROOM_STATUS_COLORS[status] }} />
                        <span style={{ color: "#555" }}>{ROOM_STATUS_LABELS[status]}</span>
                        <strong>{count}</strong>
                        <span style={{ color: "#8a8577" }}>
                          ({roomStatusTotal ? Math.round((count / roomStatusTotal) * 100) : 0}%)
                        </span>
                      </div>
                    ))}
                    {roomStatusEntries.length === 0 && <p className="page-subtitle">No rooms set up yet.</p>}
                  </div>
                </div>
              </div>

              <div className="panel">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h2 className="section-label">Today&apos;s Arrivals ({arrivalsToday.length})</h2>
                  <Link href="/dashboard/hotel/check-in" style={{ fontSize: 12, color: "var(--brand-green)", fontWeight: 600 }}>
                    Go to Check-In
                  </Link>
                </div>
                <div style={{ overflowX: "auto", marginTop: 8 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Guest</th>
                        <th>Room type</th>
                        <th>Confirmation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {arrivalsToday.slice(0, 5).map((r) => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600 }}>{r.guest_name}</td>
                          <td>{r.room_type_name}</td>
                          <td>{r.confirmation_number}</td>
                        </tr>
                      ))}
                      {arrivalsToday.length === 0 && (
                        <tr className="empty-row">
                          <td colSpan={3}>No arrivals expected today.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20 }}>
                  <h2 className="section-label">Today&apos;s Departures ({departuresToday.length})</h2>
                  <Link href="/dashboard/hotel/check-out" style={{ fontSize: 12, color: "var(--brand-green)", fontWeight: 600 }}>
                    Go to Check-Out
                  </Link>
                </div>
                <div style={{ overflowX: "auto", marginTop: 8 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Guest</th>
                        <th>Room</th>
                        <th>Confirmation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departuresToday.slice(0, 5).map((r) => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600 }}>{r.guest_name}</td>
                          <td>{r.room_number ? `Room ${r.room_number}` : "—"}</td>
                          <td>{r.confirmation_number}</td>
                        </tr>
                      ))}
                      {departuresToday.length === 0 && (
                        <tr className="empty-row">
                          <td colSpan={3}>No departures expected today.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Revenue by department + Recent activity */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12, marginTop: 12, marginBottom: 20 }}>
              <div className="panel">
                <h2 className="section-label">Revenue by Department (this month)</h2>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                  {revenueTotal === 0 ? (
                    <p className="page-subtitle">No revenue posted this month yet.</p>
                  ) : (
                    DEPARTMENT_ORDER.filter(
                      (key) => hotel.revenue_by_department_cents[key] > 0 || key === "room" || key === "restaurant"
                    ).map((key) => {
                      const amount = hotel.revenue_by_department_cents[key] ?? 0;
                      const pct = revenueTotal ? Math.round((amount / revenueTotal) * 100) : 0;
                      return (
                        <div key={key}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                            <span>{DEPARTMENT_LABELS[key]}</span>
                            <span style={{ fontWeight: 600 }}>
                              {formatCents(amount)} <span style={{ color: "#8a8577", fontWeight: 400 }}>{pct}%</span>
                            </span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: "#f2f0ea" }}>
                            <div
                              style={{
                                height: 6,
                                borderRadius: 3,
                                background: "var(--brand-gold)",
                                width: `${pct}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #ece9e0", fontSize: 12.5 }}>
                  RevPAR (today): <strong>{formatCents(hotel.revpar_cents)}</strong>
                </div>
              </div>

              <div className="panel">
                <h2 className="section-label">Recent Activity</h2>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                  {hotel.recent_activity.length === 0 && <p className="page-subtitle">No recent room activity.</p>}
                  {hotel.recent_activity.map((item, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, fontSize: 12.5 }}>
                      <div style={{ color: "#8a8577", minWidth: 52 }}>
                        {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div>
                        <strong>{item.label}</strong>
                        <div style={{ color: "#777" }}>
                          Room {item.room_number}
                          {item.changed_by_name ? ` · ${item.changed_by_name}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </ModuleShell>
  );
}
