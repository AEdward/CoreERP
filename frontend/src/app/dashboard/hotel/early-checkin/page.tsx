"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type Reservation } from "@/lib/api";
import { useSession } from "@/lib/useSession";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function EarlyCheckInPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<number | null>(null);

  async function loadAll() {
    try {
      setReservations(await api.listReservations());
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

  async function handleApprove(id: number) {
    setWorkingId(id);
    setLoadError(null);
    try {
      await api.approveEarlyCheckin(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to approve early check-in.");
    } finally {
      setWorkingId(null);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hotel.manage") ?? false;
  const today = todayStr();
  const queue = (reservations ?? [])
    .filter((r) => r.status === "confirmed" && !r.early_checkin_approved && r.check_in_date >= today)
    .sort((a, b) => a.check_in_date.localeCompare(b.check_in_date));

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1000, margin: "40px auto", padding: "0 16px 40px" }}>
        <h1 className="page-title">Early Check-In</h1>
        <p className="page-subtitle">Confirmed reservations requesting an early check-in, subject to the room being ready.</p>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        <div className="panel" style={{ marginTop: 20 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Confirmation</th>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Check-in date</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {queue.map((r) => (
                  <tr key={r.id} style={{ background: r.check_in_date === today ? "var(--brand-ivory)" : undefined }}>
                    <td>{r.confirmation_number}</td>
                    <td style={{ fontWeight: 600 }}>{r.guest_name}</td>
                    <td>{r.room_number ? `Room ${r.room_number}` : "Unassigned"}</td>
                    <td>
                      {r.check_in_date}
                      {r.check_in_date === today && <span className="badge badge-gold" style={{ marginLeft: 8 }}>Today</span>}
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleApprove(r.id)}
                          disabled={workingId === r.id}
                        >
                          Approve early check-in
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {queue.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={5}>No confirmed reservations awaiting early check-in approval.</td>
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
