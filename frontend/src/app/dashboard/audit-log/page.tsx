"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type AuditLogEntry } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const ACTION_LABELS: Record<AuditLogEntry["action"], string> = {
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
};

const ACTION_BADGES: Record<AuditLogEntry["action"], string> = {
  created: shared.badgeSuccess,
  updated: shared.badgeInfo,
  deleted: shared.badgeDanger,
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

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  return (
    <ModuleShell moduleKey="settings" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Audit Log</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        <p className={shared.hint} style={{ marginBottom: 16 }}>
          Every create, update, and delete across the company, in one place. Visible to company
          administrators only.
        </p>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.card}>
          {entries === null && !loadError && <p className={shared.emptyState}>Loading…</p>}
          {entries?.length === 0 && <p className={shared.emptyState}>Nothing recorded yet.</p>}
          {entries && entries.length > 0 && (
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Action</th>
                  <th>Record</th>
                  <th>Changes</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(e.created_at).toLocaleString()}</td>
                    <td>{e.actor_name}</td>
                    <td>
                      <span className={`${shared.badge} ${ACTION_BADGES[e.action]}`}>
                        {ACTION_LABELS[e.action]}
                      </span>
                    </td>
                    <td>{e.target_label}</td>
                    <td className={shared.tableMuted}>{formatChanges(e.changes) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </ModuleShell>
  );
}
