"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type Bill, type Event, type Invoice, type Task } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Dates are handled as plain YYYY-MM-DD strings throughout this page,
// never round-tripped through Date -> toISOString() -> Date — that
// conversion goes through UTC and can silently shift the calendar date
// by a day for anyone not in UTC. This works because events created
// here are always all-day (a date, not a moment), and the backend's
// TIME_ZONE is UTC, so a naive "YYYY-MM-DDT00:00:00" round-trips
// exactly. A time-of-day event would need real timezone handling this
// page doesn't attempt.
function localDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDateKey(iso: string) {
  return iso.slice(0, 10);
}

function monthLabel(d: Date) {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** Always a 6x7 grid — cells outside the current month are still dated
 * (for alignment) but rendered muted and non-interactive. */
function buildGridDays(monthStart: Date): Date[] {
  const firstWeekday = monthStart.getDay();
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

const EMPTY_FORM = { title: "", date: "", all_day: true };

export default function CalendarPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [monthStart, setMonthStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [events, setEvents] = useState<Event[] | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    // Tasks/Invoices/Bills are best-effort — a role without that
    // module's view permission just won't see those chips, not an error.
    const results = await Promise.allSettled([
      api.listEvents(),
      api.listTasks(),
      api.listInvoices(),
      api.listBills(),
    ]);
    if (results[0].status === "fulfilled") setEvents(results[0].value);
    else setLoadError(results[0].reason instanceof ApiError ? results[0].reason.message : "Failed to load events.");
    setTasks(results[1].status === "fulfilled" ? results[1].value : []);
    setInvoices(results[2].status === "fulfilled" ? results[2].value : []);
    setBills(results[3].status === "fulfilled" ? results[3].value : []);
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  const gridDays = useMemo(() => buildGridDays(monthStart), [monthStart]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, Event[]> = {};
    events?.forEach((e) => {
      const key = toDateKey(e.start_at);
      (map[key] ??= []).push(e);
    });
    return map;
  }, [events]);

  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks?.forEach((t) => {
      if (!t.due_date || t.status === "done") return;
      (map[t.due_date] ??= []).push(t);
    });
    return map;
  }, [tasks]);

  const invoicesByDay = useMemo(() => {
    const map: Record<string, Invoice[]> = {};
    invoices?.forEach((i) => {
      if (!i.due_date || i.status === "paid" || i.status === "void") return;
      (map[i.due_date] ??= []).push(i);
    });
    return map;
  }, [invoices]);

  const billsByDay = useMemo(() => {
    const map: Record<string, Bill[]> = {};
    bills?.forEach((b) => {
      if (!b.due_date || b.status === "paid" || b.status === "void") return;
      (map[b.due_date] ??= []).push(b);
    });
    return map;
  }, [bills]);

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setError(null);
    try {
      await api.createEvent({
        title: form.title,
        start_at: `${form.date}T00:00:00`,
        all_day: form.all_day,
      });
      setForm(EMPTY_FORM);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create event.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDeleteEvent(id: number) {
    if (!confirm("Delete this event?")) return;
    try {
      await api.deleteEvent(id);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete event.");
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("calendar.manage") ?? false;
  const todayKey = localDateKey(new Date());

  return (
    <ModuleShell moduleKey="calendar" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Calendar</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
          <div className={shared.pageActions}>
            <button
              onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))}
              className={`${shared.btn} ${shared.btnSmall}`}
            >
              ←
            </button>
            <strong style={{ minWidth: 140, textAlign: "center" }}>{monthLabel(monthStart)}</strong>
            <button
              onClick={() => setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))}
              className={`${shared.btn} ${shared.btnSmall}`}
            >
              →
            </button>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        {canManage && (
          <form onSubmit={handleAddEvent} className={shared.formRow} style={{ marginBottom: 16 }}>
            <input
              placeholder="New event title"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={shared.input}
              style={{ flex: 1, maxWidth: 260 }}
            />
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className={shared.input}
            />
            <button
              type="submit"
              disabled={working || !form.title || !form.date}
              className={`${shared.btn} ${shared.btnPrimary}`}
            >
              Add event
            </button>
            {error && <span className={shared.errorText}>{error}</span>}
          </form>
        )}

        <div className={shared.card}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              border: "1px solid #eee",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                style={{
                  padding: "6px 8px",
                  fontSize: 11,
                  color: "#999",
                  textTransform: "uppercase",
                  borderBottom: "1px solid #eee",
                  background: "#fafafa",
                }}
              >
                {w}
              </div>
            ))}
            {gridDays.map((d) => {
              const key = localDateKey(d);
              const inMonth = d.getMonth() === monthStart.getMonth();
              const isToday = key === todayKey;
              return (
                <div
                  key={key}
                  style={{
                    minHeight: 92,
                    padding: 6,
                    borderTop: "1px solid #f0f0f0",
                    borderLeft: "1px solid #f0f0f0",
                    background: inMonth ? "white" : "#fafafa",
                    fontSize: 11,
                  }}
                >
                  <div
                    style={{
                      fontWeight: isToday ? 700 : 400,
                      color: inMonth ? (isToday ? "#4f46e5" : "#333") : "#ccc",
                      marginBottom: 4,
                    }}
                  >
                    {d.getDate()}
                  </div>
                  {(eventsByDay[key] ?? []).map((ev) => (
                    <div
                      key={`ev-${ev.id}`}
                      style={{
                        background: "#eef2ff",
                        color: "#4338ca",
                        borderRadius: 4,
                        padding: "1px 4px",
                        marginBottom: 2,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 4,
                      }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ev.title}
                      </span>
                      {canManage && (
                        <button
                          onClick={() => handleDeleteEvent(ev.id)}
                          style={{ border: "none", background: "none", color: "#4338ca", cursor: "pointer", padding: 0 }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {(tasksByDay[key] ?? []).map((t) => (
                    <Link
                      key={`task-${t.id}`}
                      href="/dashboard/tasks"
                      style={{
                        display: "block",
                        background: "#ecfdf5",
                        color: "#047857",
                        borderRadius: 4,
                        padding: "1px 4px",
                        marginBottom: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Task: {t.title}
                    </Link>
                  ))}
                  {(invoicesByDay[key] ?? []).map((inv) => (
                    <Link
                      key={`inv-${inv.id}`}
                      href="/dashboard/sales"
                      style={{
                        display: "block",
                        background: "#fff7ed",
                        color: "#c2410c",
                        borderRadius: 4,
                        padding: "1px 4px",
                        marginBottom: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Due: {inv.invoice_number}
                    </Link>
                  ))}
                  {(billsByDay[key] ?? []).map((b) => (
                    <Link
                      key={`bill-${b.id}`}
                      href="/dashboard/procurement"
                      style={{
                        display: "block",
                        background: "#fef2f2",
                        color: "#b91c1c",
                        borderRadius: 4,
                        padding: "1px 4px",
                        marginBottom: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Due: {b.bill_number}
                    </Link>
                  ))}
                </div>
              );
            })}
          </div>
          <p className={shared.hint} style={{ marginTop: 12 }}>
            Events (indigo) are entries you add here. Task/Invoice/Bill due dates (green/orange/red) are
            pulled live from those modules — nothing&apos;s duplicated, click one to go to the source.
          </p>
        </div>
      </div>
    </ModuleShell>
  );
}
