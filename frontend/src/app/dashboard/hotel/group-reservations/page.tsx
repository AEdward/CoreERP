"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { Modal } from "@/components/Modal";
import { IconPlus } from "@/components/icons";
import {
  api,
  ApiError,
  type Customer,
  type GroupReservation,
  type Reservation,
  type Room,
  type RoomType,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_GROUP_FORM = { name: "", organizer: "", check_in_date: "", check_out_date: "", notes: "" };
const EMPTY_ROOM_ROW = { guest: "", room_type: "", room: "" };

const STATUS_BADGE: Record<Reservation["status"], string> = {
  confirmed: "badge-gold",
  checked_in: "badge-green",
  checked_out: "badge-gray",
  cancelled: "badge-red",
  no_show: "badge-red",
};

export default function GroupReservationsPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [groups, setGroups] = useState<GroupReservation[] | null>(null);
  const [guests, setGuests] = useState<Customer[] | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[] | null>(null);
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [groupForm, setGroupForm] = useState(EMPTY_GROUP_FORM);
  const [groupRooms, setGroupRooms] = useState([{ ...EMPTY_ROOM_ROW }]);
  const [working, setWorking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function loadAll() {
    try {
      const [g, gu, rt, rm] = await Promise.all([
        api.listGroupReservations(),
        api.listCustomers(),
        api.listRoomTypes(),
        api.listRooms(),
      ]);
      setGroups(g);
      setGuests(gu);
      setRoomTypes(rt);
      setRooms(rm);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load group reservations.");
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
    setGroupForm(EMPTY_GROUP_FORM);
    setGroupRooms([{ ...EMPTY_ROOM_ROW }]);
    setFormError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setGroupForm(EMPTY_GROUP_FORM);
    setGroupRooms([{ ...EMPTY_ROOM_ROW }]);
    setFormError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setFormError(null);
    try {
      const roomRows = groupRooms
        .filter((r) => r.guest && r.room_type)
        .map((r) => ({
          guest: Number(r.guest),
          room_type: Number(r.room_type),
          room: r.room ? Number(r.room) : null,
        }));
      await api.createGroupReservation({
        name: groupForm.name,
        organizer: Number(groupForm.organizer),
        check_in_date: groupForm.check_in_date,
        check_out_date: groupForm.check_out_date,
        notes: groupForm.notes,
        rooms: roomRows,
      });
      closeModal();
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create group reservation.");
    } finally {
      setWorking(false);
    }
  }

  async function handleCheckInGroup(id: number) {
    setActionError(null);
    try {
      await api.checkInGroup(id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to check in group.");
    }
  }

  async function handleCheckOutGroup(id: number) {
    setActionError(null);
    try {
      await api.checkOutGroup(id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to check out group.");
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hotel.manage") ?? false;

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px 40px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 className="page-title">Group Reservations</h1>
            <p className="page-subtitle">
              A block of rooms booked together (wedding party, tour group, corporate block) — each room is
              still a real reservation with its own confirmation number and folio.
            </p>
          </div>
          {canManage && (
            <button type="button" className="btn btn-primary" style={{ flexShrink: 0 }} onClick={startAdd}>
              <IconPlus size={16} />
              New Group
            </button>
          )}
        </div>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}
        {actionError && <p className="error-text" style={{ marginTop: 8 }}>{actionError}</p>}

        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {groups?.map((g) => (
            <div key={g.id} className="panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <strong>
                  {g.name} — {g.organizer_name} — {g.check_in_date} → {g.check_out_date} (
                  {g.reservations.length} room{g.reservations.length !== 1 ? "s" : ""})
                </strong>
                {canManage && (
                  <span style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleCheckInGroup(g.id)}>
                      Check in all
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleCheckOutGroup(g.id)}>
                      Check out all
                    </button>
                  </span>
                )}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ marginTop: 8 }}>
                  <thead>
                    <tr>
                      <th>Confirmation</th>
                      <th>Guest</th>
                      <th>Room</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.reservations.map((res) => (
                      <tr key={res.id}>
                        <td>{res.confirmation_number}</td>
                        <td>{res.guest_name}</td>
                        <td>{res.room_number ? `Room ${res.room_number}` : "Unassigned"}</td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[res.status]}`}>{res.status.replace("_", " ")}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {groups?.length === 0 && (
            <div className="panel">
              <p className="page-subtitle" style={{ margin: 0 }}>No group reservations yet.</p>
            </div>
          )}
        </div>

        {canManage && showModal && (
          <Modal title="New group reservation" onClose={closeModal}>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <input
                  className="field-input"
                  placeholder="Group name"
                  required
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                />
                <select
                  className="field-select"
                  required
                  value={groupForm.organizer}
                  onChange={(e) => setGroupForm({ ...groupForm, organizer: e.target.value })}
                >
                  <option value="">Organizer…</option>
                  {guests?.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <input
                  className="field-input"
                  type="date"
                  required
                  value={groupForm.check_in_date}
                  onChange={(e) => setGroupForm({ ...groupForm, check_in_date: e.target.value })}
                />
                <input
                  className="field-input"
                  type="date"
                  required
                  value={groupForm.check_out_date}
                  onChange={(e) => setGroupForm({ ...groupForm, check_out_date: e.target.value })}
                />
                <input
                  className="field-input"
                  placeholder="Notes"
                  value={groupForm.notes}
                  onChange={(e) => setGroupForm({ ...groupForm, notes: e.target.value })}
                  style={{ gridColumn: "1 / -1" }}
                />
              </div>

              <strong style={{ fontSize: 13 }}>Rooms</strong>
              {groupRooms.map((row, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select
                    className="field-select"
                    value={row.guest}
                    onChange={(e) => {
                      const next = [...groupRooms];
                      next[i] = { ...next[i], guest: e.target.value };
                      setGroupRooms(next);
                    }}
                    style={{ flex: 1 }}
                  >
                    <option value="">Guest…</option>
                    {guests?.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="field-select"
                    value={row.room_type}
                    onChange={(e) => {
                      const next = [...groupRooms];
                      next[i] = { ...next[i], room_type: e.target.value };
                      setGroupRooms(next);
                    }}
                    style={{ flex: 1 }}
                  >
                    <option value="">Room type…</option>
                    {roomTypes?.map((rt) => (
                      <option key={rt.id} value={rt.id}>
                        {rt.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="field-select"
                    value={row.room}
                    onChange={(e) => {
                      const next = [...groupRooms];
                      next[i] = { ...next[i], room: e.target.value };
                      setGroupRooms(next);
                    }}
                    style={{ flex: 1 }}
                  >
                    <option value="">Assign room later</option>
                    {rooms
                      ?.filter((r) => String(r.room_type) === row.room_type)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          Room {r.number}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => setGroupRooms(groupRooms.filter((_, idx) => idx !== i))}
                    disabled={groupRooms.length === 1}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setGroupRooms([...groupRooms, { ...EMPTY_ROOM_ROW }])}
                style={{ alignSelf: "start" }}
              >
                + Add room
              </button>

              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={working}>
                  Create group reservation
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
