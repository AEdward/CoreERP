"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { Modal } from "@/components/Modal";
import { IconPlus } from "@/components/icons";
import { api, ApiError, type GuestFolio, type GuestPayment, type Reservation } from "@/lib/api";
import { useSession } from "@/lib/useSession";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const METHOD_LABELS: Record<GuestPayment["method"], string> = {
  cash: "Cash",
  card: "Card",
  mobile_money: "Mobile money",
  bank_transfer: "Bank transfer",
};

export default function PaymentsPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [payments, setPayments] = useState<GuestPayment[] | null>(null);
  const [folios, setFolios] = useState<GuestFolio[] | null>(null);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [folioId, setFolioId] = useState("");
  const [method, setMethod] = useState<GuestPayment["method"]>("cash");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [working, setWorking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function loadAll() {
    try {
      const [p, f, r] = await Promise.all([api.listGuestPayments(), api.listFolios(), api.listReservations()]);
      setPayments(p);
      setFolios(f);
      setReservations(r);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load payments.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  function guestNameForFolio(folioId: number) {
    const folio = folios?.find((f) => f.id === folioId);
    const reservation = reservations?.find((r) => r.id === folio?.reservation);
    return reservation?.guest_name ?? `Folio #${folioId}`;
  }

  function startAdd() {
    setFolioId("");
    setMethod("cash");
    setAmount("");
    setReference("");
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
      await api.createGuestPayment({
        folio: Number(folioId),
        method,
        amount_cents: Math.round(Number(amount || 0) * 100),
        reference,
      });
      closeModal();
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to record payment.");
    } finally {
      setWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hotel.manage") ?? false;
  const openFolios = folios?.filter((f) => f.status === "open") ?? [];
  const sortedPayments = [...(payments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px 40px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 className="page-title">Payments</h1>
            <p className="page-subtitle">Payments recorded against guest folios — settling their running balance.</p>
          </div>
          {canManage && (
            <button type="button" className="btn btn-primary" style={{ flexShrink: 0 }} onClick={startAdd}>
              <IconPlus size={16} />
              Record Payment
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
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Reference</th>
                  <th>Received by</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {sortedPayments.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{guestNameForFolio(p.folio)}</td>
                    <td>{METHOD_LABELS[p.method]}</td>
                    <td>
                      <span className="badge badge-green">{formatCents(p.amount_cents)}</span>
                    </td>
                    <td>{p.reference || "—"}</td>
                    <td>{p.received_by_name || "—"}</td>
                    <td>{new Date(p.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {sortedPayments.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={6}>No payments recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {canManage && showModal && (
          <Modal title="Record a payment" onClose={closeModal}>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <select className="field-select" required value={folioId} onChange={(e) => setFolioId(e.target.value)}>
                <option value="">Open folio…</option>
                {openFolios.map((f) => (
                  <option key={f.id} value={f.id}>
                    {guestNameForFolio(f.id)} — balance {formatCents(f.balance_cents)}
                  </option>
                ))}
              </select>
              <select className="field-select" value={method} onChange={(e) => setMethod(e.target.value as GuestPayment["method"])}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="mobile_money">Mobile money</option>
                <option value="bank_transfer">Bank transfer</option>
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
                placeholder="Reference (optional)"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button type="submit" className="btn btn-primary" disabled={working || !folioId || !amount}>
                  Record payment
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
