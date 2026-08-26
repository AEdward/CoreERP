"use client";

import { useEffect, useMemo, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { Modal } from "@/components/Modal";
import { IconPlus } from "@/components/icons";
import { api, ApiError, type Reservation, type Room } from "@/lib/api";
import { useSession } from "@/lib/useSession";

export default function RoomTransfersPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [reservationId, setReservationId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function loadAll() {
    try {
      const [r, rm] = await Promise.all([api.listReservations(), api.listRooms()]);
      setReservations(r);
      setRooms(rm);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load room transfers.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  const transferLog = useMemo(() => {
    const rows: { id: number; confirmation: string; guestName: string; from: string; to: string; reason: string; createdAt: string }[] = [];
    for (const r of reservations ?? []) {
      for (const t of r.room_transfers) {
        rows.push({
          id: t.id,
          confirmation: r.confirmation_number,
          guestName: r.guest_name,
          from: t.from_room_number,
          to: t.to_room_number,
          reason: t.reason,
          createdAt: t.created_at,
        });
      }
    }
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [reservations]);

  const checkedInReservations = (reservations ?? []).filter((r) => r.status === "checked_in");

  function startAdd() {
    setReservationId("");
    setRoomId("");
    setReason("");
    setFormError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
  }

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setFormError(null);
    try {
      await api.transferReservationRoom(Number(reservationId), Number(roomId), reason);
      closeModal();
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to transfer room.");
    } finally {
      setWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hotel.manage") ?? false;
  const currentReservation = reservations?.find((r) => String(r.id) === reservationId) ?? null;

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1000, margin: "40px auto", padding: "0 16px 40px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 className="page-title">Room Transfers</h1>
            <p className="page-subtitle">Mid-stay room moves — an audit trail across every reservation.</p>
          </div>
          {canManage && (
            <button type="button" className="btn btn-primary" style={{ flexShrink: 0 }} onClick={startAdd}>
              <IconPlus size={16} />
              New Transfer
            </button>
          )}
        </div>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        <div className="panel" style={{ marginTop: 20 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Confirmation</th>
                  <th>Guest</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Reason</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {transferLog.map((t) => (
                  <tr key={t.id}>
                    <td>{t.confirmation}</td>
                    <td style={{ fontWeight: 600 }}>{t.guestName}</td>
                    <td>Room {t.from}</td>
                    <td>Room {t.to}</td>
                    <td>{t.reason || "—"}</td>
                    <td>{new Date(t.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {transferLog.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={6}>No room transfers recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {canManage && showModal && (
          <Modal title="Transfer a guest to another room" onClose={closeModal}>
            <form onSubmit={handleTransfer} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <select
                className="field-select"
                required
                value={reservationId}
                onChange={(e) => {
                  setReservationId(e.target.value);
                  setRoomId("");
                }}
              >
                <option value="">Checked-in reservation…</option>
                {checkedInReservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.confirmation_number} — {r.guest_name} — Room {r.room_number}
                  </option>
                ))}
              </select>
              <select
                className="field-select"
                required
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                disabled={!currentReservation}
              >
                <option value="">Move to room…</option>
                {rooms
                  ?.filter((room) => room.id !== currentReservation?.room)
                  .map((room) => (
                    <option key={room.id} value={room.id}>
                      Room {room.number} ({room.status.replace("_", " ")})
                    </option>
                  ))}
              </select>
              <input
                className="field-input"
                placeholder="Reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button type="submit" className="btn btn-primary" disabled={working || !reservationId || !roomId}>
                  Transfer
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
