"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type CompanySummary, type GuestPayment, type GuestRefund, type Reservation } from "@/lib/api";
import { useSession } from "@/lib/useSession";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyFrontOfficeReportPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [summary, setSummary] = useState<CompanySummary | null>(null);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [payments, setPayments] = useState<GuestPayment[] | null>(null);
  const [refunds, setRefunds] = useState<GuestRefund[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAll() {
      try {
        const [s, r, p, rf] = await Promise.all([
          api.companySummary(),
          api.listReservations(),
          api.listGuestPayments(),
          api.listGuestRefunds(),
        ]);
        setSummary(s);
        setReservations(r);
        setPayments(p);
        setRefunds(rf);
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load the daily front office report.");
      }
    }
    if (activeMembership) {
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const hotel = summary?.hotel;
  const today = todayStr();
  const arrivals = (reservations ?? []).filter((r) => r.check_in_date === today && r.status !== "cancelled");
  const departures = (reservations ?? []).filter((r) => r.check_out_date === today && r.status !== "cancelled");
  const noShowsToday = (reservations ?? []).filter((r) => r.check_in_date === today && r.status === "no_show");
  const paymentsToday = (payments ?? []).filter((p) => p.created_at.slice(0, 10) === today);
  const refundsToday = (refunds ?? []).filter((r) => r.created_at.slice(0, 10) === today);
  const totalPaymentsCents = paymentsToday.reduce((sum, p) => sum + p.amount_cents, 0);
  const totalRefundsCents = refundsToday.reduce((sum, r) => sum + r.amount_cents, 0);

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px 40px" }}>
        <h1 className="page-title">Daily Front Office Report</h1>
        <p className="page-subtitle">End-of-day summary for {today} — arrivals, departures, occupancy, and folio activity.</p>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        {!hotel ? (
          <p className="page-subtitle" style={{ marginTop: 20 }}>Loading…</p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 20 }}>
              <div className="panel">
                <div className="section-label">Occupancy</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{hotel.occupancy_pct}%</div>
              </div>
              <div className="panel">
                <div className="section-label">Arrivals Today</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{arrivals.length}</div>
              </div>
              <div className="panel">
                <div className="section-label">Departures Today</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{departures.length}</div>
              </div>
              <div className="panel">
                <div className="section-label">No-Shows Today</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{noShowsToday.length}</div>
              </div>
              <div className="panel">
                <div className="section-label">Payments Received</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--brand-green)", marginTop: 6 }}>
                  {formatCents(totalPaymentsCents)}
                </div>
              </div>
              <div className="panel">
                <div className="section-label">Refunds Issued</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{formatCents(totalRefundsCents)}</div>
              </div>
              <div className="panel">
                <div className="section-label">Open Folios</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{hotel.pending_folio_count}</div>
              </div>
            </div>

            <div className="panel" style={{ marginTop: 12 }}>
              <h2 className="section-label">Revenue by Department (today)</h2>
              <table className="data-table" style={{ marginTop: 8 }}>
                <tbody>
                  {Object.entries(hotel.revenue_by_department_cents).map(([dept, cents]) => (
                    <tr key={dept}>
                      <td style={{ textTransform: "capitalize" }}>{dept}</td>
                      <td>{formatCents(cents)}</td>
                    </tr>
                  ))}
                  {Object.keys(hotel.revenue_by_department_cents).length === 0 && (
                    <tr className="empty-row"><td colSpan={2}>No revenue recorded today.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12, marginTop: 12 }}>
              <div className="panel">
                <h2 className="section-label">Arrivals</h2>
                <div style={{ overflowX: "auto", marginTop: 8 }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>Guest</th><th>Room</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {arrivals.map((r) => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600 }}>{r.guest_name}</td>
                          <td>{r.room_number ? `Room ${r.room_number}` : "Unassigned"}</td>
                          <td>{r.status.replace("_", " ")}</td>
                        </tr>
                      ))}
                      {arrivals.length === 0 && <tr className="empty-row"><td colSpan={3}>No arrivals today.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="panel">
                <h2 className="section-label">Departures</h2>
                <div style={{ overflowX: "auto", marginTop: 8 }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>Guest</th><th>Room</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {departures.map((r) => (
                        <tr key={r.id}>
                          <td style={{ fontWeight: 600 }}>{r.guest_name}</td>
                          <td>{r.room_number ? `Room ${r.room_number}` : "Unassigned"}</td>
                          <td>{r.status.replace("_", " ")}</td>
                        </tr>
                      ))}
                      {departures.length === 0 && <tr className="empty-row"><td colSpan={3}>No departures today.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="panel" style={{ marginTop: 12 }}>
              <h2 className="section-label">Recent Activity</h2>
              <div style={{ overflowX: "auto", marginTop: 8 }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Event</th><th>Room</th><th>By</th><th>When</th></tr>
                  </thead>
                  <tbody>
                    {hotel.recent_activity.map((a, i) => (
                      <tr key={i}>
                        <td>{a.label}</td>
                        <td>{a.room_number ? `Room ${a.room_number}` : "—"}</td>
                        <td>{a.changed_by_name ?? "—"}</td>
                        <td>{new Date(a.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                    {hotel.recent_activity.length === 0 && (
                      <tr className="empty-row"><td colSpan={4}>No recent activity.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </ModuleShell>
  );
}
