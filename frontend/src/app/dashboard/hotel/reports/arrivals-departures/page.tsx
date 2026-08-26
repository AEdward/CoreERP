"use client";

import { useEffect, useMemo, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type Reservation } from "@/lib/api";
import { useSession } from "@/lib/useSession";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function ArrivalDepartureReportPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());

  useEffect(() => {
    async function loadAll() {
      try {
        setReservations(await api.listReservations());
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load the report.");
      }
    }
    if (activeMembership) {
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  const arrivals = useMemo(
    () => (reservations ?? []).filter((r) => r.check_in_date >= from && r.check_in_date <= to).sort((a, b) => a.check_in_date.localeCompare(b.check_in_date)),
    [reservations, from, to]
  );
  const departures = useMemo(
    () => (reservations ?? []).filter((r) => r.check_out_date >= from && r.check_out_date <= to).sort((a, b) => a.check_out_date.localeCompare(b.check_out_date)),
    [reservations, from, to]
  );

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px 40px" }}>
        <h1 className="page-title">Arrival &amp; Departure Report</h1>
        <p className="page-subtitle">Reservations arriving or departing within a date range.</p>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        <div className="panel" style={{ marginTop: 20 }}>
          <div className="field-row">
            <input className="field-input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
            <input className="field-input" type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div className="panel">
            <h2 className="section-label">Arrivals ({arrivals.length})</h2>
            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Room type</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {arrivals.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.guest_name}</td>
                      <td>{r.room_type_name}</td>
                      <td>{r.check_in_date}</td>
                      <td>{r.status.replace("_", " ")}</td>
                    </tr>
                  ))}
                  {arrivals.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={4}>No arrivals in this range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <h2 className="section-label">Departures ({departures.length})</h2>
            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Room</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {departures.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.guest_name}</td>
                      <td>{r.room_number ? `Room ${r.room_number}` : "—"}</td>
                      <td>{r.check_out_date}</td>
                      <td>{r.status.replace("_", " ")}</td>
                    </tr>
                  ))}
                  {departures.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={4}>No departures in this range.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </ModuleShell>
  );
}
