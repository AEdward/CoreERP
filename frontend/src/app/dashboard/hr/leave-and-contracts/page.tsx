"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
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
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
  type Offboarding,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

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
  cancelled: "Cancelled",
};

const LEAVE_STATUS_BADGES: Record<LeaveRequest["status"], string> = {
  draft: "",
  submitted: shared.badgeWarn,
  approved: shared.badgeSuccess,
  rejected: shared.badgeDanger,
  cancelled: "",
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

const OFFBOARDING_REASON_LABELS: Record<Offboarding["reason"], string> = {
  resignation: "Resignation",
  termination: "Termination",
  retirement: "Retirement",
  other: "Other",
};

const EMPTY_OFFBOARDING_FORM = {
  employee: "",
  reason: "resignation" as Offboarding["reason"],
  resignation_date: "",
  last_working_day: "",
  exit_interview_notes: "",
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
  const [newLeaveTypeDays, setNewLeaveTypeDays] = useState("");
  const [leaveTypeWorking, setLeaveTypeWorking] = useState(false);

  const [leaveForm, setLeaveForm] = useState(EMPTY_LEAVE_FORM);
  const [leaveWorking, setLeaveWorking] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[] | null>(null);

  const [offboardings, setOffboardings] = useState<Offboarding[] | null>(null);
  const [offboardingForm, setOffboardingForm] = useState(EMPTY_OFFBOARDING_FORM);
  const [offboardingWorking, setOffboardingWorking] = useState(false);
  const [offboardingError, setOffboardingError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [c, lr, lt, emp, off] = await Promise.all([
        api.listEmployeeContracts(),
        api.listLeaveRequests(),
        api.listLeaveTypes(),
        api.listEmployeePicker(),
        api.listOffboardings(),
      ]);
      setContracts(c);
      setLeaveRequests(lr);
      setLeaveTypes(lt);
      setEmployees(emp);
      setOffboardings(off);
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

  useEffect(() => {
    if (!leaveForm.employee) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBalances(null);
      return;
    }
    api
      .leaveBalances(Number(leaveForm.employee))
      .then(setBalances)
      .catch(() => setBalances(null));
  }, [leaveForm.employee]);

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
      await api.createLeaveType({
        name: newLeaveTypeName,
        paid: newLeaveTypePaid,
        default_days_per_year: newLeaveTypeDays ? Number(newLeaveTypeDays) : 0,
      });
      setNewLeaveTypeName("");
      setNewLeaveTypePaid(true);
      setNewLeaveTypeDays("");
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save leave type.");
    } finally {
      setLeaveTypeWorking(false);
    }
  }

  async function handleCancelLeaveRequest(id: number) {
    setLeaveWorking(true);
    setLeaveError(null);
    try {
      await api.cancelLeaveRequest(id);
      await loadAll();
    } catch (err) {
      setLeaveError(err instanceof ApiError ? err.message : "Failed to cancel leave request.");
    } finally {
      setLeaveWorking(false);
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

  async function handleAddOffboarding(e: React.FormEvent) {
    e.preventDefault();
    setOffboardingWorking(true);
    setOffboardingError(null);
    try {
      await api.createOffboarding({
        employee: Number(offboardingForm.employee),
        reason: offboardingForm.reason,
        resignation_date: offboardingForm.resignation_date,
        last_working_day: offboardingForm.last_working_day,
        exit_interview_notes: offboardingForm.exit_interview_notes,
      });
      setOffboardingForm(EMPTY_OFFBOARDING_FORM);
      await loadAll();
    } catch (err) {
      setOffboardingError(err instanceof ApiError ? err.message : "Failed to start offboarding.");
    } finally {
      setOffboardingWorking(false);
    }
  }

  async function handleToggleClearance(o: Offboarding, field: "clearance_it" | "clearance_finance" | "clearance_admin") {
    setOffboardingWorking(true);
    setOffboardingError(null);
    try {
      await api.updateOffboarding(o.id, { [field]: !o[field] });
      await loadAll();
    } catch (err) {
      setOffboardingError(err instanceof ApiError ? err.message : "Failed to update clearance.");
    } finally {
      setOffboardingWorking(false);
    }
  }

  async function handleCompleteOffboarding(id: number) {
    setOffboardingWorking(true);
    setOffboardingError(null);
    try {
      await api.completeOffboarding(id);
      await loadAll();
    } catch (err) {
      setOffboardingError(err instanceof ApiError ? err.message : "Failed to complete offboarding.");
    } finally {
      setOffboardingWorking(false);
    }
  }

  async function handleDeleteOffboarding(id: number) {
    try {
      await api.deleteOffboarding(id);
      await loadAll();
    } catch (err) {
      setOffboardingError(err instanceof ApiError ? err.message : "Failed to delete offboarding.");
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hr.manage") ?? false;
  const employeeName = (id: number) => employees?.find((e) => e.id === id)?.name ?? "—";
  const leaveTypeName = (id: number) => leaveTypes?.find((t) => t.id === id)?.name ?? "—";

  return (
    <ModuleShell moduleKey="hr" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Leave & Contracts</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
            <p className={shared.hint} style={{ marginTop: 4 }}>
              <a href="/dashboard/hr">&larr; Back to HR</a>
            </p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        {/* Employee Contracts */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Employee contracts</h2>
          <p className={shared.hint} style={{ maxWidth: 600, marginBottom: 8 }}>
            The formal record of an employee&apos;s terms over time — doesn&apos;t change their
            current salary automatically, that&apos;s still kept up to date on their HR record
            directly.
          </p>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Salary</th>
                  <th></th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {contracts?.map((c) => (
                  <tr key={c.id}>
                    <td>{employeeName(c.employee)}</td>
                    <td>{CONTRACT_TYPE_LABELS[c.contract_type]}</td>
                    <td>{c.start_date}</td>
                    <td>{c.end_date || "Open-ended"}</td>
                    <td>{formatCents(c.salary_cents)}</td>
                    <td style={{ textAlign: "right" }}>
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
                      <td style={{ textAlign: "right" }}>
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
                    <td colSpan={7} className={shared.tableMuted}>
                      No contracts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddContract} className={shared.formGrid} style={{ marginTop: 16 }}>
                <select
                  required
                  value={contractForm.employee}
                  onChange={(e) => setContractForm({ ...contractForm, employee: e.target.value })}
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
                  value={contractForm.contract_type}
                  onChange={(e) =>
                    setContractForm({
                      ...contractForm,
                      contract_type: e.target.value as EmployeeContract["contract_type"],
                    })
                  }
                  className={shared.select}
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
                  className={shared.input}
                />
                <input
                  type="date"
                  placeholder="End (blank = open-ended)"
                  value={contractForm.end_date}
                  onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Salary"
                  type="number"
                  step="0.01"
                  value={contractForm.salary_cents}
                  onChange={(e) => setContractForm({ ...contractForm, salary_cents: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Notes (optional)"
                  value={contractForm.notes}
                  onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })}
                  className={shared.input}
                  style={{ gridColumn: "1 / -1" }}
                />
                <button
                  type="submit"
                  disabled={contractWorking || !contractForm.employee || !contractForm.start_date}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Add contract
                </button>
                {contractError && (
                  <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                    {contractError}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Leave Types */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Leave types</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <tbody>
                {leaveTypes?.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td className={shared.tableMuted}>{t.paid ? "Paid" : "Unpaid"}</td>
                    <td className={shared.tableMuted}>
                      {t.default_days_per_year ? `${t.default_days_per_year} days/year` : "No allocation"}
                    </td>
                  </tr>
                ))}
                {leaveTypes?.length === 0 && (
                  <tr>
                    <td colSpan={3} className={shared.tableMuted}>
                      No leave types yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddLeaveType} className={shared.formRow} style={{ marginTop: 12 }}>
                <input
                  placeholder="Leave type (e.g. Annual Leave)"
                  value={newLeaveTypeName}
                  onChange={(e) => setNewLeaveTypeName(e.target.value)}
                  className={shared.input}
                  style={{ flex: 1, maxWidth: 280 }}
                />
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={newLeaveTypePaid}
                    onChange={(e) => setNewLeaveTypePaid(e.target.checked)}
                  />
                  Paid
                </label>
                <input
                  placeholder="Days/year"
                  type="number"
                  min={0}
                  value={newLeaveTypeDays}
                  onChange={(e) => setNewLeaveTypeDays(e.target.value)}
                  className={shared.input}
                  style={{ width: 100 }}
                  title="Annual entitlement — 0 means no tracked allocation"
                />
                <button
                  type="submit"
                  disabled={leaveTypeWorking || !newLeaveTypeName}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Add leave type
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Leave Requests */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Leave requests</h2>
          <p className={shared.hint} style={{ maxWidth: 600, marginBottom: 8 }}>
            Request approval from the Approval panel on its row, same as Expenses and Purchase
            Requests. Approving a request that covers today automatically flips the employee to
            &quot;On leave&quot;; cancelling an active approved request flips it back.
          </p>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Status</th>
                  <th></th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {leaveRequests?.map((lr) => (
                  <tr key={lr.id}>
                    <td>{employeeName(lr.employee)}</td>
                    <td>
                      {leaveTypeName(lr.leave_type)}
                      {lr.reason && <div className={shared.tableMuted}>{lr.reason}</div>}
                    </td>
                    <td>
                      {lr.start_date} to {lr.end_date}
                    </td>
                    <td>{lr.days}</td>
                    <td>
                      <span className={`${shared.badge} ${LEAVE_STATUS_BADGES[lr.status]}`}>
                        {LEAVE_STATUS_LABELS[lr.status]}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
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
                      <td style={{ textAlign: "right" }}>
                        {(lr.status === "submitted" || lr.status === "approved") && (
                          <button
                            type="button"
                            onClick={() => handleCancelLeaveRequest(lr.id)}
                            disabled={leaveWorking}
                            className={`${shared.btn} ${shared.btnSmall}`}
                            style={{ marginRight: 6 }}
                          >
                            Cancel
                          </button>
                        )}
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
                    <td colSpan={7} className={shared.tableMuted}>
                      No leave requests yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && balances && balances.length > 0 && (
              <div className={shared.hint} style={{ marginTop: 12 }}>
                Balances this year:{" "}
                {balances.map((b) => `${b.leave_type_name} ${b.remaining}/${b.allocated} remaining`).join(" · ")}
              </div>
            )}
            {canManage && (
              <form onSubmit={handleAddLeaveRequest} className={shared.formGrid} style={{ marginTop: 16 }}>
                <select
                  required
                  value={leaveForm.employee}
                  onChange={(e) => setLeaveForm({ ...leaveForm, employee: e.target.value })}
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
                  required
                  value={leaveForm.leave_type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                  className={shared.select}
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
                  className={shared.input}
                />
                <input
                  type="date"
                  required
                  value={leaveForm.end_date}
                  onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Reason (optional)"
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  className={shared.input}
                  style={{ gridColumn: "1 / -1" }}
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
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Request leave
                </button>
                {leaveError && (
                  <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                    {leaveError}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Offboarding */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Offboarding</h2>
          <p className={shared.hint} style={{ maxWidth: 700, marginBottom: 8 }}>
            Starting offboarding doesn&apos;t change the employee&apos;s status by itself — they may
            still be actively working through their notice period. Only completing it, once all
            three clearances are checked, flips the employee to Terminated.
          </p>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Reason</th>
                  <th>Resignation date</th>
                  <th>Last working day</th>
                  <th>Clearances</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {offboardings?.map((o) => (
                  <tr key={o.id}>
                    <td>{o.employee_name}</td>
                    <td>{OFFBOARDING_REASON_LABELS[o.reason]}</td>
                    <td>{o.resignation_date}</td>
                    <td>{o.last_working_day}</td>
                    <td>
                      {(["clearance_it", "clearance_finance", "clearance_admin"] as const).map((field) => (
                        <label
                          key={field}
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 10, fontSize: 13 }}
                        >
                          <input
                            type="checkbox"
                            checked={o[field]}
                            disabled={!canManage || o.status === "completed" || offboardingWorking}
                            onChange={() => handleToggleClearance(o, field)}
                          />
                          {field === "clearance_it" ? "IT" : field === "clearance_finance" ? "Finance" : "Admin"}
                        </label>
                      ))}
                    </td>
                    <td>
                      <span className={`${shared.badge} ${o.status === "completed" ? shared.badgeSuccess : shared.badgeWarn}`}>
                        {o.status === "completed" ? "Completed" : "In progress"}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        {o.status === "in_progress" && (
                          <button
                            type="button"
                            onClick={() => handleCompleteOffboarding(o.id)}
                            disabled={
                              offboardingWorking || !o.clearance_it || !o.clearance_finance || !o.clearance_admin
                            }
                            className={`${shared.btn} ${shared.btnSmall}`}
                            style={{ marginRight: 6 }}
                          >
                            Complete
                          </button>
                        )}
                        <RowActions
                          onDelete={() => handleDeleteOffboarding(o.id)}
                          disabled={offboardingWorking}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {offboardings?.length === 0 && (
                  <tr>
                    <td colSpan={7} className={shared.tableMuted}>
                      No offboarding records yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddOffboarding} className={shared.formGrid} style={{ marginTop: 16 }}>
                <select
                  required
                  value={offboardingForm.employee}
                  onChange={(e) => setOffboardingForm({ ...offboardingForm, employee: e.target.value })}
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
                  value={offboardingForm.reason}
                  onChange={(e) =>
                    setOffboardingForm({
                      ...offboardingForm,
                      reason: e.target.value as Offboarding["reason"],
                    })
                  }
                  className={shared.select}
                >
                  <option value="resignation">Resignation</option>
                  <option value="termination">Termination</option>
                  <option value="retirement">Retirement</option>
                  <option value="other">Other</option>
                </select>
                <input
                  type="date"
                  required
                  value={offboardingForm.resignation_date}
                  onChange={(e) =>
                    setOffboardingForm({ ...offboardingForm, resignation_date: e.target.value })
                  }
                  className={shared.input}
                  title="Resignation / notice date"
                />
                <input
                  type="date"
                  required
                  value={offboardingForm.last_working_day}
                  onChange={(e) =>
                    setOffboardingForm({ ...offboardingForm, last_working_day: e.target.value })
                  }
                  className={shared.input}
                  title="Last working day"
                />
                <input
                  placeholder="Exit interview notes (optional)"
                  value={offboardingForm.exit_interview_notes}
                  onChange={(e) =>
                    setOffboardingForm({ ...offboardingForm, exit_interview_notes: e.target.value })
                  }
                  className={shared.input}
                  style={{ gridColumn: "1 / -1" }}
                />
                <button
                  type="submit"
                  disabled={
                    offboardingWorking ||
                    !offboardingForm.employee ||
                    !offboardingForm.resignation_date ||
                    !offboardingForm.last_working_day
                  }
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Start offboarding
                </button>
                {offboardingError && (
                  <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                    {offboardingError}
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
