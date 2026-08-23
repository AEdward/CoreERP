"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type ApprovalRequestEntry, type RecordTarget } from "@/lib/api";

const STATUS_COLORS: Record<ApprovalRequestEntry["status"], string> = {
  pending: "#e65100",
  approved: "#2e7d32",
  rejected: "#c62828",
};

/** Self-contained "Approval" button + popover — same shape as
 * NotesPanel/ActivityPanel. Requesting approval and deciding on one both
 * require `manage` on the target's own module (apps.approvals.registry);
 * the backend is the actual enforcement point for segregation of duties
 * (a requester can't decide their own request), this just surfaces
 * whatever it says rather than trying to predict it client-side. */
export function ApprovalPanel({ target, canManage }: { target: RecordTarget; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ApprovalRequestEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [working, setWorking] = useState(false);

  async function load() {
    try {
      setEntries(await api.listApprovals(target));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load approval history.");
    }
  }

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target.appLabel, target.model, target.objectId]);

  const pending = entries?.find((e) => e.status === "pending") ?? null;

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setError(null);
    try {
      await api.requestApproval(target, note);
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to request approval.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDecide(approved: boolean) {
    if (!pending) return;
    setWorking(true);
    setError(null);
    try {
      if (approved) {
        await api.approveRequest(pending.id);
      } else {
        await api.rejectRequest(pending.id, decisionNote);
      }
      setDecisionNote("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record decision.");
    } finally {
      setWorking(false);
    }
  }

  const label = pending ? "Approval: Pending" : entries?.[0] ? `Approval: ${entries[0].status}` : "Approval";

  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button type="button" onClick={() => setOpen(!open)} style={{ padding: "2px 8px", fontSize: 12 }}>
        {label}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            zIndex: 20,
            width: 320,
            background: "white",
            border: "1px solid #ddd",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: 12,
            textAlign: "left",
          }}
        >
          {entries === null && <p style={{ fontSize: 12, color: "#999", margin: 0 }}>Loading…</p>}
          {entries?.length === 0 && (
            <p style={{ fontSize: 12, color: "#999", margin: 0 }}>No approval requests yet.</p>
          )}
          {entries && entries.length > 0 && (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 200, overflowY: "auto" }}>
              {entries.map((e) => (
                <li key={e.id} style={{ padding: "6px 0", borderBottom: "1px solid #f0f0f0", fontSize: 12 }}>
                  <div style={{ color: STATUS_COLORS[e.status], fontWeight: 600, textTransform: "capitalize" }}>
                    {e.status}
                  </div>
                  <div style={{ color: "#666" }}>Requested by {e.requested_by_name}</div>
                  {e.note && <div style={{ color: "#666", fontStyle: "italic" }}>&ldquo;{e.note}&rdquo;</div>}
                  {e.decided_by_name && (
                    <div style={{ color: "#999", fontSize: 10, marginTop: 2 }}>
                      Decided by {e.decided_by_name}
                      {e.decision_note && ` — "${e.decision_note}"`}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canManage && pending && (
            <div style={{ marginTop: 8 }}>
              <textarea
                placeholder="Decision note (optional)"
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                style={{ width: "100%", fontSize: 12, padding: 4 }}
                rows={2}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => handleDecide(true)}
                  disabled={working}
                  style={{ padding: "3px 10px", fontSize: 12 }}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => handleDecide(false)}
                  disabled={working}
                  style={{ padding: "3px 10px", fontSize: 12, color: "crimson" }}
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {canManage && !pending && (
            <form onSubmit={handleRequest} style={{ marginTop: 8 }}>
              <textarea
                placeholder="Note for the approver (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ width: "100%", fontSize: 12, padding: 4 }}
                rows={2}
              />
              <button type="submit" disabled={working} style={{ marginTop: 4, padding: "3px 10px", fontSize: 12 }}>
                Request approval
              </button>
            </form>
          )}

          {error && <p style={{ color: "crimson", fontSize: 11, marginTop: 6 }}>{error}</p>}
        </div>
      )}
    </span>
  );
}
