"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { ModuleShell } from "@/components/ModuleShell";
import { IconPlus } from "@/components/icons";
import { api, ApiError, type GuestFolio, type GuestRefund, type Reservation } from "@/lib/api";
import { useSession } from "@/lib/useSession";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function RefundsPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [refunds, setRefunds] = useState<GuestRefund[] | null>(null);
  const [folios, setFolios] = useState<GuestFolio[] | null>(null);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [folioId, setFolioId] = useState("");
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function loadAll() {
    try {
      const [rf, f, r] = await Promise.all([api.listGuestRefunds(), api.listFolios(), api.listReservations()]);
      setRefunds(rf);
      setFolios(f);
      setReservations(r);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load refunds.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  function guestNameForFolio(id: number) {
    const folio = folios?.find((f) => f.id === id);
    const reservation = reservations?.find((r) => r.id === folio?.reservation);
    return reservation?.guest_name ?? `Folio #${id}`;
  }

  const selectedFolio = useMemo(() => folios?.find((f) => String(f.id) === folioId) ?? null, [folios, folioId]);

  function startAdd() {
    setFolioId("");
    setPaymentId("");
    setAmount("");
    setReason("");
    setFormError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setFormError(null);
    try {
      await api.createGuestRefund({
        folio: Number(folioId),
        payment: paymentId ? Number(paymentId) : null,
        amount_cents: Math.round(Number(amount || 0) * 100),
        reason,
      });
      closeModal();
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to issue refund.");
    } finally {
      setWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hotel.manage") ?? false;
  const sortedRefunds = [...(refunds ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px 40px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 className="page-title">Refunds</h1>
            <p className="page-subtitle">Refunds issued against a guest folio, optionally linked to the original payment.</p>
          </div>
          {canManage && (
            <button type="button" className="btn btn-primary" style={{ flexShrink: 0 }} onClick={startAdd}>
              <IconPlus size={16} />
              Issue Refund
            </button>
          )}
        </div>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        <div className="panel" style={{ marginTop: 20 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Amount</th>
                  <th>Reason</th>
                  <th>Linked payment</th>
                  <th>Issued by</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {sortedRefunds.map((rf) => (
                  <tr key={rf.id}>
                    <td style={{ fontWeight: 600 }}>{guestNameForFolio(rf.folio)}</td>
                    <td>
                      <span className="badge badge-red">{formatCents(rf.amount_cents)}</span>
                    </td>
                    <td>{rf.reason || "—"}</td>
                    <td>{rf.payment ? `Payment #${rf.payment}` : "—"}</td>
                    <td>{rf.issued_by_name || "—"}</td>
                    <td>{new Date(rf.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {sortedRefunds.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={6}>No refunds issued yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {canManage && showModal && (
          <Modal title="Issue a refund" onClose={closeModal}>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <select
                className="field-select"
                required
                value={folioId}
                onChange={(e) => {
                  setFolioId(e.target.value);
                  setPaymentId("");
                }}
              >
                <option value="">Folio…</option>
                {folios?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {guestNameForFolio(f.id)} — balance {formatCents(f.balance_cents)}
                  </option>
                ))}
              </select>
              <select
                className="field-select"
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                disabled={!selectedFolio}
              >
                <option value="">No specific payment (optional)</option>
                {selectedFolio?.payments.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.method} — {formatCents(p.amount_cents)}
                    {p.reference ? ` (${p.reference})` : ""}
                  </option>
                ))}
              </select>
              <input
                className="field-input"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Amount"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <input
                className="field-input"
                placeholder="Reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button type="submit" className="btn btn-primary" disabled={working || !folioId || !amount}>
                  Issue refund
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
              </div>
              {formError && <p className="error-text" style={{ margin: 0 }}>{formError}</p>}
            </form>
          </Modal>
        )}
      </main>
    </ModuleShell>
  );
}
