"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type GuestFolio, type Reservation } from "@/lib/api";
import { useSession } from "@/lib/useSession";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function InvoicesPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [folios, setFolios] = useState<GuestFolio[] | null>(null);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  async function loadAll() {
    try {
      const [f, r] = await Promise.all([api.listFolios(), api.listReservations()]);
      setFolios(f);
      setReservations(r);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load invoices.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const reservationFor = (id: number) => reservations?.find((r) => r.id === id) ?? null;
  const filtered = (folios ?? [])
    .filter((f) => !statusFilter || f.status === statusFilter)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1000, margin: "40px auto", padding: "0 16px 40px" }}>
        <h1 className="page-title">Invoices</h1>
        <p className="page-subtitle">Printable/downloadable invoices generated from each guest folio.</p>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        <div className="panel" style={{ marginTop: 20 }}>
          <select
            className="field-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ maxWidth: 180, marginBottom: 16 }}
          >
            <option value="">All folios</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Confirmation</th>
                  <th>Guest</th>
                  <th>Status</th>
                  <th>Balance</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((folio) => {
                  const reservation = reservationFor(folio.reservation);
                  return (
                    <tr key={folio.id}>
                      <td>{reservation?.confirmation_number ?? `Reservation #${folio.reservation}`}</td>
                      <td style={{ fontWeight: 600 }}>{reservation?.guest_name ?? "—"}</td>
                      <td>
                        <span className={`badge ${folio.status === "open" ? "badge-gold" : "badge-gray"}`}>{folio.status}</span>
                      </td>
                      <td>
                        <span className={`badge ${folio.balance_cents > 0 ? "badge-red" : "badge-green"}`}>
                          {formatCents(folio.balance_cents)}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <a href={api.folioPdfUrl(folio.id)} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                          Download PDF
                        </a>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={5}>No folios match this filter.</td>
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
