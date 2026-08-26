"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type Reservation, type Room } from "@/lib/api";
import { useSession } from "@/lib/useSession";

export default function RoomAssignmentPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<number | null>(null);

  async function loadAll() {
    try {
      const [r, rm] = await Promise.all([api.listReservations(), api.listRooms()]);
      setReservations(r);
      setRooms(rm);
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

  async function handleAssign(reservationId: number, roomId: string) {
    if (!roomId) return;
    setWorkingId(reservationId);
    setLoadError(null);
    try {
      await api.assignReservationRoom(reservationId, Number(roomId));
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to assign room.");
    } finally {
      setWorkingId(null);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hotel.manage") ?? false;
  const availableRooms = (roomTypeId: number) =>
    rooms?.filter((r) => r.room_type === roomTypeId && r.status === "available") ?? [];
  const unassigned = (reservations ?? [])
    .filter((r) => !r.room && r.status === "confirmed")
    .sort((a, b) => a.check_in_date.localeCompare(b.check_in_date));

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1000, margin: "40px auto", padding: "0 16px 40px" }}>
        <h1 className="page-title">Room Assignment</h1>
        <p className="page-subtitle">Confirmed reservations still waiting on a room, earliest arrival first.</p>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        <div className="panel" style={{ marginTop: 20 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Confirmation</th>
                  <th>Guest</th>
                  <th>Room type</th>
                  <th>Check-in date</th>
                  {canManage && <th>Assign</th>}
                </tr>
              </thead>
              <tbody>
                {unassigned.map((r) => (
                  <tr key={r.id}>
                    <td>{r.confirmation_number}</td>
                    <td style={{ fontWeight: 600 }}>{r.guest_name}</td>
                    <td>{r.room_type_name}</td>
                    <td>{r.check_in_date}</td>
                    {canManage && (
                      <td>
                        <select
                          className="field-select"
                          value=""
                          disabled={workingId === r.id}
                          onChange={(e) => handleAssign(r.id, e.target.value)}
                        >
                          <option value="">Assign room…</option>
                          {availableRooms(r.room_type).map((room) => (
                            <option key={room.id} value={room.id}>
                              Room {room.number}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
                {unassigned.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={5}>Every confirmed reservation already has a room.</td>
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
