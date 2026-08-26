"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { ModuleShell } from "@/components/ModuleShell";
import { IconPlus } from "@/components/icons";
import {
  api,
  ApiError,
  type HousekeepingTask,
  type HousekeepingTaskType,
  type Room,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_FORM = { room: "", task_type: "cleaning" as HousekeepingTaskType, notes: "", scheduled_date: "" };

const STATUS_BADGE: Record<HousekeepingTask["status"], string> = {
  pending: "badge-gold",
  in_progress: "badge-gray",
  done: "badge-green",
  cancelled: "badge-red",
};

export default function HousekeepingPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [tasks, setTasks] = useState<HousekeepingTask[] | null>(null);
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [working, setWorking] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);

  async function loadAll() {
    try {
      const [t, r] = await Promise.all([api.listHousekeepingTasks(), api.listRooms()]);
      setTasks(t);
      setRooms(r);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load housekeeping tasks.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    try {
      await api.createHousekeepingTask({
        room: Number(form.room),
        task_type: form.task_type,
        notes: form.notes,
        scheduled_date: form.scheduled_date || null,
      });
      setForm(EMPTY_FORM);
      setShowTaskModal(false);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to create task.");
    } finally {
      setWorking(false);
    }
  }

  function startAddTask() {
    setForm(EMPTY_FORM);
    setLoadError(null);
    setShowTaskModal(true);
  }

  function closeTaskModal() {
    setShowTaskModal(false);
    setForm(EMPTY_FORM);
  }

  async function handleStart(id: number) {
    setActionError(null);
    try {
      await api.startHousekeepingTask(id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to start task.");
    }
  }

  async function handleComplete(id: number) {
    setActionError(null);
    try {
      await api.completeHousekeepingTask(id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to complete task.");
    }
  }

  async function handleCancel(id: number) {
    setActionError(null);
    try {
      await api.cancelHousekeepingTask(id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to cancel task.");
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("housekeeping.manage") ?? false;
  const roomNumber = (id: number) => rooms?.find((r) => r.id === id)?.number ?? "—";

  return (
    <ModuleShell moduleKey="housekeeping" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1000, margin: "40px auto", padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <h1 className="page-title">Housekeeping — {activeMembership?.company.name}</h1>
          {canManage && (
            <button type="button" className="btn btn-primary" onClick={startAddTask} style={{ flexShrink: 0 }}>
              <IconPlus size={16} />
              Add task
            </button>
          )}
        </div>
        {loadError && <p className="error-text">{loadError}</p>}
        {actionError && <p className="error-text">{actionError}</p>}

        <div className="panel" style={{ marginTop: 20 }}>
          <h2 className="section-label">Tasks</h2>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Type</th>
                  <th>Scheduled</th>
                  <th>Notes</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {tasks?.map((t) => (
                  <tr key={t.id}>
                    <td>Room {t.room_number || roomNumber(t.room)}</td>
                    <td>{t.task_type.replace("_", " ")}</td>
                    <td>{t.scheduled_date || "—"}</td>
                    <td style={{ color: "#666" }}>{t.notes || "—"}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[t.status]}`}>{t.status.replace("_", " ")}</span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {t.status === "pending" && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleStart(t.id)}
                            style={{ marginRight: 4 }}
                          >
                            Start
                          </button>
                        )}
                        {(t.status === "pending" || t.status === "in_progress") && (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleComplete(t.id)}
                              style={{ marginRight: 4 }}
                            >
                              Complete
                            </button>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => handleCancel(t.id)}>
                              Cancel
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {tasks?.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={6}>No housekeeping tasks yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {canManage && showTaskModal && (
          <Modal title="Add task" onClose={closeTaskModal}>
            <form
              onSubmit={handleCreate}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              <select
                className="field-select"
                required
                value={form.room}
                onChange={(e) => setForm({ ...form, room: e.target.value })}
              >
                <option value="">Room…</option>
                {rooms?.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.number} ({r.status})
                  </option>
                ))}
              </select>
              <select
                className="field-select"
                value={form.task_type}
                onChange={(e) => setForm({ ...form, task_type: e.target.value as HousekeepingTaskType })}
              >
                <option value="cleaning">Cleaning</option>
                <option value="inspection">Inspection</option>
                <option value="linen">Linen</option>
                <option value="lost_and_found">Lost & found</option>
              </select>
              <input
                className="field-input"
                type="date"
                value={form.scheduled_date}
                onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
              />
              <input
                className="field-input"
                placeholder="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, marginTop: 4 }}>
                <button type="submit" className="btn btn-primary" disabled={working || !form.room}>
                  Add task
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeTaskModal}>
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
