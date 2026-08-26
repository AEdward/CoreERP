"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { Modal } from "@/components/Modal";
import { IconPlus } from "@/components/icons";
import { api, ApiError, type Room, type RoomBlock } from "@/lib/api";
import { useSession } from "@/lib/useSession";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function RoomBlockingPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [blocks, setBlocks] = useState<RoomBlock[] | null>(null);
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [roomId, setRoomId] = useState("");
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function loadAll() {
    try {
      const [b, rm] = await Promise.all([api.listRoomBlocks(), api.listRooms()]);
      setBlocks(b);
      setRooms(rm);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load room blocks.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  function startAdd() {
    setRoomId("");
    setStartDate(todayStr());
    setEndDate(todayStr());
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
      await api.createRoomBlock({ room: Number(roomId), start_date: startDate, end_date: endDate, reason });
      closeModal();
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create room block.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    setLoadError(null);
    try {
      await api.deleteRoomBlock(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to remove room block.");
    } finally {
      setDeletingId(null);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hotel.manage") ?? false;
  const today = todayStr();
  const sortedBlocks = [...(blocks ?? [])].sort((a, b) => a.start_date.localeCompare(b.start_date));

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1000, margin: "40px auto", padding: "0 16px 40px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 className="page-title">Room Blocking</h1>
            <p className="page-subtitle">Hold a room out of inventory for a future date range — renovation, VIP hold, or maintenance.</p>
          </div>
          {canManage && (
            <button type="button" className="btn btn-primary" style={{ flexShrink: 0 }} onClick={startAdd}>
              <IconPlus size={16} />
              Block Room
            </button>
          )}
        </div>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        <div className="panel" style={{ marginTop: 20 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Start date</th>
                  <th>End date</th>
                  <th>Reason</th>
                  <th>Blocked by</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {sortedBlocks.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600 }}>Room {b.room_number}</td>
                    <td>{b.start_date}</td>
                    <td>{b.end_date}</td>
                    <td>{b.reason || "—"}</td>
                    <td>{b.created_by_name || "—"}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDelete(b.id)}
                          disabled={deletingId === b.id}
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {sortedBlocks.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={6}>No room blocks. Every room is open for booking.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {canManage && showModal && (
          <Modal title="Block a room" onClose={closeModal}>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <select className="field-select" required value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                <option value="">Room…</option>
                {rooms?.map((room) => (
                  <option key={room.id} value={room.id}>
                    Room {room.number} ({room.room_type_name})
                  </option>
                ))}
              </select>
              <div className="field-row">
                <input
                  type="date"
                  className="field-input"
                  required
                  min={today}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <input
                  type="date"
                  className="field-input"
                  required
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <input
                className="field-input"
                placeholder="Reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button type="submit" className="btn btn-primary" disabled={working || !roomId}>
                  Block room
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
