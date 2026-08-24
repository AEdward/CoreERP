"use client";

import { Fragment, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { RowActions } from "@/components/RowActions";
import {
  api,
  ApiError,
  type EmployeePickerEntry,
  type EmployeeSalaryComponent,
  type PayrollRun,
  type Payslip,
  type SalaryComponent,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";

const RUN_STATUS_LABELS: Record<PayrollRun["status"], string> = {
  draft: "Draft",
  processed: "Processed",
  paid: "Paid",
};

const RUN_STATUS_COLORS: Record<PayrollRun["status"], string> = {
  draft: "#666",
  processed: "#e65100",
  paid: "#2e7d32",
};

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function PayrollPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [components, setComponents] = useState<SalaryComponent[] | null>(null);
  const [assignments, setAssignments] = useState<EmployeeSalaryComponent[] | null>(null);
  const [runs, setRuns] = useState<PayrollRun[] | null>(null);
  const [employees, setEmployees] = useState<EmployeePickerEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [componentForm, setComponentForm] = useState({
    name: "",
    category: "earning" as SalaryComponent["category"],
    is_taxable: true,
  });
  const [componentWorking, setComponentWorking] = useState(false);

  const [assignForm, setAssignForm] = useState({ employee: "", component: "", amount_cents: "" });
  const [assignWorking, setAssignWorking] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [runForm, setRunForm] = useState({ label: "", start_date: "", end_date: "" });
  const [runWorking, setRunWorking] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);
  const [runPayslips, setRunPayslips] = useState<Payslip[] | null>(null);
  const [expandedPayslipId, setExpandedPayslipId] = useState<number | null>(null);

  async function loadAll() {
    try {
      const [c, a, r, emp] = await Promise.all([
        api.listSalaryComponents(),
        api.listEmployeeSalaryComponents(),
        api.listPayrollRuns(),
        api.listEmployeePicker(),
      ]);
      setComponents(c);
      setAssignments(a);
      setRuns(r);
      setEmployees(emp);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load payroll data.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddComponent(e: React.FormEvent) {
    e.preventDefault();
    setComponentWorking(true);
    try {
      await api.createSalaryComponent(componentForm);
      setComponentForm({ name: "", category: "earning", is_taxable: true });
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save component.");
    } finally {
      setComponentWorking(false);
    }
  }

  async function handleDeleteComponent(id: number) {
    try {
      await api.deleteSalaryComponent(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to delete component.");
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setAssignWorking(true);
    setAssignError(null);
    try {
      await api.createEmployeeSalaryComponent({
        employee: Number(assignForm.employee),
        component: Number(assignForm.component),
        amount_cents: Math.round(Number(assignForm.amount_cents || 0) * 100),
      });
      setAssignForm({ employee: "", component: "", amount_cents: "" });
      await loadAll();
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.message : "Failed to assign component.");
    } finally {
      setAssignWorking(false);
    }
  }

  async function handleUnassign(id: number) {
    try {
      await api.deleteEmployeeSalaryComponent(id);
      await loadAll();
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.message : "Failed to remove assignment.");
    }
  }

  async function handleCreateRun(e: React.FormEvent) {
    e.preventDefault();
    setRunWorking(true);
    setRunError(null);
    try {
      await api.createPayrollRun(runForm);
      setRunForm({ label: "", start_date: "", end_date: "" });
      await loadAll();
    } catch (err) {
      setRunError(err instanceof ApiError ? err.message : "Failed to create payroll run.");
    } finally {
      setRunWorking(false);
    }
  }

  async function handleDeleteRun(id: number) {
    try {
      await api.deletePayrollRun(id);
      await loadAll();
    } catch (err) {
      setRunError(err instanceof ApiError ? err.message : "Failed to delete payroll run.");
    }
  }

  async function handleProcess(id: number) {
    setRunWorking(true);
    setRunError(null);
    try {
      await api.processPayrollRun(id);
      await loadAll();
    } catch (err) {
      setRunError(err instanceof ApiError ? err.message : "Failed to process payroll run.");
    } finally {
      setRunWorking(false);
    }
  }

  async function handleMarkPaid(id: number) {
    setRunWorking(true);
    setRunError(null);
    try {
      await api.markPayrollRunPaid(id);
      await loadAll();
    } catch (err) {
      setRunError(err instanceof ApiError ? err.message : "Failed to mark payroll run paid.");
    } finally {
      setRunWorking(false);
    }
  }

  async function toggleRun(id: number) {
    if (expandedRunId === id) {
      setExpandedRunId(null);
      setRunPayslips(null);
      return;
    }
    setExpandedRunId(id);
    setExpandedPayslipId(null);
    try {
      setRunPayslips(await api.listPayslips({ payroll_run: id }));
    } catch (err) {
      setRunError(err instanceof ApiError ? err.message : "Failed to load payslips.");
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hr.manage") ?? false;
  const employeeName = (id: number) => employees?.find((e) => e.id === id)?.name ?? "—";

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <AppHeader activeMembership={activeMembership} />

      {!activeMembership ? (
        <p style={{ color: "#666" }}>
          Pick an active company on the <a href="/dashboard">dashboard</a> first.
        </p>
      ) : (
        <>
          <h1 style={{ fontSize: 20 }}>Payroll — {activeMembership.company.name}</h1>
          <p style={{ color: "#666", fontSize: 13 }}>
            <a href="/dashboard/hr">&larr; Back to HR</a>
          </p>
          <p style={{ fontSize: 12, color: "#999", maxWidth: 700 }}>
            PAYE income tax and pension (7% employee / 11% employer) are computed automatically per
            Ethiopia&apos;s Income Tax Proclamation No. 1395/2025 — not editable here. Basic Salary
            comes from each employee&apos;s HR record; components below are additional allowances or
            deductions layered on top.
          </p>
          {loadError && <p style={{ color: "crimson" }}>{loadError}</p>}

          {/* Salary Components */}
          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Salary components
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <tbody>
                {components?.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{c.name}</td>
                    <td style={{ padding: "6px 4px", color: "#666" }}>
                      {c.category === "earning" ? "Earning" : "Deduction"}
                    </td>
                    <td style={{ padding: "6px 4px", color: "#999" }}>
                      {c.category === "earning" ? (c.is_taxable ? "Taxable" : "Tax-exempt") : ""}
                    </td>
                    {canManage && (
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        <RowActions
                          onDelete={() => handleDeleteComponent(c.id)}
                          disabled={componentWorking}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {components?.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: "6px 4px", color: "#999" }}>
                      No salary components yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddComponent} style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <input
                  placeholder="Name (e.g. Transport Allowance)"
                  value={componentForm.name}
                  onChange={(e) => setComponentForm({ ...componentForm, name: e.target.value })}
                  style={{ padding: 8, flex: 1, maxWidth: 240 }}
                />
                <select
                  value={componentForm.category}
                  onChange={(e) =>
                    setComponentForm({
                      ...componentForm,
                      category: e.target.value as SalaryComponent["category"],
                    })
                  }
                  style={{ padding: 8 }}
                >
                  <option value="earning">Earning</option>
                  <option value="deduction">Deduction</option>
                </select>
                {componentForm.category === "earning" && (
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={componentForm.is_taxable}
                      onChange={(e) =>
                        setComponentForm({ ...componentForm, is_taxable: e.target.checked })
                      }
                    />
                    Taxable
                  </label>
                )}
                <button
                  type="submit"
                  disabled={componentWorking || !componentForm.name}
                  style={{ padding: "8px 16px" }}
                >
                  Add component
                </button>
              </form>
            )}
          </section>

          {/* Employee Salary Structure */}
          <section style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Employee salary structure
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Employee</th>
                  <th style={{ padding: "6px 4px" }}>Component</th>
                  <th style={{ padding: "6px 4px" }}>Amount</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {assignments?.map((a) => (
                  <tr key={a.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{employeeName(a.employee)}</td>
                    <td style={{ padding: "6px 4px" }}>
                      {a.component_name}{" "}
                      <span style={{ color: "#999" }}>
                        ({a.component_category === "earning" ? "earning" : "deduction"})
                      </span>
                    </td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(a.amount_cents)}</td>
                    {canManage && (
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        <RowActions onDelete={() => handleUnassign(a.id)} disabled={assignWorking} />
                      </td>
                    )}
                  </tr>
                ))}
                {assignments?.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: "6px 4px", color: "#999" }}>
                      No components assigned yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAssign} style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <select
                  required
                  value={assignForm.employee}
                  onChange={(e) => setAssignForm({ ...assignForm, employee: e.target.value })}
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
                  value={assignForm.component}
                  onChange={(e) => setAssignForm({ ...assignForm, component: e.target.value })}
                  style={{ padding: 8 }}
                >
                  <option value="">Component…</option>
                  {components?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Amount"
                  type="number"
                  step="0.01"
                  required
                  value={assignForm.amount_cents}
                  onChange={(e) => setAssignForm({ ...assignForm, amount_cents: e.target.value })}
                  style={{ padding: 8, width: 120 }}
                />
                <button
                  type="submit"
                  disabled={assignWorking || !assignForm.employee || !assignForm.component}
                  style={{ padding: "8px 16px" }}
                >
                  Assign
                </button>
                {assignError && <p style={{ color: "crimson" }}>{assignError}</p>}
              </form>
            )}
          </section>

          {/* Payroll Runs */}
          <section style={{ marginTop: 40, marginBottom: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Payroll runs
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Label</th>
                  <th style={{ padding: "6px 4px" }}>Period</th>
                  <th style={{ padding: "6px 4px" }}>Status</th>
                  <th style={{ padding: "6px 4px" }}>Total net pay</th>
                  <th></th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {runs?.map((r) => (
                  <Fragment key={r.id}>
                    <tr style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "6px 4px" }}>
                        <button
                          type="button"
                          onClick={() => toggleRun(r.id)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            color: "#1565c0",
                            cursor: "pointer",
                            font: "inherit",
                          }}
                        >
                          {r.label}
                        </button>
                      </td>
                      <td style={{ padding: "6px 4px" }}>
                        {r.start_date} to {r.end_date}
                      </td>
                      <td style={{ padding: "6px 4px" }}>
                        <span style={{ color: RUN_STATUS_COLORS[r.status], fontWeight: 600 }}>
                          {RUN_STATUS_LABELS[r.status]}
                        </span>
                      </td>
                      <td style={{ padding: "6px 4px" }}>{formatCents(r.total_net_pay_cents)}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        {canManage && r.status === "draft" && (
                          <button
                            type="button"
                            onClick={() => handleProcess(r.id)}
                            disabled={runWorking}
                            style={{ padding: "2px 8px", fontSize: 12 }}
                          >
                            Process
                          </button>
                        )}
                        {canManage && r.status === "processed" && (
                          <button
                            type="button"
                            onClick={() => handleMarkPaid(r.id)}
                            disabled={runWorking}
                            style={{ padding: "2px 8px", fontSize: 12 }}
                          >
                            Mark paid
                          </button>
                        )}
                      </td>
                      {canManage && (
                        <td style={{ padding: "6px 4px", textAlign: "right" }}>
                          {r.status === "draft" && (
                            <RowActions onDelete={() => handleDeleteRun(r.id)} disabled={runWorking} />
                          )}
                        </td>
                      )}
                    </tr>
                    {expandedRunId === r.id && (
                      <tr style={{ borderBottom: "1px solid #eee", background: "#fafafa" }}>
                        <td colSpan={6} style={{ padding: "10px 4px" }}>
                          {runPayslips === null ? (
                            <p style={{ color: "#999", fontSize: 13 }}>Loading payslips…</p>
                          ) : runPayslips.length === 0 ? (
                            <p style={{ color: "#999", fontSize: 13 }}>
                              No payslips yet — process this run first.
                            </p>
                          ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                              <thead>
                                <tr style={{ textAlign: "left" }}>
                                  <th style={{ padding: "4px" }}>Employee</th>
                                  <th style={{ padding: "4px" }}>Gross</th>
                                  <th style={{ padding: "4px" }}>PAYE</th>
                                  <th style={{ padding: "4px" }}>Pension (emp.)</th>
                                  <th style={{ padding: "4px" }}>Net pay</th>
                                  <th></th>
                                </tr>
                              </thead>
                              <tbody>
                                {runPayslips.map((p) => (
                                  <Fragment key={p.id}>
                                    <tr style={{ borderTop: "1px solid #eee" }}>
                                      <td style={{ padding: "4px" }}>{employeeName(p.employee)}</td>
                                      <td style={{ padding: "4px" }}>{formatCents(p.gross_cents)}</td>
                                      <td style={{ padding: "4px" }}>{formatCents(p.paye_tax_cents)}</td>
                                      <td style={{ padding: "4px" }}>
                                        {formatCents(p.pension_employee_cents)}
                                      </td>
                                      <td style={{ padding: "4px", fontWeight: 600 }}>
                                        {formatCents(p.net_pay_cents)}
                                      </td>
                                      <td style={{ padding: "4px", textAlign: "right" }}>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedPayslipId(
                                              expandedPayslipId === p.id ? null : p.id
                                            )
                                          }
                                          style={{ padding: "1px 6px", fontSize: 11 }}
                                        >
                                          {expandedPayslipId === p.id ? "Hide" : "Details"}
                                        </button>
                                      </td>
                                    </tr>
                                    {expandedPayslipId === p.id && (
                                      <tr>
                                        <td colSpan={6} style={{ padding: "4px 4px 8px 16px" }}>
                                          <table style={{ fontSize: 12, color: "#666" }}>
                                            <tbody>
                                              {p.lines.map((line) => (
                                                <tr key={line.id}>
                                                  <td style={{ padding: "2px 12px 2px 0" }}>
                                                    {line.label}
                                                  </td>
                                                  <td style={{ padding: "2px 0" }}>
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
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {runs?.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "6px 4px", color: "#999" }}>
                      No payroll runs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleCreateRun} style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <input
                  placeholder="Label (e.g. August 2026)"
                  required
                  value={runForm.label}
                  onChange={(e) => setRunForm({ ...runForm, label: e.target.value })}
                  style={{ padding: 8, flex: 1, maxWidth: 200 }}
                />
                <input
                  type="date"
                  required
                  value={runForm.start_date}
                  onChange={(e) => setRunForm({ ...runForm, start_date: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  type="date"
                  required
                  value={runForm.end_date}
                  onChange={(e) => setRunForm({ ...runForm, end_date: e.target.value })}
                  style={{ padding: 8 }}
                />
                <button
                  type="submit"
                  disabled={runWorking || !runForm.label}
                  style={{ padding: "8px 16px" }}
                >
                  Create run
                </button>
                {runError && <p style={{ color: "crimson" }}>{runError}</p>}
              </form>
            )}
          </section>
        </>
      )}
    </main>
  );
}
