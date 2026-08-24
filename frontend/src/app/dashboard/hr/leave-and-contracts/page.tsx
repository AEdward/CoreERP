"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ActivityPanel } from "@/components/ActivityPanel";
import { ApprovalPanel } from "@/components/ApprovalPanel";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { NotesPanel } from "@/components/NotesPanel";
import { RowActions } from "@/components/RowActions";
import {
  api,
  ApiError,
  type EmployeeContract,
  type EmployeePickerEntry,
  type LeaveRequest,
  type LeaveType,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";

const CONTRACT_TYPE_LABELS: Record<EmployeeContract["contract_type"], string> = {
  permanent: "Permanent",
  fixed_term: "Fixed-term",
  probation: "Probation",
  contractor: "Contractor",
};

const LEAVE_STATUS_LABELS: Record<LeaveRequest["status"], string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};

const LEAVE_STATUS_COLORS: Record<LeaveRequest["status"], string> = {
  draft: "#666",
  submitted: "#e65100",
  approved: "#2e7d32",
  rejected: "#c62828",
};

const EMPTY_CONTRACT_FORM = {
  employee: "",
  contract_type: "permanent" as EmployeeContract["contract_type"],
  start_date: "",
  end_date: "",
  salary_cents: "",
  notes: "",
};

const EMPTY_LEAVE_FORM = {
  employee: "",
  leave_type: "",
  start_date: "",
  end_date: "",
  reason: "",
};

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function LeaveAndContractsPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [contracts, setContracts] = useState<EmployeeContract[] | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[] | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[] | null>(null);
  const [employees, setEmployees] = useState<EmployeePickerEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [contractForm, setContractForm] = useState(EMPTY_CONTRACT_FORM);
  const [contractWorking, setContractWorking] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);

  const [newLeaveTypeName, setNewLeaveTypeName] = useState("");
  const [newLeaveTypePaid, setNewLeaveTypePaid] = useState(true);
  const [leaveTypeWorking, setLeaveTypeWorking] = useState(false);

  const [leaveForm, setLeaveForm] = useState(EMPTY_LEAVE_FORM);
  const [leaveWorking, setLeaveWorking] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [c, lr, lt, emp] = await Promise.all([
        api.listEmployeeContracts(),
        api.listLeaveRequests(),
        api.listLeaveTypes(),
        api.listEmployeePicker(),
      ]);
      setContracts(c);
      setLeaveRequests(lr);
      setLeaveTypes(lt);
      setEmployees(emp);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load data.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddContract(e: React.FormEvent) {
    e.preventDefault();
    setContractWorking(true);
    setContractError(null);
    try {
      await api.createEmployeeContract({
        employee: Number(contractForm.employee),
        contract_type: contractForm.contract_type,
        start_date: contractForm.start_date,
        end_date: contractForm.end_date || null,
        salary_cents: contractForm.salary_cents
          ? Math.round(Number(contractForm.salary_cents) * 100)
          : 0,
        notes: contractForm.notes,
      });
      setContractForm(EMPTY_CONTRACT_FORM);
      await loadAll();
    } catch (err) {
      setContractError(err instanceof ApiError ? err.message : "Failed to save contract.");
    } finally {
      setContractWorking(false);
    }
  }

  async function handleDeleteContract(id: number) {
    try {
      await api.deleteEmployeeContract(id);
      await loadAll();
    } catch (err) {
      setContractError(err instanceof ApiError ? err.message : "Failed to delete contract.");
    }
  }

  async function handleAddLeaveType(e: React.FormEvent) {
    e.preventDefault();
    setLeaveTypeWorking(true);
    try {
      await api.createLeaveType({ name: newLeaveTypeName, paid: newLeaveTypePaid });
      setNewLeaveTypeName("");
      setNewLeaveTypePaid(true);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save leave type.");
    } finally {
      setLeaveTypeWorking(false);
    }
  }

  async function handleAddLeaveRequest(e: React.FormEvent) {
    e.preventDefault();
    setLeaveWorking(true);
    setLeaveError(null);
    try {
      await api.createLeaveRequest({
        employee: Number(leaveForm.employee),
        leave_type: Number(leaveForm.leave_type),
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        reason: leaveForm.reason,
      });
      setLeaveForm(EMPTY_LEAVE_FORM);
      await loadAll();
    } catch (err) {
      setLeaveError(err instanceof ApiError ? err.message : "Failed to save leave request.");
    } finally {
      setLeaveWorking(false);
    }
  }

  async function handleDeleteLeaveRequest(id: number) {
    try {
      await api.deleteLeaveRequest(id);
      await loadAll();
    } catch (err) {
      setLeaveError(err instanceof ApiError ? err.message : "Failed to delete leave request.");
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hr.manage") ?? false;
  const employeeName = (id: number) => employees?.find((e) => e.id === id)?.name ?? "—";
  const leaveTypeName = (id: number) => leaveTypes?.find((t) => t.id === id)?.name ?? "—";

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <AppHeader activeMembership={activeMembership} />

      {!activeMembership ? (
        <p style={{ color: "#666" }}>
          Pick an active company on the <a href="/dashboard">dashboard</a> first.
        </p>
      ) : (
        <>
          <h1 style={{ fontSize: 20 }}>Leave & Contracts — {activeMembership.company.name}</h1>
          <p style={{ color: "#666", fontSize: 13 }}>
            <a href="/dashboard/hr">&larr; Back to HR</a>
          </p>
          {loadError && <p style={{ color: "crimson" }}>{loadError}</p>}

          {/* Employee Contracts */}
          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Employee contracts
            </h2>
            <p style={{ fontSize: 12, color: "#999", maxWidth: 600 }}>
              The formal record of an employee&apos;s terms over time — doesn&apos;t change their
              current salary automatically, that&apos;s still kept up to date on their HR record
              directly.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Employee</th>
                  <th style={{ padding: "6px 4px" }}>Type</th>
                  <th style={{ padding: "6px 4px" }}>Start</th>
                  <th style={{ padding: "6px 4px" }}>End</th>
                  <th style={{ padding: "6px 4px" }}>Salary</th>
                  <th style={{ padding: "6px 4px" }}></th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {contracts?.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{employeeName(c.employee)}</td>
                    <td style={{ padding: "6px 4px" }}>{CONTRACT_TYPE_LABELS[c.contract_type]}</td>
                    <td style={{ padding: "6px 4px" }}>{c.start_date}</td>
                    <td style={{ padding: "6px 4px" }}>{c.end_date || "Open-ended"}</td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(c.salary_cents)}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>
                      <span style={{ display: "inline-flex", gap: 6 }}>
                        <DocumentsPanel
                          target={{ appLabel: "hr", model: "employeecontract", objectId: c.id }}
                          canManage={canManage}
                        />
                        <NotesPanel
                          target={{ appLabel: "hr", model: "employeecontract", objectId: c.id }}
                          canManage={canManage}
                        />
                        <ActivityPanel
                          target={{ appLabel: "hr", model: "employeecontract", objectId: c.id }}
                        />
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        <RowActions
                          onDelete={() => handleDeleteContract(c.id)}
                          disabled={contractWorking}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {contracts?.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: "6px 4px", color: "#999" }}>
                      No contracts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form
                onSubmit={handleAddContract}
                style={{
                  marginTop: 16,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 8,
                  maxWidth: 800,
                }}
              >
                <select
                  required
                  value={contractForm.employee}
                  onChange={(e) => setContractForm({ ...contractForm, employee: e.target.value })}
                  style={{ padding: 8 }}
                >
                  <option value="">Employee…</option>
                  {employees?.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
                <select
                  value={contractForm.contract_type}
                  onChange={(e) =>
                    setContractForm({
                      ...contractForm,
                      contract_type: e.target.value as EmployeeContract["contract_type"],
                    })
                  }
                  style={{ padding: 8 }}
                >
                  <option value="permanent">Permanent</option>
                  <option value="fixed_term">Fixed-term</option>
                  <option value="probation">Probation</option>
                  <option value="contractor">Contractor</option>
                </select>
                <input
                  type="date"
                  required
                  value={contractForm.start_date}
                  onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  type="date"
                  placeholder="End (blank = open-ended)"
                  value={contractForm.end_date}
                  onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Salary"
                  type="number"
                  step="0.01"
                  value={contractForm.salary_cents}
                  onChange={(e) => setContractForm({ ...contractForm, salary_cents: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Notes (optional)"
                  value={contractForm.notes}
                  onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })}
                  style={{ padding: 8, gridColumn: "1 / -1" }}
                />
                <button
                  type="submit"
                  disabled={contractWorking || !contractForm.employee || !contractForm.start_date}
                  style={{ padding: "8px 16px" }}
                >
                  Add contract
                </button>
                {contractError && (
                  <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{contractError}</p>
                )}
              </form>
            )}
          </section>

          {/* Leave Types */}
          <section style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Leave types
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <tbody>
                {leaveTypes?.map((t) => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{t.name}</td>
                    <td style={{ padding: "6px 4px", color: "#666" }}>{t.paid ? "Paid" : "Unpaid"}</td>
                  </tr>
                ))}
                {leaveTypes?.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ padding: "6px 4px", color: "#999" }}>
                      No leave types yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddLeaveType} style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <input
                  placeholder="Leave type (e.g. Annual Leave)"
                  value={newLeaveTypeName}
                  onChange={(e) => setNewLeaveTypeName(e.target.value)}
                  style={{ padding: 8, flex: 1, maxWidth: 280 }}
                />
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={newLeaveTypePaid}
                    onChange={(e) => setNewLeaveTypePaid(e.target.checked)}
                  />
                  Paid
                </label>
                <button
                  type="submit"
                  disabled={leaveTypeWorking || !newLeaveTypeName}
                  style={{ padding: "8px 16px" }}
                >
                  Add leave type
                </button>
              </form>
            )}
          </section>

          {/* Leave Requests */}
          <section style={{ marginTop: 40, marginBottom: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Leave requests
            </h2>
            <p style={{ fontSize: 12, color: "#999", maxWidth: 600 }}>
              Request approval from the Approval panel on its row, same as Expenses and Purchase
              Requests. Approving doesn&apos;t automatically flip the employee&apos;s status to
              &quot;On leave&quot; — that&apos;s still a manual HR action.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Employee</th>
                  <th style={{ padding: "6px 4px" }}>Type</th>
                  <th style={{ padding: "6px 4px" }}>Dates</th>
                  <th style={{ padding: "6px 4px" }}>Days</th>
                  <th style={{ padding: "6px 4px" }}>Status</th>
                  <th style={{ padding: "6px 4px" }}></th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {leaveRequests?.map((lr) => (
                  <tr key={lr.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{employeeName(lr.employee)}</td>
                    <td style={{ padding: "6px 4px" }}>
                      {leaveTypeName(lr.leave_type)}
                      {lr.reason && <div style={{ fontSize: 12, color: "#999" }}>{lr.reason}</div>}
                    </td>
                    <td style={{ padding: "6px 4px" }}>
                      {lr.start_date} to {lr.end_date}
                    </td>
                    <td style={{ padding: "6px 4px" }}>{lr.days}</td>
                    <td style={{ padding: "6px 4px" }}>
                      <span style={{ color: LEAVE_STATUS_COLORS[lr.status], fontWeight: 600 }}>
                        {LEAVE_STATUS_LABELS[lr.status]}
                      </span>
                    </td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>
                      <span style={{ display: "inline-flex", gap: 6 }}>
                        <DocumentsPanel
                          target={{ appLabel: "hr", model: "leaverequest", objectId: lr.id }}
                          canManage={canManage}
                        />
                        <NotesPanel
                          target={{ appLabel: "hr", model: "leaverequest", objectId: lr.id }}
                          canManage={canManage}
                        />
                        <ActivityPanel
                          target={{ appLabel: "hr", model: "leaverequest", objectId: lr.id }}
                        />
                        <ApprovalPanel
                          target={{ appLabel: "hr", model: "leaverequest", objectId: lr.id }}
                          canManage={canManage}
                        />
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        <RowActions
                          onDelete={() => handleDeleteLeaveRequest(lr.id)}
                          disabled={leaveWorking}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {leaveRequests?.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: "6px 4px", color: "#999" }}>
                      No leave requests yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form
                onSubmit={handleAddLeaveRequest}
                style={{
                  marginTop: 16,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 8,
                  maxWidth: 800,
                }}
              >
                <select
                  required
                  value={leaveForm.employee}
                  onChange={(e) => setLeaveForm({ ...leaveForm, employee: e.target.value })}
                  style={{ padding: 8 }}
                >
                  <option value="">Employee…</option>
                  {employees?.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={leaveForm.leave_type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                  style={{ padding: 8 }}
                >
                  <option value="">Leave type…</option>
                  {leaveTypes?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  required
                  value={leaveForm.start_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  type="date"
                  required
                  value={leaveForm.end_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Reason (optional)"
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  style={{ padding: 8, gridColumn: "1 / -1" }}
                />
                <button
                  type="submit"
                  disabled={
                    leaveWorking ||
                    !leaveForm.employee ||
                    !leaveForm.leave_type ||
                    !leaveForm.start_date ||
                    !leaveForm.end_date
                  }
                  style={{ padding: "8px 16px" }}
                >
                  Request leave
                </button>
                {leaveError && (
                  <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{leaveError}</p>
                )}
              </form>
            )}
          </section>
        </>
      )}
    </main>
  );
}
