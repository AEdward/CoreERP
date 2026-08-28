"use client";

import { Fragment, useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import {
  api,
  ApiError,
  type EmployeePickerEntry,
  type EmployeeSalaryComponent,
  type Loan,
  type PayrollRun,
  type PensionSettings,
  type Payslip,
  type SalaryComponent,
  type TaxBracket,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const RUN_STATUS_LABELS: Record<PayrollRun["status"], string> = {
  draft: "Draft",
  processed: "Processed",
  paid: "Paid",
};

const RUN_STATUS_BADGES: Record<PayrollRun["status"], string> = {
  draft: "",
  processed: shared.badgeWarn,
  paid: shared.badgeSuccess,
};

const LOAN_STATUS_LABELS: Record<Loan["status"], string> = {
  active: "Active",
  paid_off: "Paid off",
  cancelled: "Cancelled",
};

const LOAN_STATUS_BADGES: Record<Loan["status"], string> = {
  active: shared.badgeWarn,
  paid_off: shared.badgeSuccess,
  cancelled: "",
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

  const [loans, setLoans] = useState<Loan[] | null>(null);
  const [loanForm, setLoanForm] = useState({ employee: "", principal_cents: "", term_months: "", start_date: "" });
  const [loanWorking, setLoanWorking] = useState(false);
  const [loanError, setLoanError] = useState<string | null>(null);

  const [expandedRunId, setExpandedRunId] = useState<number | null>(null);
  const [runPayslips, setRunPayslips] = useState<Payslip[] | null>(null);
  const [expandedPayslipId, setExpandedPayslipId] = useState<number | null>(null);

  const [taxBrackets, setTaxBrackets] = useState<TaxBracket[] | null>(null);
  const [bracketForm, setBracketForm] = useState({ lower_bound_cents: "", upper_bound_cents: "", rate_percent: "" });
  const [bracketWorking, setBracketWorking] = useState(false);
  const [pension, setPension] = useState<PensionSettings | null>(null);
  const [pensionForm, setPensionForm] = useState({ employee_rate_percent: "", employer_rate_percent: "" });
  const [pensionWorking, setPensionWorking] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [c, a, r, emp, l, brackets, pensionSettings] = await Promise.all([
        api.listSalaryComponents(),
        api.listEmployeeSalaryComponents(),
        api.listPayrollRuns(),
        api.listEmployeePicker(),
        api.listLoans(),
        api.listTaxBrackets(),
        api.getPensionSettings(),
      ]);
      setComponents(c);
      setAssignments(a);
      setTaxBrackets(brackets);
      setPension(pensionSettings);
      setPensionForm({
        employee_rate_percent: pensionSettings.employee_rate_percent,
        employer_rate_percent: pensionSettings.employer_rate_percent,
      });
      setRuns(r);
      setEmployees(emp);
      setLoans(l);
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

  async function handleAddBracket(e: React.FormEvent) {
    e.preventDefault();
    setBracketWorking(true);
    setSettingsError(null);
    try {
      await api.createTaxBracket({
        lower_bound_cents: Math.round(Number(bracketForm.lower_bound_cents || 0) * 100),
        upper_bound_cents: bracketForm.upper_bound_cents
          ? Math.round(Number(bracketForm.upper_bound_cents) * 100)
          : null,
        rate_percent: bracketForm.rate_percent || "0",
      });
      setBracketForm({ lower_bound_cents: "", upper_bound_cents: "", rate_percent: "" });
      await loadAll();
    } catch (err) {
      setSettingsError(err instanceof ApiError ? err.message : "Failed to save tax bracket.");
    } finally {
      setBracketWorking(false);
    }
  }

  async function handleDeleteBracket(id: number) {
    try {
      await api.deleteTaxBracket(id);
      await loadAll();
    } catch (err) {
      setSettingsError(err instanceof ApiError ? err.message : "Failed to delete tax bracket.");
    }
  }

  async function handleSavePension(e: React.FormEvent) {
    e.preventDefault();
    setPensionWorking(true);
    setSettingsError(null);
    try {
      await api.updatePensionSettings(pensionForm);
      await loadAll();
    } catch (err) {
      setSettingsError(err instanceof ApiError ? err.message : "Failed to save pension settings.");
    } finally {
      setPensionWorking(false);
    }
  }

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

  async function handleCreateLoan(e: React.FormEvent) {
    e.preventDefault();
    setLoanWorking(true);
    setLoanError(null);
    try {
      await api.createLoan({
        employee: Number(loanForm.employee),
        principal_cents: Math.round(Number(loanForm.principal_cents || 0) * 100),
        term_months: Number(loanForm.term_months),
        start_date: loanForm.start_date,
      });
      setLoanForm({ employee: "", principal_cents: "", term_months: "", start_date: "" });
      await loadAll();
    } catch (err) {
      setLoanError(err instanceof ApiError ? err.message : "Failed to create loan.");
    } finally {
      setLoanWorking(false);
    }
  }

  async function handleCancelLoan(id: number) {
    setLoanWorking(true);
    setLoanError(null);
    try {
      await api.cancelLoan(id);
      await loadAll();
    } catch (err) {
      setLoanError(err instanceof ApiError ? err.message : "Failed to cancel loan.");
    } finally {
      setLoanWorking(false);
    }
  }

  async function handleDeleteLoan(id: number) {
    try {
      await api.deleteLoan(id);
      await loadAll();
    } catch (err) {
      setLoanError(err instanceof ApiError ? err.message : "Failed to delete loan.");
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
    <ModuleShell moduleKey="hr" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Payroll</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
            <p className={shared.hint} style={{ marginTop: 4 }}>
              <a href="/dashboard/hr">&larr; Back to HR</a>
            </p>
          </div>
        </div>
        <p className={shared.hint} style={{ maxWidth: 700 }}>
          PAYE income tax brackets and pension contribution rates below drive the automatic payroll
          calculation. Basic Salary comes from each employee&apos;s HR record; components further
          down are additional allowances or deductions layered on top.
        </p>
        {loadError && <p className={shared.errorText}>{loadError}</p>}
        {settingsError && <p className={shared.errorText}>{settingsError}</p>}

        {/* Payroll Settings: Tax Brackets + Pension */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Payroll settings</h2>
          <div className={shared.card}>
            <h3 style={{ marginTop: 0 }}>Tax brackets (PAYE)</h3>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>From (ETB)</th>
                  <th>To (ETB)</th>
                  <th>Rate</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {taxBrackets?.map((b) => (
                  <tr key={b.id}>
                    <td>{(b.lower_bound_cents / 100).toLocaleString()}</td>
                    <td className={shared.tableMuted}>
                      {b.upper_bound_cents != null ? (b.upper_bound_cents / 100).toLocaleString() : "and above"}
                    </td>
                    <td className={shared.tableMuted}>{b.rate_percent}%</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions
                          onDelete={() => handleDeleteBracket(b.id)}
                          disabled={bracketWorking}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {taxBrackets?.length === 0 && (
                  <tr>
                    <td colSpan={4} className={shared.tableMuted}>
                      No tax brackets configured yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddBracket} className={shared.formRow} style={{ marginTop: 12 }}>
                <input
                  type="number"
                  step="0.01"
                  placeholder="From (ETB)"
                  value={bracketForm.lower_bound_cents}
                  onChange={(e) => setBracketForm({ ...bracketForm, lower_bound_cents: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 140 }}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="To (blank = no cap)"
                  value={bracketForm.upper_bound_cents}
                  onChange={(e) => setBracketForm({ ...bracketForm, upper_bound_cents: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 160 }}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Rate %"
                  value={bracketForm.rate_percent}
                  onChange={(e) => setBracketForm({ ...bracketForm, rate_percent: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 100 }}
                />
                <button type="submit" className={shared.buttonPrimary} disabled={bracketWorking}>
                  Add bracket
                </button>
              </form>
            )}

            <h3>Pension contribution rates</h3>
            {canManage ? (
              <form onSubmit={handleSavePension} className={shared.formRow}>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  Employee %
                  <input
                    type="number"
                    step="0.01"
                    value={pensionForm.employee_rate_percent}
                    onChange={(e) =>
                      setPensionForm({ ...pensionForm, employee_rate_percent: e.target.value })
                    }
                    className={shared.input}
                    style={{ maxWidth: 90 }}
                  />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  Employer %
                  <input
                    type="number"
                    step="0.01"
                    value={pensionForm.employer_rate_percent}
                    onChange={(e) =>
                      setPensionForm({ ...pensionForm, employer_rate_percent: e.target.value })
                    }
                    className={shared.input}
                    style={{ maxWidth: 90 }}
                  />
                </label>
                <button type="submit" className={shared.buttonPrimary} disabled={pensionWorking}>
                  Save
                </button>
              </form>
            ) : (
              pension && (
                <p className={shared.tableMuted}>
                  Employee {pension.employee_rate_percent}% / Employer {pension.employer_rate_percent}%
                </p>
              )
            )}
          </div>
        </div>

        {/* Salary Components */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Salary components</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <tbody>
                {components?.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td className={shared.tableMuted}>
                      {c.category === "earning" ? "Earning" : "Deduction"}
                    </td>
                    <td className={shared.tableMuted}>
                      {c.category === "earning" ? (c.is_taxable ? "Taxable" : "Tax-exempt") : ""}
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
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
                    <td colSpan={4} className={shared.tableMuted}>
                      No salary components yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddComponent} className={shared.formRow} style={{ marginTop: 12 }}>
                <input
                  placeholder="Name (e.g. Transport Allowance)"
                  value={componentForm.name}
                  onChange={(e) => setComponentForm({ ...componentForm, name: e.target.value })}
                  className={shared.input}
                  style={{ flex: 1, maxWidth: 240 }}
                />
                <select
                  value={componentForm.category}
                  onChange={(e) =>
                    setComponentForm({
                      ...componentForm,
                      category: e.target.value as SalaryComponent["category"],
                    })
                  }
                  className={shared.select}
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
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Add component
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Employee Salary Structure */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Employee salary structure</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Component</th>
                  <th>Amount</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {assignments?.map((a) => (
                  <tr key={a.id}>
                    <td>{employeeName(a.employee)}</td>
                    <td>
                      {a.component_name}{" "}
                      <span className={shared.tableMuted}>
                        ({a.component_category === "earning" ? "earning" : "deduction"})
                      </span>
                    </td>
                    <td>{formatCents(a.amount_cents)}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleUnassign(a.id)} disabled={assignWorking} />
                      </td>
                    )}
                  </tr>
                ))}
                {assignments?.length === 0 && (
                  <tr>
                    <td colSpan={4} className={shared.tableMuted}>
                      No components assigned yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAssign} className={shared.formRow} style={{ marginTop: 12 }}>
                <select
                  required
                  value={assignForm.employee}
                  onChange={(e) => setAssignForm({ ...assignForm, employee: e.target.value })}
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
                  value={assignForm.component}
                  onChange={(e) => setAssignForm({ ...assignForm, component: e.target.value })}
                  className={shared.select}
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
                  className={shared.input}
                  style={{ width: 120 }}
                />
                <button
                  type="submit"
                  disabled={assignWorking || !assignForm.employee || !assignForm.component}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Assign
                </button>
                {assignError && <p className={shared.errorText}>{assignError}</p>}
              </form>
            )}
          </div>
        </div>

        {/* Loans / Employee Advances */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Loans &amp; employee advances</h2>
          <p className={shared.hint} style={{ maxWidth: 700 }}>
            A fixed monthly installment (principal ÷ term) is deducted automatically from each
            payroll run until the loan is fully repaid, then it flips to Paid off on its own.
          </p>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Loan #</th>
                  <th>Employee</th>
                  <th>Principal</th>
                  <th>Monthly installment</th>
                  <th>Remaining</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {loans?.map((l) => (
                  <tr key={l.id}>
                    <td>{l.loan_number}</td>
                    <td>{l.employee_name}</td>
                    <td>{formatCents(l.principal_cents)}</td>
                    <td>{formatCents(l.monthly_installment_cents)}</td>
                    <td>{formatCents(l.remaining_balance_cents)}</td>
                    <td>
                      <span className={`${shared.badge} ${LOAN_STATUS_BADGES[l.status]}`}>
                        {LOAN_STATUS_LABELS[l.status]}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        {l.status === "active" && (
                          <button
                            type="button"
                            onClick={() => handleCancelLoan(l.id)}
                            disabled={loanWorking}
                            className={`${shared.btn} ${shared.btnSmall}`}
                            style={{ marginRight: 6 }}
                          >
                            Cancel
                          </button>
                        )}
                        {l.repaid_cents === 0 && (
                          <RowActions onDelete={() => handleDeleteLoan(l.id)} disabled={loanWorking} />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {loans?.length === 0 && (
                  <tr>
                    <td colSpan={7} className={shared.tableMuted}>
                      No loans yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleCreateLoan} className={shared.formRow} style={{ marginTop: 12 }}>
                <select
                  required
                  value={loanForm.employee}
                  onChange={(e) => setLoanForm({ ...loanForm, employee: e.target.value })}
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
                  placeholder="Principal"
                  type="number"
                  step="0.01"
                  required
                  value={loanForm.principal_cents}
                  onChange={(e) => setLoanForm({ ...loanForm, principal_cents: e.target.value })}
                  className={shared.input}
                  style={{ width: 120 }}
                />
                <input
                  placeholder="Term (months)"
                  type="number"
                  min={1}
                  required
                  value={loanForm.term_months}
                  onChange={(e) => setLoanForm({ ...loanForm, term_months: e.target.value })}
                  className={shared.input}
                  style={{ width: 120 }}
                />
                <input
                  type="date"
                  required
                  value={loanForm.start_date}
                  onChange={(e) => setLoanForm({ ...loanForm, start_date: e.target.value })}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={loanWorking || !loanForm.employee || !loanForm.term_months}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Disburse loan
                </button>
                {loanError && <p className={shared.errorText}>{loanError}</p>}
              </form>
            )}
          </div>
        </div>

        {/* Payroll Runs */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Payroll runs</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Period</th>
                  <th>Status</th>
                  <th>Total net pay</th>
                  <th></th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {runs?.map((r) => (
                  <Fragment key={r.id}>
                    <tr>
                      <td>
                        <button
                          type="button"
                          onClick={() => toggleRun(r.id)}
                          className={shared.btnGhost}
                          style={{
                            border: "none",
                            padding: 0,
                            font: "inherit",
                            textDecoration: "underline",
                          }}
                        >
                          {r.label}
                        </button>
                      </td>
                      <td>
                        {r.start_date} to {r.end_date}
                      </td>
                      <td>
                        <span className={`${shared.badge} ${RUN_STATUS_BADGES[r.status]}`}>
                          {RUN_STATUS_LABELS[r.status]}
                        </span>
                      </td>
                      <td>{formatCents(r.total_net_pay_cents)}</td>
                      <td style={{ textAlign: "right" }}>
                        {canManage && r.status === "draft" && (
                          <button
                            type="button"
                            onClick={() => handleProcess(r.id)}
                            disabled={runWorking}
                            className={`${shared.btn} ${shared.btnSmall}`}
                          >
                            Process
                          </button>
                        )}
                        {canManage && r.status === "processed" && (
                          <button
                            type="button"
                            onClick={() => handleMarkPaid(r.id)}
                            disabled={runWorking}
                            className={`${shared.btn} ${shared.btnSmall}`}
                          >
                            Mark paid
                          </button>
                        )}
                      </td>
                      {canManage && (
                        <td style={{ textAlign: "right" }}>
                          {r.status === "draft" && (
                            <RowActions onDelete={() => handleDeleteRun(r.id)} disabled={runWorking} />
                          )}
                        </td>
                      )}
                    </tr>
                    {expandedRunId === r.id && (
                      <tr>
                        <td colSpan={6} style={{ padding: "10px 4px", background: "var(--gray-50)" }}>
                          {runPayslips === null ? (
                            <p className={shared.hint}>Loading payslips…</p>
                          ) : runPayslips.length === 0 ? (
                            <p className={shared.hint}>No payslips yet — process this run first.</p>
                          ) : (
                            <table className={shared.table}>
                              <thead>
                                <tr>
                                  <th>Employee</th>
                                  <th>Gross</th>
                                  <th>PAYE</th>
                                  <th>Pension (emp.)</th>
                                  <th>Net pay</th>
                                  <th></th>
                                </tr>
                              </thead>
                              <tbody>
                                {runPayslips.map((p) => (
                                  <Fragment key={p.id}>
                                    <tr>
                                      <td>{employeeName(p.employee)}</td>
                                      <td>{formatCents(p.gross_cents)}</td>
                                      <td>{formatCents(p.paye_tax_cents)}</td>
                                      <td>{formatCents(p.pension_employee_cents)}</td>
                                      <td style={{ fontWeight: 600 }}>{formatCents(p.net_pay_cents)}</td>
                                      <td style={{ textAlign: "right" }}>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedPayslipId(
                                              expandedPayslipId === p.id ? null : p.id
                                            )
                                          }
                                          className={`${shared.btn} ${shared.btnSmall}`}
                                        >
                                          {expandedPayslipId === p.id ? "Hide" : "Details"}
                                        </button>
                                      </td>
                                    </tr>
                                    {expandedPayslipId === p.id && (
                                      <tr>
                                        <td colSpan={6} style={{ padding: "4px 4px 8px 16px" }}>
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
                    <td colSpan={6} className={shared.tableMuted}>
                      No payroll runs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleCreateRun} className={shared.formRow} style={{ marginTop: 12 }}>
                <input
                  placeholder="Label (e.g. August 2026)"
                  required
                  value={runForm.label}
                  onChange={(e) => setRunForm({ ...runForm, label: e.target.value })}
                  className={shared.input}
                  style={{ flex: 1, maxWidth: 200 }}
                />
                <input
                  type="date"
                  required
                  value={runForm.start_date}
                  onChange={(e) => setRunForm({ ...runForm, start_date: e.target.value })}
                  className={shared.input}
                />
                <input
                  type="date"
                  required
                  value={runForm.end_date}
                  onChange={(e) => setRunForm({ ...runForm, end_date: e.target.value })}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={runWorking || !runForm.label}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Create run
                </button>
                {runError && <p className={shared.errorText}>{runError}</p>}
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
