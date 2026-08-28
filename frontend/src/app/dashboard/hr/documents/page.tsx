"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { ActivityPanel } from "@/components/ActivityPanel";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { NotesPanel } from "@/components/NotesPanel";
import { RowActions } from "@/components/RowActions";
import {
  api,
  ApiError,
  type EmployeeDocument,
  type EmployeePickerEntry,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const DOC_TYPE_LABELS: Record<EmployeeDocument["doc_type"], string> = {
  id_card: "ID Card",
  passport: "Passport",
  contract: "Contract",
  certificate: "Certificate",
  work_permit: "Work Permit",
  health_check: "Health Check",
  other: "Other",
};

const EMPTY_FORM = {
  employee: "",
  doc_type: "other" as EmployeeDocument["doc_type"],
  expiry_date: "",
  notes: "",
};

function isExpired(dateStr: string) {
  return new Date(dateStr) < new Date(new Date().toDateString());
}

export default function EmployeeDocumentsPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [documents, setDocuments] = useState<EmployeeDocument[] | null>(null);
  const [expiring, setExpiring] = useState<EmployeeDocument[] | null>(null);
  const [employees, setEmployees] = useState<EmployeePickerEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [working, setWorking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [docs, exp, emp] = await Promise.all([
        api.listEmployeeDocuments(),
        api.expiringEmployeeDocuments(),
        api.listEmployeePicker(),
      ]);
      setDocuments(docs);
      setExpiring(exp);
      setEmployees(emp);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load documents.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setFormError(null);
    try {
      await api.createEmployeeDocument({
        employee: Number(form.employee),
        doc_type: form.doc_type,
        expiry_date: form.expiry_date || null,
        notes: form.notes,
      });
      setForm(EMPTY_FORM);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save document.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteEmployeeDocument(id);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to delete document.");
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hr.manage") ?? false;

  return (
    <ModuleShell moduleKey="hr" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Employee Documents</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
            <p className={shared.hint} style={{ marginTop: 4 }}>
              <a href="/dashboard/hr">&larr; Back to HR</a>
            </p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        {expiring && expiring.length > 0 && (
          <div className={shared.section}>
            <h2 className={shared.sectionTitle}>Expiring soon</h2>
            <div className={shared.card} style={{ borderColor: "var(--danger, #d33)" }}>
              <table className={shared.table}>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Document</th>
                    <th>Expiry date</th>
                  </tr>
                </thead>
                <tbody>
                  {expiring.map((d) => (
                    <tr key={d.id}>
                      <td>{d.employee_name}</td>
                      <td>{d.doc_type_display}</td>
                      <td>
                        <span className={`${shared.badge} ${shared.badgeDanger}`}>
                          {d.expiry_date}
                          {d.expiry_date && isExpired(d.expiry_date) ? " (expired)" : ""}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>All documents</h2>
          <p className={shared.hint} style={{ maxWidth: 700, marginBottom: 8 }}>
            Track ID scans, contracts, certificates, and work permits per employee, with an
            optional expiry date. Attach the actual file scan via the documents panel on each row.
          </p>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Expiry date</th>
                  <th>Notes</th>
                  <th></th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {documents?.map((d) => (
                  <tr key={d.id}>
                    <td>{d.employee_name}</td>
                    <td>{d.doc_type_display}</td>
                    <td className={shared.tableMuted}>{d.expiry_date || "No expiry"}</td>
                    <td className={shared.tableMuted}>{d.notes}</td>
                    <td style={{ textAlign: "right" }}>
                      <span style={{ display: "inline-flex", gap: 6 }}>
                        <DocumentsPanel
                          target={{ appLabel: "hr", model: "employeedocument", objectId: d.id }}
                          canManage={canManage}
                        />
                        <NotesPanel
                          target={{ appLabel: "hr", model: "employeedocument", objectId: d.id }}
                          canManage={canManage}
                        />
                        <ActivityPanel
                          target={{ appLabel: "hr", model: "employeedocument", objectId: d.id }}
                        />
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDelete(d.id)} disabled={working} />
                      </td>
                    )}
                  </tr>
                ))}
                {documents?.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No documents yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAdd} className={shared.formGrid} style={{ marginTop: 16 }}>
                <select
                  required
                  value={form.employee}
                  onChange={(e) => setForm({ ...form, employee: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Employee…</option>
                  {employees?.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
                <select
                  value={form.doc_type}
                  onChange={(e) =>
                    setForm({ ...form, doc_type: e.target.value as EmployeeDocument["doc_type"] })
                  }
                  className={shared.select}
                >
                  {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  placeholder="Expiry date (optional)"
                  value={form.expiry_date}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                  className={shared.input}
                  title="Expiry date (optional)"
                />
                <input
                  placeholder="Notes (optional)"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={shared.input}
                  style={{ gridColumn: "1 / -1" }}
                />
                <button
                  type="submit"
                  disabled={working || !form.employee}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Add document
                </button>
                {formError && (
                  <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                    {formError}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
