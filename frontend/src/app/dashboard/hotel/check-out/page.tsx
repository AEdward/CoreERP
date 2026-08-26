"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type GuestFolio, type Reservation } from "@/lib/api";
import { useSession } from "@/lib/useSession";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function CheckOutPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [folios, setFolios] = useState<GuestFolio[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<number | null>(null);

  async function loadAll() {
    try {
      const [r, f] = await Promise.all([api.listReservations(), api.listFolios()]);
      setReservations(r);
      setFolios(f);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load reservations.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleCheckOut(id: number) {
    setWorkingId(id);
    setLoadError(null);
    try {
      await api.checkOutReservation(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to check out.");
    } finally {
      setWorkingId(null);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hotel.manage") ?? false;
  const today = todayStr();
  const folioFor = (reservationId: number) => folios?.find((f) => f.reservation === reservationId) ?? null;
  const queue = (reservations ?? [])
    .filter((r) => r.status === "checked_in")
    .sort((a, b) => a.check_out_date.localeCompare(b.check_out_date));

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1000, margin: "40px auto", padding: "0 16px 40px" }}>
        <h1 className="page-title">Check-Out</h1>
        <p className="page-subtitle">Checked-in guests, earliest departure first — settle the folio balance before checking out.</p>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        <div className="panel" style={{ marginTop: 20 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Confirmation</th>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Check-out date</th>
                  <th>Folio balance</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {queue.map((r) => {
                  const folio = folioFor(r.id);
                  return (
                    <tr key={r.id} style={{ background: r.check_out_date === today ? "var(--brand-ivory)" : undefined }}>
                      <td>{r.confirmation_number}</td>
                      <td style={{ fontWeight: 600 }}>{r.guest_name}</td>
                      <td>{r.room_number ? `Room ${r.room_number}` : "—"}</td>
                      <td>
                        {r.check_out_date}
                        {r.check_out_date === today && <span className="badge badge-gold" style={{ marginLeft: 8 }}>Today</span>}
                      </td>
                      <td>
                        {folio ? (
                          <span className={`badge ${folio.balance_cents > 0 ? "badge-red" : "badge-green"}`}>
                            {formatCents(folio.balance_cents)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      {canManage && (
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleCheckOut(r.id)}
                            disabled={workingId === r.id}
                          >
                            Check out
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {queue.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={6}>No checked-in guests waiting to check out.</td>
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
