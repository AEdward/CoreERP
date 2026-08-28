"use client";

import { Fragment, useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import {
  api,
  ApiError,
  type AttendanceRecord,
  type Employee,
  type LeaveBalance,
  type LeaveType,
  type MyLeaveRequest,
  type MyOnboardingTask,
  type Payslip,
  type PerformanceReview,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const STATUS_LABELS: Record<Employee["status"], string> = {
  active: "Active",
  on_leave: "On leave",
  terminated: "Terminated",
};

const LEAVE_STATUS_BADGES: Record<MyLeaveRequest["status"], string> = {
  draft: "",
  submitted: shared.badgeWarn,
  approved: shared.badgeSuccess,
  rejected: "",
  cancelled: "",
};

const RATING_LABELS: Record<number, string> = {
  1: "1 — Unsatisfactory",
  2: "2 — Needs improvement",
  3: "3 — Meets expectations",
  4: "4 — Exceeds expectations",
  5: "5 — Outstanding",
};

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function MyProfilePage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [profile, setProfile] = useState<Employee | null | "unlinked">(null);
  const [leaveRequests, setLeaveRequests] = useState<MyLeaveRequest[] | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[] | null>(null);
  const [onboardingTasks, setOnboardingTasks] = useState<MyOnboardingTask[] | null>(null);
  const [payslips, setPayslips] = useState<Payslip[] | null>(null);
  const [reviews, setReviews] = useState<PerformanceReview[] | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [leaveForm, setLeaveForm] = useState({ leave_type: "", start_date: "", end_date: "", reason: "" });
  const [leaveWorking, setLeaveWorking] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [expandedPayslipId, setExpandedPayslipId] = useState<number | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[] | null>(null);

  async function loadAll() {
    try {
      const p = await api.getMyProfile().catch((err) => {
        if (err instanceof ApiError && err.status === 404) return "unlinked" as const;
        throw err;
      });
      setProfile(p);
      if (p === "unlinked") return;

      const [lr, lt, ot, ps, rv, att, bal] = await Promise.all([
        api.listMyLeaveRequests(),
        api.listMyLeaveTypes(),
        api.listMyOnboardingTasks(),
        api.listMyPayslips(),
        api.listMyPerformanceReviews(),
        api.getMyAttendance(),
        api.myLeaveBalances(),
      ]);
      setLeaveRequests(lr);
      setLeaveTypes(lt);
      setOnboardingTasks(ot);
      setPayslips(ps);
      setReviews(rv);
      setBalances(bal);
      setAttendance(att);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load your profile.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleCreateLeaveRequest(e: React.FormEvent) {
    e.preventDefault();
    setLeaveWorking(true);
    setLeaveError(null);
    try {
      await api.createMyLeaveRequest({
        leave_type: Number(leaveForm.leave_type),
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        reason: leaveForm.reason,
      });
      setLeaveForm({ leave_type: "", start_date: "", end_date: "", reason: "" });
      setLeaveRequests(await api.listMyLeaveRequests());
    } catch (err) {
      setLeaveError(err instanceof ApiError ? err.message : "Failed to create leave request.");
    } finally {
      setLeaveWorking(false);
    }
  }

  async function handleSubmitLeaveRequest(id: number) {
    setLeaveWorking(true);
    setLeaveError(null);
    try {
      await api.submitMyLeaveRequest(id);
      setLeaveRequests(await api.listMyLeaveRequests());
    } catch (err) {
      setLeaveError(err instanceof ApiError ? err.message : "Failed to submit leave request.");
    } finally {
      setLeaveWorking(false);
    }
  }

  async function handleCancelLeaveRequest(id: number) {
    setLeaveWorking(true);
    setLeaveError(null);
    try {
      await api.cancelMyLeaveRequest(id);
      setLeaveRequests(await api.listMyLeaveRequests());
      setBalances(await api.myLeaveBalances());
    } catch (err) {
      setLeaveError(err instanceof ApiError ? err.message : "Failed to cancel leave request.");
    } finally {
      setLeaveWorking(false);
    }
  }

  async function handleDeleteLeaveRequest(id: number) {
    try {
      await api.deleteMyLeaveRequest(id);
      setLeaveRequests(await api.listMyLeaveRequests());
    } catch (err) {
      setLeaveError(err instanceof ApiError ? err.message : "Failed to delete leave request.");
    }
  }

  async function handleToggleTask(task: MyOnboardingTask) {
    try {
      await api.toggleMyOnboardingTask(task.id, !task.is_complete);
      setOnboardingTasks(await api.listMyOnboardingTasks());
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to update task.");
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  return (
    <ModuleShell moduleKey="myprofile" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>My Profile</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        {profile === "unlinked" ? (
          <div className={shared.card}>
            <p className={shared.hint}>
              Your account isn&apos;t linked to an employee record in this company yet. Ask HR to set
              this up from the Employees list (Edit &rarr; Linked account).
            </p>
          </div>
        ) : profile ? (
          <>
            <div className={shared.section}>
              <h2 className={shared.sectionTitle}>Profile</h2>
              <div className={shared.card}>
                <p>
                  <strong>
                    {profile.first_name} {profile.last_name}
                  </strong>{" "}
                  — {STATUS_LABELS[profile.status]}
                </p>
                <p className={shared.tableMuted}>
                  {profile.email || "—"} · {profile.phone || "—"}
                </p>
                <p className={shared.tableMuted}>
                  Joined: {profile.joining_date || "—"} · Salary:{" "}
                  {profile.salary_cents ? formatCents(profile.salary_cents) : "—"}
                </p>
              </div>
            </div>

            {/* Leave Requests */}
            <div className={shared.section}>
              <h2 className={shared.sectionTitle}>My leave requests</h2>
              {balances && balances.length > 0 && (
                <p className={shared.hint} style={{ maxWidth: 700 }}>
                  Balances this year:{" "}
                  {balances.map((b) => `${b.leave_type_name} ${b.remaining}/${b.allocated} remaining`).join(" · ")}
                </p>
              )}
              <div className={shared.card}>
                <table className={shared.table}>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Dates</th>
                      <th>Days</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveRequests?.map((lr) => (
                      <tr key={lr.id}>
                        <td>{lr.leave_type_name}</td>
                        <td>
                          {lr.start_date} to {lr.end_date}
                        </td>
                        <td>{lr.days}</td>
                        <td>{lr.reason || "—"}</td>
                        <td>
                          <span className={`${shared.badge} ${LEAVE_STATUS_BADGES[lr.status]}`}>
                            {lr.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {lr.status === "draft" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSubmitLeaveRequest(lr.id)}
                                disabled={leaveWorking}
                                className={`${shared.btn} ${shared.btnPrimary} ${shared.btnSmall}`}
                                style={{ marginRight: 6 }}
                              >
                                Submit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLeaveRequest(lr.id)}
                                disabled={leaveWorking}
                                className={`${shared.btn} ${shared.btnSmall}`}
                              >
                                Delete
                              </button>
                            </>
                          )}
                          {(lr.status === "submitted" || lr.status === "approved") && (
                            <button
                              type="button"
                              onClick={() => handleCancelLeaveRequest(lr.id)}
                              disabled={leaveWorking}
                              className={`${shared.btn} ${shared.btnSmall}`}
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {leaveRequests?.length === 0 && (
                      <tr>
                        <td colSpan={6} className={shared.tableMuted}>
                          No leave requests yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <form onSubmit={handleCreateLeaveRequest} className={shared.formRow} style={{ marginTop: 12 }}>
                  <select
                    required
                    value={leaveForm.leave_type}
                    onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                    className={shared.select}
                  >
                    <option value="">Leave type…</option>
                    {leaveTypes?.map((lt) => (
                      <option key={lt.id} value={lt.id}>
                        {lt.name}
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
                    placeholder="Reason"
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    className={shared.input}
                    style={{ flex: 1, maxWidth: 240 }}
                  />
                  <button
                    type="submit"
                    disabled={leaveWorking || !leaveForm.leave_type || !leaveForm.start_date || !leaveForm.end_date}
                    className={`${shared.btn} ${shared.btnPrimary}`}
                  >
                    Request leave
                  </button>
                  {leaveError && <p className={shared.errorText}>{leaveError}</p>}
                </form>
              </div>
            </div>

            {/* Onboarding */}
            {onboardingTasks && onboardingTasks.length > 0 && (
              <div className={shared.section}>
                <h2 className={shared.sectionTitle}>My onboarding checklist</h2>
                <div className={shared.card}>
                  <table className={shared.table}>
                    <tbody>
                      {onboardingTasks.map((t) => (
                        <tr key={t.id}>
                          <td>
                            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <input
                                type="checkbox"
                                checked={t.is_complete}
                                onChange={() => handleToggleTask(t)}
                              />
                              <span style={{ textDecoration: t.is_complete ? "line-through" : "none" }}>
                                {t.title}
                              </span>
                            </label>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payslips */}
            <div className={shared.section}>
              <h2 className={shared.sectionTitle}>My payslips</h2>
              <div className={shared.card}>
                <table className={shared.table}>
                  <thead>
                    <tr>
                      <th>Gross</th>
                      <th>PAYE</th>
                      <th>Pension (emp.)</th>
                      <th>Net pay</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payslips?.map((p) => (
                      <Fragment key={p.id}>
                        <tr>
                          <td>{formatCents(p.gross_cents)}</td>
                          <td>{formatCents(p.paye_tax_cents)}</td>
                          <td>{formatCents(p.pension_employee_cents)}</td>
                          <td style={{ fontWeight: 600 }}>{formatCents(p.net_pay_cents)}</td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              type="button"
                              onClick={() => setExpandedPayslipId(expandedPayslipId === p.id ? null : p.id)}
                              className={`${shared.btn} ${shared.btnSmall}`}
                            >
                              {expandedPayslipId === p.id ? "Hide" : "Details"}
                            </button>
                          </td>
                        </tr>
                        {expandedPayslipId === p.id && (
                          <tr>
                            <td colSpan={5} style={{ padding: "4px 4px 8px 16px" }}>
                              <table className={shared.table} style={{ fontSize: 12 }}>
                                <tbody>
                                  {p.lines.map((line) => (
                                    <tr key={line.id}>
                                      <td>{line.label}</td>
                                      <td>
                                        {line.line_type === "deduction" ? "−" : ""}
                                        {formatCents(line.amount_cents)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                    {payslips?.length === 0 && (
                      <tr>
                        <td colSpan={5} className={shared.tableMuted}>
                          No payslips yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Performance Reviews */}
            <div className={shared.section}>
              <h2 className={shared.sectionTitle}>My performance reviews</h2>
              <div className={shared.card}>
                <table className={shared.table}>
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Rating</th>
                      <th>Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviews?.map((r) => (
                      <tr key={r.id}>
                        <td>{r.review_period}</td>
                        <td>{(r.rating && RATING_LABELS[r.rating]) || "—"}</td>
                        <td>{r.comments || "—"}</td>
                      </tr>
                    ))}
                    {reviews?.length === 0 && (
                      <tr>
                        <td colSpan={3} className={shared.tableMuted}>
                          No completed reviews yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Attendance */}
            <div className={shared.section}>
              <h2 className={shared.sectionTitle}>My recent attendance</h2>
              <div className={shared.card}>
                <table className={shared.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Clock in</th>
                      <th>Clock out</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance?.slice(0, 15).map((a) => (
                      <tr key={a.id}>
                        <td>{a.date}</td>
                        <td>{a.clock_in ?? "—"}</td>
                        <td>{a.clock_out ?? "—"}</td>
                        <td>{a.status}</td>
                      </tr>
                    ))}
                    {attendance?.length === 0 && (
                      <tr>
                        <td colSpan={4} className={shared.tableMuted}>
                          No attendance records yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <p className={shared.hint}>Loading…</p>
        )}
      </div>
    </ModuleShell>
  );
}
