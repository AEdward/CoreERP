"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type CompanyMember, type Task } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const STATUS_LABELS: Record<Task["status"], string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  assignee: "",
  due_date: "",
  status: "todo" as Task["status"],
};

export default function TasksPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [members, setMembers] = useState<CompanyMember[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function loadAll() {
    try {
      const [t, m] = await Promise.all([api.listTasks(), api.listCompanyMembers()]);
      setTasks(t);
      setMembers(m);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load tasks.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setError(null);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        assignee: form.assignee ? Number(form.assignee) : null,
        due_date: form.due_date || null,
        status: form.status,
      };
      if (editingId) {
        await api.updateTask(editingId, payload);
      } else {
        await api.createTask(payload);
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save task.");
    } finally {
      setWorking(false);
    }
  }

  function startEdit(t: Task) {
    setEditingId(t.id);
    setForm({
      title: t.title,
      description: t.description,
      assignee: t.assignee ? String(t.assignee) : "",
      due_date: t.due_date ?? "",
      status: t.status,
    });
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteTask(id);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete task.");
    }
  }

  async function handleQuickStatus(t: Task, status: Task["status"]) {
    try {
      await api.updateTask(t.id, {
        title: t.title,
        description: t.description,
        assignee: t.assignee,
        due_date: t.due_date,
        status,
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update status.");
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("tasks.manage") ?? false;

  return (
    <ModuleShell moduleKey="tasks" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Tasks</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.card}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Assignee</th>
                <th>Due</th>
                <th>Status</th>
                <th>Created by</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {tasks?.map((t) => (
                <tr key={t.id}>
                  <td>
                    {t.title}
                    {t.description && <div className={shared.tableMuted}>{t.description}</div>}
                  </td>
                  <td>{t.assignee_name || "—"}</td>
                  <td>{t.due_date || "—"}</td>
                  <td>
                    {canManage ? (
                      <select
                        value={t.status}
                        onChange={(e) => handleQuickStatus(t, e.target.value as Task["status"])}
                        className={shared.select}
                      >
                        <option value="todo">To do</option>
                        <option value="in_progress">In progress</option>
                        <option value="done">Done</option>
                      </select>
                    ) : (
                      STATUS_LABELS[t.status]
                    )}
                  </td>
                  <td className={shared.tableMuted}>{t.created_by_name || "—"}</td>
                  {canManage && (
                    <td style={{ textAlign: "right" }}>
                      <RowActions
                        onEdit={() => startEdit(t)}
                        onDelete={() => handleDelete(t.id)}
                        disabled={working}
                      />
                    </td>
                  )}
                </tr>
              ))}
              {tasks?.length === 0 && (
                <tr>
                  <td colSpan={6} className={shared.tableMuted}>
                    No tasks yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {canManage && (
            <form onSubmit={handleSubmit} className={shared.formGrid} style={{ marginTop: 16 }}>
              <input
                placeholder="Title"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={shared.input}
                style={{ gridColumn: "1 / -1" }}
              />
              <input
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={shared.input}
                style={{ gridColumn: "1 / -1" }}
              />
              <select
                value={form.assignee}
                onChange={(e) => setForm({ ...form, assignee: e.target.value })}
                className={shared.select}
              >
                <option value="">Unassigned</option>
                {members?.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className={shared.input}
              />
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Task["status"] })}
                className={shared.select}
              >
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                <button
                  type="submit"
                  disabled={working || !form.title}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  {editingId ? "Save changes" : "Add task"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setForm(EMPTY_FORM);
                    }}
                    className={shared.btn}
                  >
                    Cancel
                  </button>
                )}
              </div>
              {error && (
                <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                  {error}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </ModuleShell>
  );
}
