"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type CompanySummary, type RoomStatus } from "@/lib/api";
import { useSession } from "@/lib/useSession";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

export default function OccupancyReportPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [summary, setSummary] = useState<CompanySummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAll() {
      try {
        setSummary(await api.companySummary());
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load the occupancy report.");
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

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px 40px" }}>
        <h1 className="page-title">Occupancy Report</h1>
        <p className="page-subtitle">Current occupancy and room status breakdown.</p>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        {!hotel ? (
          <p className="page-subtitle" style={{ marginTop: 20 }}>Loading…</p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 20 }}>
              <div className="panel">
                <div className="section-label">Occupancy Rate</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{hotel.occupancy_pct}%</div>
              </div>
              <div className="panel">
                <div className="section-label">Occupied Rooms</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
                  {hotel.occupied_count} / {hotel.room_count}
                </div>
              </div>
              <div className="panel">
                <div className="section-label">RevPAR (today)</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "var(--brand-green)", marginTop: 6 }}>
                  {formatCents(hotel.revpar_cents)}
                </div>
              </div>
            </div>

            <div className="panel" style={{ marginTop: 12 }}>
              <h2 className="section-label">Rooms by Status</h2>
              <div style={{ overflowX: "auto", marginTop: 10 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Rooms</th>
                      <th>% of total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.entries(hotel.room_status_counts) as [RoomStatus, number][])
                      .filter(([, count]) => count > 0)
                      .map(([status, count]) => (
                        <tr key={status}>
                          <td style={{ fontWeight: 600 }}>{ROOM_STATUS_LABELS[status]}</td>
                          <td>{count}</td>
                          <td>{hotel.room_count ? Math.round((count / hotel.room_count) * 100) : 0}%</td>
                        </tr>
                      ))}
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
