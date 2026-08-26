"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type Reservation } from "@/lib/api";
import { useSession } from "@/lib/useSession";

export default function LateCheckOutPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [feeInputs, setFeeInputs] = useState<Record<number, string>>({});

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
    const feeStr = feeInputs[id];
    const feeCents = feeStr ? Math.round(parseFloat(feeStr) * 100) : 0;
    try {
      await api.approveLateCheckout(id, feeCents);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to approve late check-out.");
    } finally {
      setWorkingId(null);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hotel.manage") ?? false;
  const queue = (reservations ?? [])
    .filter((r) => r.status === "checked_in" && !r.late_checkout_approved)
    .sort((a, b) => a.check_out_date.localeCompare(b.check_out_date));

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px 40px" }}>
        <h1 className="page-title">Late Check-Out</h1>
        <p className="page-subtitle">Checked-in guests requesting a late check-out, with an optional fee posted to the folio.</p>
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
                  {canManage && <th>Fee</th>}
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {queue.map((r) => (
                  <tr key={r.id}>
                    <td>{r.confirmation_number}</td>
                    <td style={{ fontWeight: 600 }}>{r.guest_name}</td>
                    <td>{r.room_number ? `Room ${r.room_number}` : "Unassigned"}</td>
                    <td>{r.check_out_date}</td>
                    {canManage && (
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className="field-input"
                          style={{ width: 100 }}
                          value={feeInputs[r.id] ?? ""}
                          onChange={(e) => setFeeInputs((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        />
                      </td>
                    )}
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleApprove(r.id)}
                          disabled={workingId === r.id}
                        >
                          Approve late check-out
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {queue.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={6}>No checked-in guests awaiting late check-out approval.</td>
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
