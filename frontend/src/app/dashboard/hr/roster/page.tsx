"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import {
  api,
  ApiError,
  type EmployeePickerEntry,
  type ShiftAssignment,
  type ShiftSwapRequest,
  type ShiftTemplate,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const SWAP_STATUS_LABELS: Record<ShiftSwapRequest["status"], string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const SWAP_STATUS_BADGES: Record<ShiftSwapRequest["status"], string> = {
  pending: shared.badgeWarn,
  approved: shared.badgeSuccess,
  rejected: shared.badgeDanger,
};

const EMPTY_ASSIGNMENT_FORM = { employee: "", shift_template: "", date: "", notes: "" };
const EMPTY_SWAP_FORM = { assignment: "", proposed_employee: "", reason: "" };

export default function ShiftRosterPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [assignments, setAssignments] = useState<ShiftAssignment[] | null>(null);
  const [swaps, setSwaps] = useState<ShiftSwapRequest[] | null>(null);
  const [shifts, setShifts] = useState<ShiftTemplate[] | null>(null);
  const [employees, setEmployees] = useState<EmployeePickerEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [assignmentForm, setAssignmentForm] = useState(EMPTY_ASSIGNMENT_FORM);
  const [assignmentWorking, setAssignmentWorking] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

  const [swapForm, setSwapForm] = useState(EMPTY_SWAP_FORM);
  const [swapWorking, setSwapWorking] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [a, s, sh, emp] = await Promise.all([
        api.listShiftAssignments(),
        api.listShiftSwapRequests(),
        api.listShifts(),
        api.listEmployeePicker(),
      ]);
      setAssignments(a);
      setSwaps(s);
      setShifts(sh);
      setEmployees(emp);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load roster data.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddAssignment(e: React.FormEvent) {
    e.preventDefault();
    setAssignmentWorking(true);
    setAssignmentError(null);
    try {
      await api.createShiftAssignment({
        employee: Number(assignmentForm.employee),
        shift_template: Number(assignmentForm.shift_template),
        date: assignmentForm.date,
        notes: assignmentForm.notes,
      });
      setAssignmentForm(EMPTY_ASSIGNMENT_FORM);
      await loadAll();
    } catch (err) {
      setAssignmentError(err instanceof ApiError ? err.message : "Failed to save shift assignment.");
    } finally {
      setAssignmentWorking(false);
    }
  }

  async function handleDeleteAssignment(id: number) {
    try {
      await api.deleteShiftAssignment(id);
      await loadAll();
    } catch (err) {
      setAssignmentError(err instanceof ApiError ? err.message : "Failed to delete shift assignment.");
    }
  }

  async function handleAddSwap(e: React.FormEvent) {
    e.preventDefault();
    setSwapWorking(true);
    setSwapError(null);
    try {
      await api.createShiftSwapRequest({
        assignment: Number(swapForm.assignment),
        proposed_employee: Number(swapForm.proposed_employee),
        reason: swapForm.reason,
      });
      setSwapForm(EMPTY_SWAP_FORM);
      await loadAll();
    } catch (err) {
      setSwapError(err instanceof ApiError ? err.message : "Failed to save swap request.");
    } finally {
      setSwapWorking(false);
    }
  }

  async function handleApproveSwap(id: number) {
    setSwapWorking(true);
    setSwapError(null);
    try {
      await api.approveShiftSwapRequest(id);
      await loadAll();
    } catch (err) {
      setSwapError(err instanceof ApiError ? err.message : "Failed to approve swap request.");
    } finally {
      setSwapWorking(false);
    }
  }

  async function handleRejectSwap(id: number) {
    setSwapWorking(true);
    setSwapError(null);
    try {
      await api.rejectShiftSwapRequest(id);
      await loadAll();
    } catch (err) {
      setSwapError(err instanceof ApiError ? err.message : "Failed to reject swap request.");
    } finally {
      setSwapWorking(false);
    }
  }

  async function handleDeleteSwap(id: number) {
    try {
      await api.deleteShiftSwapRequest(id);
      await loadAll();
    } catch (err) {
      setSwapError(err instanceof ApiError ? err.message : "Failed to delete swap request.");
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
            <h1 className={shared.pageTitle}>Shift Roster</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
            <p className={shared.hint} style={{ marginTop: 4 }}>
              <a href="/dashboard/hr">&larr; Back to HR</a>
            </p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Roster</h2>
          <p className={shared.hint} style={{ maxWidth: 700, marginBottom: 8 }}>
            One shift per employee per date. An employee&apos;s default `Shift` on their HR record
            is still used by Attendance/Overtime for any day without a dated assignment here.
          </p>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Shift</th>
                  <th>Date</th>
                  <th>Notes</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {assignments?.map((a) => (
                  <tr key={a.id}>
                    <td>{a.employee_name}</td>
                    <td>
                      {a.shift_template_name}
                      <div className={shared.tableMuted}>
                        {a.start_time}–{a.end_time}
                      </div>
                    </td>
                    <td>{a.date}</td>
                    <td className={shared.tableMuted}>{a.notes}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions
                          onDelete={() => handleDeleteAssignment(a.id)}
                          disabled={assignmentWorking}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {assignments?.length === 0 && (
                  <tr>
                    <td colSpan={5} className={shared.tableMuted}>
                      No shift assignments yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddAssignment} className={shared.formGrid} style={{ marginTop: 16 }}>
                <select
                  required
                  value={assignmentForm.employee}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, employee: e.target.value })}
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
                  value={assignmentForm.shift_template}
                  onChange={(e) =>
                    setAssignmentForm({ ...assignmentForm, shift_template: e.target.value })
                  }
                  className={shared.select}
                >
                  <option value="">Shift…</option>
                  {shifts?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  required
                  value={assignmentForm.date}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, date: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Notes (optional)"
                  value={assignmentForm.notes}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, notes: e.target.value })}
                  className={shared.input}
                  style={{ gridColumn: "1 / -1" }}
                />
                <button
                  type="submit"
                  disabled={
                    assignmentWorking ||
                    !assignmentForm.employee ||
                    !assignmentForm.shift_template ||
                    !assignmentForm.date
                  }
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Add assignment
                </button>
                {assignmentError && (
                  <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                    {assignmentError}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Shift swap requests</h2>
          <p className={shared.hint} style={{ maxWidth: 700, marginBottom: 8 }}>
            &quot;Can someone cover my shift&quot; — approving reassigns the underlying roster
            entry to the proposed employee; the date and shift stay the same.
          </p>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Shift</th>
                  <th>Currently</th>
                  <th>Proposed</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {swaps?.map((s) => (
                  <tr key={s.id}>
                    <td>{s.date}</td>
                    <td>{s.shift_template_name}</td>
                    <td>{s.current_employee_name}</td>
                    <td>
                      {s.proposed_employee_name}
                      {s.reason && <div className={shared.tableMuted}>{s.reason}</div>}
                    </td>
                    <td>
                      <span className={`${shared.badge} ${SWAP_STATUS_BADGES[s.status]}`}>
                        {SWAP_STATUS_LABELS[s.status]}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        {s.status === "pending" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApproveSwap(s.id)}
                              disabled={swapWorking}
                              className={`${shared.btn} ${shared.btnSmall}`}
                              style={{ marginRight: 6 }}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectSwap(s.id)}
                              disabled={swapWorking}
                              className={`${shared.btn} ${shared.btnSmall}`}
                              style={{ marginRight: 6 }}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <RowActions onDelete={() => handleDeleteSwap(s.id)} disabled={swapWorking} />
                      </td>
                    )}
                  </tr>
                ))}
                {swaps?.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No swap requests yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddSwap} className={shared.formGrid} style={{ marginTop: 16 }}>
                <select
                  required
                  value={swapForm.assignment}
                  onChange={(e) => setSwapForm({ ...swapForm, assignment: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Roster entry…</option>
                  {assignments?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.date} — {a.employee_name} ({a.shift_template_name})
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={swapForm.proposed_employee}
                  onChange={(e) => setSwapForm({ ...swapForm, proposed_employee: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Proposed employee…</option>
                  {employees?.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Reason (optional)"
                  value={swapForm.reason}
                  onChange={(e) => setSwapForm({ ...swapForm, reason: e.target.value })}
                  className={shared.input}
                  style={{ gridColumn: "1 / -1" }}
                />
                <button
                  type="submit"
                  disabled={swapWorking || !swapForm.assignment || !swapForm.proposed_employee}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Request swap
                </button>
                {swapError && (
                  <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                    {swapError}
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
