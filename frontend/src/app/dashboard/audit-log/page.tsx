"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { api, ApiError, type AuditLogEntry } from "@/lib/api";
import { useSession } from "@/lib/useSession";

const ACTION_LABELS: Record<AuditLogEntry["action"], string> = {
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
};

const ACTION_COLORS: Record<AuditLogEntry["action"], string> = {
  created: "#2e7d32",
  updated: "#1565c0",
  deleted: "#c62828",
};

function formatChanges(changes: Record<string, [unknown, unknown]>) {
  const entries = Object.entries(changes);
  if (entries.length === 0) return null;
  return entries.map(([field, [before, after]]) => (
    <div key={field}>
      <strong>{field}</strong>: {String(before ?? "—")} → {String(after ?? "—")}
    </div>
  ));
}

/** Company-wide, settings.manage-only ledger of every create/update/delete
 * that went through apps.common.views.CompanyScopedMixin — see
 * apps.auditlog. Distinct from ActivityPanel's friendlier per-record
 * feed (HR/Sales/Procurement pages): this is the compliance-grade view,
 * gated much more strictly (Owner-level, not just "can see this record
 * at all"). */
export default function AuditLogPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeMembership) return;
    (async () => {
      try {
        setEntries(await api.listAuditLog());
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load audit log.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  return (
    <main style={{ maxWidth: 960, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <AppHeader activeMembership={activeMembership} />

      {!activeMembership ? (
        <p style={{ color: "#666" }}>
          Pick an active company on the <a href="/dashboard">dashboard</a> first.
        </p>
      ) : (
        <>
          <h1 style={{ fontSize: 20 }}>Audit Log — {activeMembership.company.name}</h1>
          <p style={{ color: "#666", fontSize: 13 }}>
            Every create, update, and delete across the company, in one place. Visible to company
            administrators only.
          </p>
          {loadError && <p style={{ color: "crimson" }}>{loadError}</p>}

          <section style={{ marginTop: 24, marginBottom: 40 }}>
            {entries === null && !loadError && <p style={{ color: "#999" }}>Loading…</p>}
            {entries?.length === 0 && <p style={{ color: "#999" }}>Nothing recorded yet.</p>}
            {entries && entries.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                    <th style={{ padding: "6px 4px" }}>When</th>
                    <th style={{ padding: "6px 4px" }}>Who</th>
                    <th style={{ padding: "6px 4px" }}>Action</th>
                    <th style={{ padding: "6px 4px" }}>Record</th>
                    <th style={{ padding: "6px 4px" }}>Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "6px 4px", whiteSpace: "nowrap" }}>
                        {new Date(e.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: "6px 4px" }}>{e.actor_name}</td>
                      <td style={{ padding: "6px 4px" }}>
                        <span style={{ color: ACTION_COLORS[e.action], fontWeight: 600 }}>
                          {ACTION_LABELS[e.action]}
                        </span>
                      </td>
                      <td style={{ padding: "6px 4px" }}>{e.target_label}</td>
                      <td style={{ padding: "6px 4px", fontSize: 12, color: "#555" }}>
                        {formatChanges(e.changes) || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </main>
  );
}
