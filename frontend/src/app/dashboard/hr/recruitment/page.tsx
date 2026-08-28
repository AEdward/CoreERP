"use client";

import { Fragment, useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import {
  api,
  ApiError,
  type Applicant,
  type Department,
  type EmployeePickerEntry,
  type JobVacancy,
  type OnboardingTask,
  type Position,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const VACANCY_STATUS_LABELS: Record<JobVacancy["status"], string> = {
  open: "Open",
  on_hold: "On hold",
  closed: "Closed",
};

const VACANCY_STATUS_BADGES: Record<JobVacancy["status"], string> = {
  open: shared.badgeSuccess,
  on_hold: shared.badgeWarn,
  closed: "",
};

const APPLICANT_STATUS_LABELS: Record<Applicant["status"], string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
};

const APPLICANT_STATUS_BADGES: Record<Applicant["status"], string> = {
  applied: "",
  screening: shared.badgeWarn,
  interview: shared.badgeWarn,
  offer: shared.badgeWarn,
  hired: shared.badgeSuccess,
  rejected: "",
};

const NEXT_STATUS: Partial<Record<Applicant["status"], Applicant["status"]>> = {
  applied: "screening",
  screening: "interview",
  interview: "offer",
};

export default function RecruitmentPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [vacancies, setVacancies] = useState<JobVacancy[] | null>(null);
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [employees, setEmployees] = useState<EmployeePickerEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [vacancyForm, setVacancyForm] = useState({
    title: "",
    department: "",
    position: "",
    openings: "1",
    posted_date: "",
  });
  const [vacancyWorking, setVacancyWorking] = useState(false);
  const [vacancyError, setVacancyError] = useState<string | null>(null);

  const [expandedVacancyId, setExpandedVacancyId] = useState<number | null>(null);
  const [applicants, setApplicants] = useState<Applicant[] | null>(null);
  const [applicantForm, setApplicantForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    applied_date: "",
    referred_by: "",
  });
  const [applicantWorking, setApplicantWorking] = useState(false);
  const [applicantError, setApplicantError] = useState<string | null>(null);

  const [onboardingEmployeeId, setOnboardingEmployeeId] = useState("");
  const [onboardingTasks, setOnboardingTasks] = useState<OnboardingTask[] | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskWorking, setTaskWorking] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [v, d, p, emp] = await Promise.all([
        api.listJobVacancies(),
        api.listDepartments(),
        api.listPositions(),
        api.listEmployeePicker(),
      ]);
      setVacancies(v);
      setDepartments(d);
      setPositions(p);
      setEmployees(emp);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load recruitment data.");
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
    if (!onboardingEmployeeId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOnboardingTasks(null);
      return;
    }
    api
      .listOnboardingTasks(Number(onboardingEmployeeId))
      .then(setOnboardingTasks)
      .catch((err) => setTaskError(err instanceof ApiError ? err.message : "Failed to load onboarding tasks."));
  }, [onboardingEmployeeId]);

  async function handleCreateVacancy(e: React.FormEvent) {
    e.preventDefault();
    setVacancyWorking(true);
    setVacancyError(null);
    try {
      await api.createJobVacancy({
        title: vacancyForm.title,
        department: vacancyForm.department ? Number(vacancyForm.department) : null,
        position: vacancyForm.position ? Number(vacancyForm.position) : null,
        openings: Number(vacancyForm.openings || 1),
        posted_date: vacancyForm.posted_date,
      });
      setVacancyForm({ title: "", department: "", position: "", openings: "1", posted_date: "" });
      await loadAll();
    } catch (err) {
      setVacancyError(err instanceof ApiError ? err.message : "Failed to create vacancy.");
    } finally {
      setVacancyWorking(false);
    }
  }

  async function handleVacancyStatus(id: number, status: JobVacancy["status"]) {
    try {
      await api.updateJobVacancy(id, { status });
      await loadAll();
    } catch (err) {
      setVacancyError(err instanceof ApiError ? err.message : "Failed to update vacancy.");
    }
  }

  async function handleDeleteVacancy(id: number) {
    try {
      await api.deleteJobVacancy(id);
      await loadAll();
    } catch (err) {
      setVacancyError(err instanceof ApiError ? err.message : "Failed to delete vacancy.");
    }
  }

  async function toggleVacancy(id: number) {
    if (expandedVacancyId === id) {
      setExpandedVacancyId(null);
      setApplicants(null);
      return;
    }
    setExpandedVacancyId(id);
    try {
      setApplicants(await api.listApplicants(id));
    } catch (err) {
      setApplicantError(err instanceof ApiError ? err.message : "Failed to load applicants.");
    }
  }

  async function handleAddApplicant(e: React.FormEvent) {
    e.preventDefault();
    if (!expandedVacancyId) return;
    setApplicantWorking(true);
    setApplicantError(null);
    try {
      await api.createApplicant({
        vacancy: expandedVacancyId,
        full_name: applicantForm.full_name,
        email: applicantForm.email,
        phone: applicantForm.phone,
        applied_date: applicantForm.applied_date,
        referred_by: applicantForm.referred_by ? Number(applicantForm.referred_by) : null,
      });
      setApplicantForm({ full_name: "", email: "", phone: "", applied_date: "", referred_by: "" });
      setApplicants(await api.listApplicants(expandedVacancyId));
    } catch (err) {
      setApplicantError(err instanceof ApiError ? err.message : "Failed to add applicant.");
    } finally {
      setApplicantWorking(false);
    }
  }

  async function handleAdvanceApplicant(applicant: Applicant) {
    const next = NEXT_STATUS[applicant.status];
    if (!next || !expandedVacancyId) return;
    setApplicantWorking(true);
    try {
      await api.updateApplicant(applicant.id, { status: next });
      setApplicants(await api.listApplicants(expandedVacancyId));
    } catch (err) {
      setApplicantError(err instanceof ApiError ? err.message : "Failed to update applicant.");
    } finally {
      setApplicantWorking(false);
    }
  }

  async function handleRejectApplicant(applicant: Applicant) {
    if (!expandedVacancyId) return;
    setApplicantWorking(true);
    try {
      await api.updateApplicant(applicant.id, { status: "rejected" });
      setApplicants(await api.listApplicants(expandedVacancyId));
    } catch (err) {
      setApplicantError(err instanceof ApiError ? err.message : "Failed to reject applicant.");
    } finally {
      setApplicantWorking(false);
    }
  }

  async function handleHireApplicant(applicant: Applicant) {
    if (!expandedVacancyId) return;
    setApplicantWorking(true);
    try {
      await api.hireApplicant(applicant.id);
      setApplicants(await api.listApplicants(expandedVacancyId));
      await loadAll();
    } catch (err) {
      setApplicantError(err instanceof ApiError ? err.message : "Failed to hire applicant.");
    } finally {
      setApplicantWorking(false);
    }
  }

  async function handleDeleteApplicant(id: number) {
    if (!expandedVacancyId) return;
    try {
      await api.deleteApplicant(id);
      setApplicants(await api.listApplicants(expandedVacancyId));
    } catch (err) {
      setApplicantError(err instanceof ApiError ? err.message : "Failed to delete applicant.");
    }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!onboardingEmployeeId) return;
    setTaskWorking(true);
    setTaskError(null);
    try {
      await api.createOnboardingTask({ employee: Number(onboardingEmployeeId), title: taskTitle });
      setTaskTitle("");
      setOnboardingTasks(await api.listOnboardingTasks(Number(onboardingEmployeeId)));
    } catch (err) {
      setTaskError(err instanceof ApiError ? err.message : "Failed to add onboarding task.");
    } finally {
      setTaskWorking(false);
    }
  }

  async function handleToggleTask(task: OnboardingTask) {
    try {
      await api.updateOnboardingTask(task.id, { is_complete: !task.is_complete });
      setOnboardingTasks(await api.listOnboardingTasks(Number(onboardingEmployeeId)));
    } catch (err) {
      setTaskError(err instanceof ApiError ? err.message : "Failed to update task.");
    }
  }

  async function handleDeleteTask(id: number) {
    try {
      await api.deleteOnboardingTask(id);
      setOnboardingTasks(await api.listOnboardingTasks(Number(onboardingEmployeeId)));
    } catch (err) {
      setTaskError(err instanceof ApiError ? err.message : "Failed to delete task.");
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hr.manage") ?? false;
  const departmentName = (id: number | null) => departments?.find((d) => d.id === id)?.name ?? "—";
  const positionName = (id: number | null) => positions?.find((p) => p.id === id)?.title ?? "—";

  return (
    <ModuleShell moduleKey="hr" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Recruitment</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
            <p className={shared.hint} style={{ marginTop: 4 }}>
              <a href="/dashboard/hr">&larr; Back to HR</a>
            </p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        {/* Job Vacancies */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Job vacancies</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Department</th>
                  <th>Position</th>
                  <th>Openings</th>
                  <th>Applicants</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {vacancies?.map((v) => (
                  <Fragment key={v.id}>
                    <tr>
                      <td>
                        <button
                          type="button"
                          onClick={() => toggleVacancy(v.id)}
                          className={shared.btnGhost}
                          style={{ border: "none", padding: 0, font: "inherit", textDecoration: "underline" }}
                        >
                          {v.title}
                        </button>
                      </td>
                      <td>{departmentName(v.department)}</td>
                      <td>{positionName(v.position)}</td>
                      <td>{v.openings}</td>
                      <td>{v.applicant_count}</td>
                      <td>
                        <span className={`${shared.badge} ${VACANCY_STATUS_BADGES[v.status]}`}>
                          {VACANCY_STATUS_LABELS[v.status]}
                        </span>
                      </td>
                      {canManage && (
                        <td style={{ textAlign: "right" }}>
                          {v.status === "open" && (
                            <button
                              type="button"
                              onClick={() => handleVacancyStatus(v.id, "on_hold")}
                              className={`${shared.btn} ${shared.btnSmall}`}
                              style={{ marginRight: 6 }}
                            >
                              Hold
                            </button>
                          )}
                          {v.status === "on_hold" && (
                            <button
                              type="button"
                              onClick={() => handleVacancyStatus(v.id, "open")}
                              className={`${shared.btn} ${shared.btnSmall}`}
                              style={{ marginRight: 6 }}
                            >
                              Reopen
                            </button>
                          )}
                          {v.status !== "closed" && (
                            <button
                              type="button"
                              onClick={() => handleVacancyStatus(v.id, "closed")}
                              className={`${shared.btn} ${shared.btnSmall}`}
                              style={{ marginRight: 6 }}
                            >
                              Close
                            </button>
                          )}
                          <RowActions onDelete={() => handleDeleteVacancy(v.id)} disabled={vacancyWorking} />
                        </td>
                      )}
                    </tr>
                    {expandedVacancyId === v.id && (
                      <tr>
                        <td colSpan={7} style={{ padding: "10px 4px", background: "var(--gray-50)" }}>
                          {applicants === null ? (
                            <p className={shared.hint}>Loading applicants…</p>
                          ) : (
                            <table className={shared.table} style={{ fontSize: 13 }}>
                              <thead>
                                <tr>
                                  <th>Name</th>
                                  <th>Email</th>
                                  <th>Phone</th>
                                  <th>Applied</th>
                                  <th>Referred by</th>
                                  <th>Status</th>
                                  {canManage && <th></th>}
                                </tr>
                              </thead>
                              <tbody>
                                {applicants.map((a) => (
                                  <tr key={a.id}>
                                    <td>{a.full_name}</td>
                                    <td>{a.email}</td>
                                    <td>{a.phone}</td>
                                    <td>{a.applied_date}</td>
                                    <td className={shared.tableMuted}>{a.referred_by_name || "—"}</td>
                                    <td>
                                      <span className={`${shared.badge} ${APPLICANT_STATUS_BADGES[a.status]}`}>
                                        {APPLICANT_STATUS_LABELS[a.status]}
                                      </span>
                                    </td>
                                    {canManage && (
                                      <td style={{ textAlign: "right" }}>
                                        {NEXT_STATUS[a.status] && (
                                          <button
                                            type="button"
                                            onClick={() => handleAdvanceApplicant(a)}
                                            disabled={applicantWorking}
                                            className={`${shared.btn} ${shared.btnSmall}`}
                                            style={{ marginRight: 6 }}
                                          >
                                            Advance
                                          </button>
                                        )}
                                        {a.status === "offer" && (
                                          <button
                                            type="button"
                                            onClick={() => handleHireApplicant(a)}
                                            disabled={applicantWorking}
                                            className={`${shared.btn} ${shared.btnPrimary} ${shared.btnSmall}`}
                                            style={{ marginRight: 6 }}
                                          >
                                            Hire
                                          </button>
                                        )}
                                        {a.status !== "hired" && a.status !== "rejected" && (
                                          <button
                                            type="button"
                                            onClick={() => handleRejectApplicant(a)}
                                            disabled={applicantWorking}
                                            className={`${shared.btn} ${shared.btnSmall}`}
                                            style={{ marginRight: 6 }}
                                          >
                                            Reject
                                          </button>
                                        )}
                                        {a.status !== "hired" && (
                                          <RowActions
                                            onDelete={() => handleDeleteApplicant(a.id)}
                                            disabled={applicantWorking}
                                          />
                                        )}
                                      </td>
                                    )}
                                  </tr>
                                ))}
                                {applicants.length === 0 && (
                                  <tr>
                                    <td colSpan={7} className={shared.tableMuted}>
                                      No applicants yet.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          )}
                          {canManage && (
                            <form onSubmit={handleAddApplicant} className={shared.formRow} style={{ marginTop: 10 }}>
                              <input
                                placeholder="Full name"
                                required
                                value={applicantForm.full_name}
                                onChange={(e) => setApplicantForm({ ...applicantForm, full_name: e.target.value })}
                                className={shared.input}
                                style={{ maxWidth: 180 }}
                              />
                              <input
                                placeholder="Email"
                                type="email"
                                value={applicantForm.email}
                                onChange={(e) => setApplicantForm({ ...applicantForm, email: e.target.value })}
                                className={shared.input}
                                style={{ maxWidth: 180 }}
                              />
                              <input
                                placeholder="Phone"
                                value={applicantForm.phone}
                                onChange={(e) => setApplicantForm({ ...applicantForm, phone: e.target.value })}
                                className={shared.input}
                                style={{ maxWidth: 140 }}
                              />
                              <input
                                type="date"
                                required
                                value={applicantForm.applied_date}
                                onChange={(e) => setApplicantForm({ ...applicantForm, applied_date: e.target.value })}
                                className={shared.input}
                              />
                              <select
                                value={applicantForm.referred_by}
                                onChange={(e) => setApplicantForm({ ...applicantForm, referred_by: e.target.value })}
                                className={shared.select}
                                title="Referred by (optional)"
                              >
                                <option value="">Referred by…</option>
                                {employees?.map((emp) => (
                                  <option key={emp.id} value={emp.id}>
                                    {emp.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="submit"
                                disabled={applicantWorking || !applicantForm.full_name || !applicantForm.applied_date}
                                className={`${shared.btn} ${shared.btnPrimary}`}
                              >
                                Add applicant
                              </button>
                            </form>
                          )}
                          {applicantError && <p className={shared.errorText}>{applicantError}</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {vacancies?.length === 0 && (
                  <tr>
                    <td colSpan={7} className={shared.tableMuted}>
                      No vacancies yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleCreateVacancy} className={shared.formRow} style={{ marginTop: 12 }}>
                <input
                  placeholder="Title (e.g. Front Desk Agent)"
                  required
                  value={vacancyForm.title}
                  onChange={(e) => setVacancyForm({ ...vacancyForm, title: e.target.value })}
                  className={shared.input}
                  style={{ flex: 1, maxWidth: 220 }}
                />
                <select
                  value={vacancyForm.department}
                  onChange={(e) => setVacancyForm({ ...vacancyForm, department: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Department…</option>
                  {departments?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <select
                  value={vacancyForm.position}
                  onChange={(e) => setVacancyForm({ ...vacancyForm, position: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Position…</option>
                  {positions?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Openings"
                  type="number"
                  min={1}
                  value={vacancyForm.openings}
                  onChange={(e) => setVacancyForm({ ...vacancyForm, openings: e.target.value })}
                  className={shared.input}
                  style={{ width: 90 }}
                />
                <input
                  type="date"
                  required
                  value={vacancyForm.posted_date}
                  onChange={(e) => setVacancyForm({ ...vacancyForm, posted_date: e.target.value })}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={vacancyWorking || !vacancyForm.title || !vacancyForm.posted_date}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Post vacancy
                </button>
                {vacancyError && <p className={shared.errorText}>{vacancyError}</p>}
              </form>
            )}
          </div>
        </div>

        {/* Onboarding */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Onboarding checklist</h2>
          <p className={shared.hint} style={{ maxWidth: 700 }}>
            Pick a newly hired employee to track their onboarding checklist.
          </p>
          <div className={shared.card}>
            <select
              value={onboardingEmployeeId}
              onChange={(e) => setOnboardingEmployeeId(e.target.value)}
              className={shared.select}
              style={{ marginBottom: 12 }}
            >
              <option value="">Employee…</option>
              {employees?.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
            {onboardingEmployeeId && (
              <>
                <table className={shared.table}>
                  <tbody>
                    {onboardingTasks?.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={t.is_complete}
                              onChange={() => handleToggleTask(t)}
                              disabled={!canManage}
                            />
                            <span style={{ textDecoration: t.is_complete ? "line-through" : "none" }}>
                              {t.title}
                            </span>
                          </label>
                        </td>
                        {canManage && (
                          <td style={{ textAlign: "right" }}>
                            <RowActions onDelete={() => handleDeleteTask(t.id)} disabled={taskWorking} />
                          </td>
                        )}
                      </tr>
                    ))}
                    {onboardingTasks?.length === 0 && (
                      <tr>
                        <td colSpan={2} className={shared.tableMuted}>
                          No onboarding tasks yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {canManage && (
                  <form onSubmit={handleAddTask} className={shared.formRow} style={{ marginTop: 12 }}>
                    <input
                      placeholder="Task (e.g. Issue laptop)"
                      required
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className={shared.input}
                      style={{ flex: 1, maxWidth: 240 }}
                    />
                    <button
                      type="submit"
                      disabled={taskWorking || !taskTitle}
                      className={`${shared.btn} ${shared.btnPrimary}`}
                    >
                      Add task
                    </button>
                    {taskError && <p className={shared.errorText}>{taskError}</p>}
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
