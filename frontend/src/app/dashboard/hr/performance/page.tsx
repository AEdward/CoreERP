"use client";

import { Fragment, useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import {
  api,
  ApiError,
  type EmployeePickerEntry,
  type PerformanceReview,
  type ReviewCycle,
  type TrainingEnrollment,
  type TrainingProgram,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const REVIEW_STATUS_BADGES: Record<PerformanceReview["status"], string> = {
  draft: "",
  completed: shared.badgeSuccess,
};

const RATING_LABELS: Record<number, string> = {
  1: "1 — Unsatisfactory",
  2: "2 — Needs improvement",
  3: "3 — Meets expectations",
  4: "4 — Exceeds expectations",
  5: "5 — Outstanding",
};

const ENROLLMENT_STATUS_BADGES: Record<TrainingEnrollment["status"], string> = {
  enrolled: shared.badgeWarn,
  completed: shared.badgeSuccess,
  cancelled: "",
};

const RATER_TYPE_LABELS: Record<PerformanceReview["rater_type"], string> = {
  self: "Self",
  manager: "Manager",
  peer: "Peer",
  other: "Other",
};

export default function PerformancePage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [reviews, setReviews] = useState<PerformanceReview[] | null>(null);
  const [programs, setPrograms] = useState<TrainingProgram[] | null>(null);
  const [employees, setEmployees] = useState<EmployeePickerEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [reviewForm, setReviewForm] = useState({
    employee: "",
    reviewer: "",
    review_period: "",
    comments: "",
    cycle: "",
    rater_type: "manager" as PerformanceReview["rater_type"],
  });
  const [reviewWorking, setReviewWorking] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [ratingDrafts, setRatingDrafts] = useState<Record<number, string>>({});

  const [cycles, setCycles] = useState<ReviewCycle[] | null>(null);
  const [cycleForm, setCycleForm] = useState({ employee: "", review_period: "" });
  const [cycleWorking, setCycleWorking] = useState(false);
  const [cycleError, setCycleError] = useState<string | null>(null);

  const [programForm, setProgramForm] = useState({ title: "", provider: "", start_date: "" });
  const [programWorking, setProgramWorking] = useState(false);
  const [programError, setProgramError] = useState<string | null>(null);

  const [expandedProgramId, setExpandedProgramId] = useState<number | null>(null);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[] | null>(null);
  const [enrollEmployeeId, setEnrollEmployeeId] = useState("");
  const [enrollWorking, setEnrollWorking] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [r, p, emp, c] = await Promise.all([
        api.listPerformanceReviews(),
        api.listTrainingPrograms(),
        api.listEmployeePicker(),
        api.listReviewCycles(),
      ]);
      setReviews(r);
      setPrograms(p);
      setEmployees(emp);
      setCycles(c);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load performance data.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleCreateReview(e: React.FormEvent) {
    e.preventDefault();
    setReviewWorking(true);
    setReviewError(null);
    try {
      await api.createPerformanceReview({
        employee: Number(reviewForm.employee),
        reviewer: reviewForm.reviewer ? Number(reviewForm.reviewer) : null,
        cycle: reviewForm.cycle ? Number(reviewForm.cycle) : null,
        rater_type: reviewForm.rater_type,
        review_period: reviewForm.review_period,
        comments: reviewForm.comments,
      });
      setReviewForm({
        employee: "",
        reviewer: "",
        review_period: "",
        comments: "",
        cycle: "",
        rater_type: "manager",
      });
      await loadAll();
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.message : "Failed to create review.");
    } finally {
      setReviewWorking(false);
    }
  }

  async function handleCreateCycle(e: React.FormEvent) {
    e.preventDefault();
    setCycleWorking(true);
    setCycleError(null);
    try {
      await api.createReviewCycle({
        employee: Number(cycleForm.employee),
        review_period: cycleForm.review_period,
      });
      setCycleForm({ employee: "", review_period: "" });
      await loadAll();
    } catch (err) {
      setCycleError(err instanceof ApiError ? err.message : "Failed to create review cycle.");
    } finally {
      setCycleWorking(false);
    }
  }

  async function handleCloseCycle(id: number) {
    setCycleWorking(true);
    setCycleError(null);
    try {
      await api.closeReviewCycle(id);
      await loadAll();
    } catch (err) {
      setCycleError(err instanceof ApiError ? err.message : "Failed to close review cycle.");
    } finally {
      setCycleWorking(false);
    }
  }

  async function handleDeleteCycle(id: number) {
    try {
      await api.deleteReviewCycle(id);
      await loadAll();
    } catch (err) {
      setCycleError(err instanceof ApiError ? err.message : "Failed to delete review cycle.");
    }
  }

  async function handleSetRating(review: PerformanceReview) {
    const draft = ratingDrafts[review.id];
    if (!draft) return;
    try {
      await api.updatePerformanceReview(review.id, { rating: Number(draft) as PerformanceReview["rating"] });
      await loadAll();
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.message : "Failed to save rating.");
    }
  }

  async function handleCompleteReview(id: number) {
    setReviewWorking(true);
    setReviewError(null);
    try {
      await api.completePerformanceReview(id);
      await loadAll();
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.message : "Failed to complete review.");
    } finally {
      setReviewWorking(false);
    }
  }

  async function handleDeleteReview(id: number) {
    try {
      await api.deletePerformanceReview(id);
      await loadAll();
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.message : "Failed to delete review.");
    }
  }

  async function handleCreateProgram(e: React.FormEvent) {
    e.preventDefault();
    setProgramWorking(true);
    setProgramError(null);
    try {
      await api.createTrainingProgram(programForm);
      setProgramForm({ title: "", provider: "", start_date: "" });
      await loadAll();
    } catch (err) {
      setProgramError(err instanceof ApiError ? err.message : "Failed to create training program.");
    } finally {
      setProgramWorking(false);
    }
  }

  async function handleDeleteProgram(id: number) {
    try {
      await api.deleteTrainingProgram(id);
      await loadAll();
    } catch (err) {
      setProgramError(err instanceof ApiError ? err.message : "Failed to delete training program.");
    }
  }

  async function toggleProgram(id: number) {
    if (expandedProgramId === id) {
      setExpandedProgramId(null);
      setEnrollments(null);
      return;
    }
    setExpandedProgramId(id);
    try {
      setEnrollments(await api.listTrainingEnrollments(id));
    } catch (err) {
      setEnrollError(err instanceof ApiError ? err.message : "Failed to load enrollments.");
    }
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!expandedProgramId || !enrollEmployeeId) return;
    setEnrollWorking(true);
    setEnrollError(null);
    try {
      await api.createTrainingEnrollment({ program: expandedProgramId, employee: Number(enrollEmployeeId) });
      setEnrollEmployeeId("");
      setEnrollments(await api.listTrainingEnrollments(expandedProgramId));
      await loadAll();
    } catch (err) {
      setEnrollError(err instanceof ApiError ? err.message : "Failed to enroll employee.");
    } finally {
      setEnrollWorking(false);
    }
  }

  async function handleCompleteEnrollment(id: number) {
    if (!expandedProgramId) return;
    try {
      await api.completeTrainingEnrollment(id);
      setEnrollments(await api.listTrainingEnrollments(expandedProgramId));
    } catch (err) {
      setEnrollError(err instanceof ApiError ? err.message : "Failed to mark enrollment complete.");
    }
  }

  async function handleCancelEnrollment(id: number) {
    if (!expandedProgramId) return;
    try {
      await api.cancelTrainingEnrollment(id);
      setEnrollments(await api.listTrainingEnrollments(expandedProgramId));
    } catch (err) {
      setEnrollError(err instanceof ApiError ? err.message : "Failed to cancel enrollment.");
    }
  }

  async function handleDeleteEnrollment(id: number) {
    if (!expandedProgramId) return;
    try {
      await api.deleteTrainingEnrollment(id);
      setEnrollments(await api.listTrainingEnrollments(expandedProgramId));
      await loadAll();
    } catch (err) {
      setEnrollError(err instanceof ApiError ? err.message : "Failed to remove enrollment.");
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hr.manage") ?? false;
  const employeeName = (id: number | null) => employees?.find((e) => e.id === id)?.name ?? "—";

  return (
    <ModuleShell moduleKey="hr" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Performance &amp; Training</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
            <p className={shared.hint} style={{ marginTop: 4 }}>
              <a href="/dashboard/hr">&larr; Back to HR</a>
            </p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        {/* 360 Review Cycles */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>360&deg; review cycles</h2>
          <p className={shared.hint} style={{ maxWidth: 700, marginBottom: 8 }}>
            Groups several performance reviews — self, manager, peer — for the same employee and
            period into one 360&deg; view. Attach a review to a cycle below when creating it.
          </p>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Period</th>
                  <th>Reviews</th>
                  <th>Avg. rating</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {cycles?.map((c) => (
                  <tr key={c.id}>
                    <td>{c.employee_name}</td>
                    <td>{c.review_period}</td>
                    <td>{c.review_count}</td>
                    <td>{c.average_rating != null ? c.average_rating.toFixed(2) : "—"}</td>
                    <td>
                      <span className={`${shared.badge} ${c.status === "closed" ? shared.badgeSuccess : shared.badgeWarn}`}>
                        {c.status === "closed" ? "Closed" : "Open"}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        {c.status === "open" && (
                          <button
                            type="button"
                            onClick={() => handleCloseCycle(c.id)}
                            disabled={cycleWorking}
                            className={`${shared.btn} ${shared.btnSmall}`}
                            style={{ marginRight: 6 }}
                          >
                            Close
                          </button>
                        )}
                        <RowActions onDelete={() => handleDeleteCycle(c.id)} disabled={cycleWorking} />
                      </td>
                    )}
                  </tr>
                ))}
                {cycles?.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No review cycles yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleCreateCycle} className={shared.formRow} style={{ marginTop: 12 }}>
                <select
                  required
                  value={cycleForm.employee}
                  onChange={(e) => setCycleForm({ ...cycleForm, employee: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Employee…</option>
                  {employees?.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder='Period (e.g. "2026 Q3")'
                  required
                  value={cycleForm.review_period}
                  onChange={(e) => setCycleForm({ ...cycleForm, review_period: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 160 }}
                />
                <button
                  type="submit"
                  disabled={cycleWorking || !cycleForm.employee || !cycleForm.review_period}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Start cycle
                </button>
                {cycleError && <p className={shared.errorText}>{cycleError}</p>}
              </form>
            )}
          </div>
        </div>

        {/* Performance Reviews */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Performance reviews</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Reviewer</th>
                  <th>Rater type</th>
                  <th>Period</th>
                  <th>Rating</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {reviews?.map((r) => (
                  <tr key={r.id}>
                    <td>{employeeName(r.employee)}</td>
                    <td>{employeeName(r.reviewer)}</td>
                    <td className={shared.tableMuted}>{RATER_TYPE_LABELS[r.rater_type]}</td>
                    <td>{r.review_period}</td>
                    <td>
                      {r.status === "draft" && canManage ? (
                        <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <select
                            value={ratingDrafts[r.id] ?? (r.rating ? String(r.rating) : "")}
                            onChange={(e) => setRatingDrafts({ ...ratingDrafts, [r.id]: e.target.value })}
                            className={shared.select}
                          >
                            <option value="">Rating…</option>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <option key={n} value={n}>
                                {RATING_LABELS[n]}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleSetRating(r)}
                            className={`${shared.btn} ${shared.btnSmall}`}
                          >
                            Save
                          </button>
                        </span>
                      ) : (
                        (r.rating && RATING_LABELS[r.rating]) || "—"
                      )}
                    </td>
                    <td>
                      <span className={`${shared.badge} ${REVIEW_STATUS_BADGES[r.status]}`}>
                        {r.status === "draft" ? "Draft" : "Completed"}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        {r.status === "draft" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCompleteReview(r.id)}
                              disabled={reviewWorking || !r.rating}
                              className={`${shared.btn} ${shared.btnPrimary} ${shared.btnSmall}`}
                              style={{ marginRight: 6 }}
                            >
                              Complete
                            </button>
                            <RowActions onDelete={() => handleDeleteReview(r.id)} disabled={reviewWorking} />
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {reviews?.length === 0 && (
                  <tr>
                    <td colSpan={7} className={shared.tableMuted}>
                      No performance reviews yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleCreateReview} className={shared.formRow} style={{ marginTop: 12 }}>
                <select
                  required
                  value={reviewForm.employee}
                  onChange={(e) => setReviewForm({ ...reviewForm, employee: e.target.value })}
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
                  value={reviewForm.reviewer}
                  onChange={(e) => setReviewForm({ ...reviewForm, reviewer: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Reviewer…</option>
                  {employees?.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
                <select
                  value={reviewForm.rater_type}
                  onChange={(e) =>
                    setReviewForm({
                      ...reviewForm,
                      rater_type: e.target.value as PerformanceReview["rater_type"],
                    })
                  }
                  className={shared.select}
                  title="Which angle this review represents"
                >
                  {Object.entries(RATER_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={reviewForm.cycle}
                  onChange={(e) => setReviewForm({ ...reviewForm, cycle: e.target.value })}
                  className={shared.select}
                  title="Attach to a 360° review cycle (optional)"
                >
                  <option value="">No cycle…</option>
                  {cycles
                    ?.filter((c) => !reviewForm.employee || String(c.employee) === reviewForm.employee)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.employee_name} — {c.review_period}
                      </option>
                    ))}
                </select>
                <input
                  placeholder='Period (e.g. "2026 Q3")'
                  required
                  value={reviewForm.review_period}
                  onChange={(e) => setReviewForm({ ...reviewForm, review_period: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 160 }}
                />
                <input
                  placeholder="Comments"
                  value={reviewForm.comments}
                  onChange={(e) => setReviewForm({ ...reviewForm, comments: e.target.value })}
                  className={shared.input}
                  style={{ flex: 1, maxWidth: 260 }}
                />
                <button
                  type="submit"
                  disabled={reviewWorking || !reviewForm.employee || !reviewForm.review_period}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Start review
                </button>
                {reviewError && <p className={shared.errorText}>{reviewError}</p>}
              </form>
            )}
          </div>
        </div>

        {/* Training Programs */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Training programs</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Provider</th>
                  <th>Starts</th>
                  <th>Enrollments</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {programs?.map((p) => (
                  <Fragment key={p.id}>
                    <tr>
                      <td>
                        <button
                          type="button"
                          onClick={() => toggleProgram(p.id)}
                          className={shared.btnGhost}
                          style={{ border: "none", padding: 0, font: "inherit", textDecoration: "underline" }}
                        >
                          {p.title}
                        </button>
                      </td>
                      <td>{p.provider || "—"}</td>
                      <td>{p.start_date}</td>
                      <td>{p.enrollment_count}</td>
                      {canManage && (
                        <td style={{ textAlign: "right" }}>
                          <RowActions onDelete={() => handleDeleteProgram(p.id)} disabled={programWorking} />
                        </td>
                      )}
                    </tr>
                    {expandedProgramId === p.id && (
                      <tr>
                        <td colSpan={5} style={{ padding: "10px 4px", background: "var(--gray-50)" }}>
                          {enrollments === null ? (
                            <p className={shared.hint}>Loading enrollments…</p>
                          ) : (
                            <table className={shared.table} style={{ fontSize: 13 }}>
                              <thead>
                                <tr>
                                  <th>Employee</th>
                                  <th>Status</th>
                                  <th>Completed</th>
                                  {canManage && <th></th>}
                                </tr>
                              </thead>
                              <tbody>
                                {enrollments.map((en) => (
                                  <tr key={en.id}>
                                    <td>{employeeName(en.employee)}</td>
                                    <td>
                                      <span className={`${shared.badge} ${ENROLLMENT_STATUS_BADGES[en.status]}`}>
                                        {en.status}
                                      </span>
                                    </td>
                                    <td>{en.completion_date ?? "—"}</td>
                                    {canManage && (
                                      <td style={{ textAlign: "right" }}>
                                        {en.status === "enrolled" && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => handleCompleteEnrollment(en.id)}
                                              disabled={enrollWorking}
                                              className={`${shared.btn} ${shared.btnSmall}`}
                                              style={{ marginRight: 6 }}
                                            >
                                              Complete
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleCancelEnrollment(en.id)}
                                              disabled={enrollWorking}
                                              className={`${shared.btn} ${shared.btnSmall}`}
                                              style={{ marginRight: 6 }}
                                            >
                                              Cancel
                                            </button>
                                          </>
                                        )}
                                        <RowActions
                                          onDelete={() => handleDeleteEnrollment(en.id)}
                                          disabled={enrollWorking}
                                        />
                                      </td>
                                    )}
                                  </tr>
                                ))}
                                {enrollments.length === 0 && (
                                  <tr>
                                    <td colSpan={4} className={shared.tableMuted}>
                                      No enrollments yet.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          )}
                          {canManage && (
                            <form onSubmit={handleEnroll} className={shared.formRow} style={{ marginTop: 10 }}>
                              <select
                                required
                                value={enrollEmployeeId}
                                onChange={(e) => setEnrollEmployeeId(e.target.value)}
                                className={shared.select}
                              >
                                <option value="">Employee…</option>
                                {employees?.map((emp) => (
                                  <option key={emp.id} value={emp.id}>
                                    {emp.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="submit"
                                disabled={enrollWorking || !enrollEmployeeId}
                                className={`${shared.btn} ${shared.btnPrimary}`}
                              >
                                Enroll
                              </button>
                            </form>
                          )}
                          {enrollError && <p className={shared.errorText}>{enrollError}</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {programs?.length === 0 && (
                  <tr>
                    <td colSpan={5} className={shared.tableMuted}>
                      No training programs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleCreateProgram} className={shared.formRow} style={{ marginTop: 12 }}>
                <input
                  placeholder="Title (e.g. Fire Safety)"
                  required
                  value={programForm.title}
                  onChange={(e) => setProgramForm({ ...programForm, title: e.target.value })}
                  className={shared.input}
                  style={{ flex: 1, maxWidth: 220 }}
                />
                <input
                  placeholder="Provider"
                  value={programForm.provider}
                  onChange={(e) => setProgramForm({ ...programForm, provider: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 180 }}
                />
                <input
                  type="date"
                  required
                  value={programForm.start_date}
                  onChange={(e) => setProgramForm({ ...programForm, start_date: e.target.value })}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={programWorking || !programForm.title || !programForm.start_date}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Add program
                </button>
                {programError && <p className={shared.errorText}>{programError}</p>}
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
