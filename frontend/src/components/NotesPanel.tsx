"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type Note, type RecordTarget } from "@/lib/api";

/** Self-contained "Notes" button + expandable panel — same shape as
 * DocumentsPanel, list/add/edit/delete notes for one record. Works
 * against any target apps.common.targeting whitelists. */
export function NotesPanel({ target, canManage }: { target: RecordTarget; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");

  async function load() {
    try {
      setNotes(await api.listNotes(target));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load notes.");
    }
  }

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target.appLabel, target.model, target.objectId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setWorking(true);
    setError(null);
    try {
      await api.createNote(target, draft);
      setDraft("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add note.");
    } finally {
      setWorking(false);
    }
  }

  async function handleSaveEdit(id: number) {
    try {
      await api.updateNote(id, editDraft);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update note.");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this note?")) return;
    try {
      await api.deleteNote(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete note.");
    }
  }

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button type="button" onClick={() => setOpen(!open)} style={{ padding: "2px 8px", fontSize: 12 }}>
        Notes{notes && notes.length > 0 ? ` (${notes.length})` : ""}
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
          {notes === null && <p style={{ fontSize: 12, color: "#999", margin: 0 }}>Loading…</p>}
          {notes?.length === 0 && <p style={{ fontSize: 12, color: "#999", margin: 0 }}>No notes yet.</p>}
          {notes && notes.length > 0 && (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 220, overflowY: "auto" }}>
              {notes.map((n) => (
                <li key={n.id} style={{ padding: "6px 0", borderBottom: "1px solid #f0f0f0", fontSize: 12 }}>
                  {editingId === n.id ? (
                    <>
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        style={{ width: "100%", fontSize: 12, padding: 4 }}
                        rows={2}
                      />
                      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                        <button type="button" onClick={() => handleSaveEdit(n.id)} style={{ fontSize: 11, padding: "1px 6px" }}>
                          Save
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} style={{ fontSize: 11, padding: "1px 6px" }}>
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ whiteSpace: "pre-wrap" }}>{n.body}</div>
                      <div style={{ color: "#aaa", fontSize: 10, marginTop: 2, display: "flex", justifyContent: "space-between" }}>
                        <span>
                          {n.author_name || "—"} · {new Date(n.created_at).toLocaleDateString()}
                        </span>
                        {canManage && (
                          <span style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(n.id);
                                setEditDraft(n.body);
                              }}
                              style={{ padding: 0, fontSize: 10 }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(n.id)}
                              style={{ padding: 0, fontSize: 10, color: "crimson" }}
                            >
                              Delete
                            </button>
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canManage && (
            <form onSubmit={handleAdd} style={{ marginTop: 8 }}>
              <textarea
                placeholder="Add a note…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                style={{ width: "100%", fontSize: 12, padding: 4 }}
                rows={2}
              />
              <button type="submit" disabled={working || !draft.trim()} style={{ marginTop: 4, padding: "3px 10px", fontSize: 12 }}>
                Add
              </button>
            </form>
          )}
          {error && <p style={{ color: "crimson", fontSize: 11, marginTop: 6 }}>{error}</p>}
        </div>
      )}
    </span>
  );
}
