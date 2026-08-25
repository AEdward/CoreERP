"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Notification } from "@/lib/api";

const POLL_MS = 30_000;

/** Self-contained bell icon + unread badge + dropdown — mounted in the
 * launcher and ModuleShell top bars so it's on every /dashboard page.
 * Only polls when there's an active company, since notifications are
 * company-scoped. */
export function NotificationBell({ active }: { active: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notification[] | null>(null);

  async function refreshCount() {
    try {
      const { count } = await api.unreadNotificationCount();
      setCount(count);
    } catch {
      // Non-critical — a failed poll just leaves the last known count.
    }
  }

  useEffect(() => {
    if (!active) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshCount();
    const interval = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(interval);
  }, [active]);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setItems(await api.listNotifications());
    }
  }

  async function handleClick(n: Notification) {
    if (!n.is_read) {
      await api.markNotificationRead(n.id);
      setCount((c) => Math.max(0, c - 1));
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  async function handleMarkAllRead() {
    await api.markAllNotificationsRead();
    setItems((prev) => prev?.map((n) => ({ ...n, is_read: true })) ?? null);
    setCount(0);
  }

  if (!active) return null;

  return (
    <span style={{ position: "relative", display: "inline-block", marginRight: 12 }}>
      <button
        type="button"
        onClick={handleToggle}
        style={{ padding: "6px 10px", position: "relative", fontSize: 16 }}
        title="Notifications"
      >
        🔔
        {count > 0 && (
          <span
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              background: "crimson",
              color: "white",
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 700,
              padding: "1px 5px",
              lineHeight: 1.4,
            }}
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            zIndex: 30,
            width: 320,
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            textAlign: "left",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 12px",
              borderBottom: "1px solid #eee",
            }}
          >
            <strong style={{ fontSize: 13 }}>Notifications</strong>
            <button type="button" onClick={handleMarkAllRead} style={{ fontSize: 11, padding: "2px 6px" }}>
              Mark all read
            </button>
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {items === null && <p style={{ fontSize: 12, color: "#999", padding: 12 }}>Loading…</p>}
            {items?.length === 0 && (
              <p style={{ fontSize: 12, color: "#999", padding: 12 }}>Nothing here yet.</p>
            )}
            {items?.map((n) => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid #f5f5f5",
                  cursor: "pointer",
                  background: n.is_read ? "white" : "#f0f7ff",
                  fontSize: 12,
                }}
              >
                <div style={{ color: n.is_read ? "#555" : "#111", fontWeight: n.is_read ? 400 : 600 }}>
                  {n.message}
                </div>
                <div style={{ color: "#aaa", fontSize: 10, marginTop: 2 }}>
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}
