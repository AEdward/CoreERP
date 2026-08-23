"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type Activity, type RecordTarget } from "@/lib/api";

/** Self-contained "Activity" button + expandable panel — same shape as
 * NotesPanel/DocumentsPanel, but read-only: entries are system-generated
 * (record created, note added, document attached), never authored here. */
export function ActivityPanel({ target }: { target: RecordTarget }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Activity[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.listActivity(target);
        if (!cancelled) setItems(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load activity.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target.appLabel, target.model, target.objectId]);

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button type="button" onClick={() => setOpen(!open)} style={{ padding: "2px 8px", fontSize: 12 }}>
        Activity{items && items.length > 0 ? ` (${items.length})` : ""}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            zIndex: 20,
            width: 300,
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: 12,
            textAlign: "left",
          }}
        >
          {items === null && <p style={{ fontSize: 12, color: "#999", margin: 0 }}>Loading…</p>}
          {items?.length === 0 && <p style={{ fontSize: 12, color: "#999", margin: 0 }}>No activity yet.</p>}
          {items && items.length > 0 && (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 240, overflowY: "auto" }}>
              {items.map((a) => (
                <li key={a.id} style={{ padding: "6px 0", borderBottom: "1px solid #f0f0f0", fontSize: 12 }}>
                  <div>{a.summary}</div>
                  <div style={{ color: "#aaa", fontSize: 10, marginTop: 2 }}>
                    {a.actor_name} · {new Date(a.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {error && <p style={{ color: "crimson", fontSize: 11, marginTop: 6 }}>{error}</p>}
        </div>
      )}
    </span>
  );
}
