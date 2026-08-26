"use client";

import { useEffect, useMemo, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type Reservation } from "@/lib/api";
import { useSession } from "@/lib/useSession";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const SOURCE_LABELS: Record<Reservation["source"], string> = {
  website: "Website",
  walk_in: "Walk-in",
  phone: "Phone",
  travel_agency: "Travel agency",
  group: "Group",
};

const STATUS_LABELS: Record<Reservation["status"], string> = {
  confirmed: "Confirmed",
  checked_in: "Checked in",
  checked_out: "Checked out",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export default function ReservationReportPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    async function loadAll() {
      try {
        setReservations(await api.listReservations());
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load the reservation report.");
      }
    }
    if (activeMembership) {
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  const filtered = useMemo(() => {
    return (reservations ?? [])
      .filter((r) => !fromDate || r.check_in_date >= fromDate)
      .filter((r) => !toDate || r.check_in_date <= toDate)
      .filter((r) => !sourceFilter || r.source === sourceFilter)
      .filter((r) => !statusFilter || r.status === statusFilter)
      .sort((a, b) => b.check_in_date.localeCompare(a.check_in_date));
  }, [reservations, fromDate, toDate, sourceFilter, statusFilter]);

  const stats = useMemo(() => {
    const totalRevenueCents = filtered.reduce((sum, r) => sum + r.rate_cents, 0);
    const totalCommissionCents = filtered.reduce((sum, r) => sum + r.commission_cents, 0);
    const nights = filtered.reduce((sum, r) => {
      const inD = new Date(r.check_in_date + "T00:00:00");
      const outD = new Date(r.check_out_date + "T00:00:00");
      return sum + Math.max(0, Math.round((outD.getTime() - inD.getTime()) / 86400000));
    }, 0);
    const bySource: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    for (const r of filtered) {
      bySource[r.source] = (bySource[r.source] ?? 0) + 1;
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    }
    return {
      count: filtered.length,
      totalRevenueCents,
      totalCommissionCents,
      avgLengthOfStay: filtered.length ? nights / filtered.length : 0,
      bySource,
      byStatus,
    };
  }, [filtered]);

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1200, margin: "40px auto", padding: "0 16px 40px" }}>
        <h1 className="page-title">Reservation Report</h1>
        <p className="page-subtitle">Reservations filtered by check-in date range, source, and status.</p>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        <div className="panel" style={{ marginTop: 20 }}>
          <div className="field-row" style={{ flexWrap: "wrap" }}>
            <input type="date" className="field-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <input type="date" className="field-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            <select className="field-select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              <option value="">All sources</option>
              {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select className="field-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 12 }}>
          <div className="panel">
            <div className="section-label">Reservations</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{stats.count}</div>
          </div>
          <div className="panel">
            <div className="section-label">Room Revenue</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--brand-green)", marginTop: 6 }}>
              {formatCents(stats.totalRevenueCents)}
            </div>
          </div>
          <div className="panel">
            <div className="section-label">Commission Paid</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{formatCents(stats.totalCommissionCents)}</div>
          </div>
          <div className="panel">
            <div className="section-label">Avg. Length of Stay</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{stats.avgLengthOfStay.toFixed(1)} nights</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 12 }}>
          <div className="panel">
            <h2 className="section-label">By Source</h2>
            <table className="data-table" style={{ marginTop: 8 }}>
              <tbody>
                {Object.entries(stats.bySource).map(([source, count]) => (
                  <tr key={source}>
                    <td>{SOURCE_LABELS[source as Reservation["source"]] ?? source}</td>
                    <td>{count}</td>
                  </tr>
                ))}
                {Object.keys(stats.bySource).length === 0 && (
                  <tr className="empty-row"><td colSpan={2}>No data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="panel">
            <h2 className="section-label">By Status</h2>
            <table className="data-table" style={{ marginTop: 8 }}>
              <tbody>
                {Object.entries(stats.byStatus).map(([status, count]) => (
                  <tr key={status}>
                    <td>{STATUS_LABELS[status as Reservation["status"]] ?? status}</td>
                    <td>{count}</td>
                  </tr>
                ))}
                {Object.keys(stats.byStatus).length === 0 && (
                  <tr className="empty-row"><td colSpan={2}>No data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 12 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Confirmation</th>
                  <th>Guest</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.confirmation_number}</td>
                    <td style={{ fontWeight: 600 }}>{r.guest_name}</td>
                    <td>{SOURCE_LABELS[r.source]}</td>
                    <td>{STATUS_LABELS[r.status]}</td>
                    <td>{r.check_in_date}</td>
                    <td>{r.check_out_date}</td>
                    <td>{formatCents(r.rate_cents)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={7}>No reservations match these filters.</td>
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
