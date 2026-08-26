"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { Modal } from "@/components/Modal";
import { IconPlus } from "@/components/icons";
import { api, ApiError, type Floor, type Room, type RoomStatus, type RoomType } from "@/lib/api";
import { useSession } from "@/lib/useSession";

const ROOM_STATUSES: RoomStatus[] = [
  "available",
  "occupied",
  "dirty",
  "clean",
  "inspected",
  "out_of_order",
  "maintenance",
];

const STATUS_BADGE: Record<RoomStatus, string> = {
  available: "badge-green",
  occupied: "badge-gold",
  dirty: "badge-red",
  clean: "badge-gray",
  inspected: "badge-gold",
  out_of_order: "badge-gray",
  maintenance: "badge-gray",
};

export default function RoomStatusPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [floors, setFloors] = useState<Floor[] | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [roomForm, setRoomForm] = useState({ floor: "", room_type: "", number: "" });
  const [roomWorking, setRoomWorking] = useState(false);
  const [statusWorkingId, setStatusWorkingId] = useState<number | null>(null);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  async function loadAll() {
    try {
      const [r, f, rt] = await Promise.all([api.listRooms(), api.listFloors(), api.listRoomTypes()]);
      setRooms(r);
      setFloors(f);
      setRoomTypes(rt);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load rooms.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddRoom(e: React.FormEvent) {
    e.preventDefault();
    setRoomWorking(true);
    try {
      await api.createRoom({
        floor: Number(roomForm.floor),
        room_type: Number(roomForm.room_type),
        number: roomForm.number,
      });
      setRoomForm({ floor: "", room_type: "", number: "" });
      setShowRoomModal(false);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to add room.");
    } finally {
      setRoomWorking(false);
    }
  }

  function startAddRoom() {
    setRoomForm({ floor: "", room_type: "", number: "" });
    setLoadError(null);
    setShowRoomModal(true);
  }

  function closeRoomModal() {
    setShowRoomModal(false);
    setRoomForm({ floor: "", room_type: "", number: "" });
  }

  async function handleSetRoomStatus(roomId: number, status: RoomStatus) {
    setStatusWorkingId(roomId);
    try {
      await api.setRoomStatus(roomId, status);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to change room status.");
    } finally {
      setStatusWorkingId(null);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hotel.manage") ?? false;
  const floorLabel = (id: number) => floors?.find((f) => f.id === id)?.name ?? "—";
  const filtered = rooms?.filter((r) => !statusFilter || r.status === statusFilter) ?? [];

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px 40px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 className="page-title">Room Status</h1>
            <p className="page-subtitle">Live status per room — change it here as housekeeping/maintenance updates land.</p>
          </div>
          {canManage && (
            <button type="button" className="btn btn-primary" style={{ flexShrink: 0 }} onClick={startAddRoom}>
              <IconPlus size={16} />
              Add Room
            </button>
          )}
        </div>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        <div className="panel" style={{ marginTop: 20 }}>
          <select
            className="field-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ maxWidth: 200, marginBottom: 16 }}
          >
            <option value="">All statuses</option>
            {ROOM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Floor</th>
                  <th>Type</th>
                  <th>Status</th>
                  {canManage && <th>Change status</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.number}</td>
                    <td>{floorLabel(r.floor)}</td>
                    <td>{r.room_type_name}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[r.status]}`}>{r.status.replace("_", " ")}</span>
                    </td>
                    {canManage && (
                      <td>
                        <select
                          className="field-select"
                          value=""
                          disabled={statusWorkingId === r.id}
                          onChange={(e) => {
                            if (e.target.value) handleSetRoomStatus(r.id, e.target.value as RoomStatus);
                          }}
                        >
                          <option value="">Set status…</option>
                          {ROOM_STATUSES.filter((s) => s !== r.status).map((s) => (
                            <option key={s} value={s}>
                              {s.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={5}>No rooms match this filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {canManage && showRoomModal && (
          <Modal title="Add room" onClose={closeRoomModal}>
            <form onSubmit={handleAddRoom} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select
                className="field-select"
                required
                value={roomForm.floor}
                onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })}
              >
                <option value="">Floor…</option>
                {floors?.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <select
                className="field-select"
                required
                value={roomForm.room_type}
                onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value })}
              >
                <option value="">Room type…</option>
                {roomTypes?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <input
                className="field-input"
                placeholder="Room number"
                required
                value={roomForm.number}
                onChange={(e) => setRoomForm({ ...roomForm, number: e.target.value })}
              />
              <div style={{ width: "100%", display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={roomWorking || !roomForm.floor || !roomForm.room_type || !roomForm.number}
                >
                  Add room
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeRoomModal}>
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}
      </main>
    </ModuleShell>
  );
}
