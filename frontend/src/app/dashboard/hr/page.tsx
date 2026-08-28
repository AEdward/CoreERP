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
  type Branch,
  type Department,
  type Employee,
  type Position,
  type ShiftTemplate,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const STATUS_LABELS: Record<Employee["status"], string> = {
  active: "Active",
  on_leave: "On leave",
  terminated: "Terminated",
};

const EMPTY_EMPLOYEE_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  position: "",
  department: "",
  branch: "",
  shift: "",
  salary_cents: "",
  joining_date: "",
  status: "active" as Employee["status"],
};

export default function HrPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [shifts, setShifts] = useState<ShiftTemplate[] | null>(null);
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newDeptName, setNewDeptName] = useState("");
  const [deptBranch, setDeptBranch] = useState("");
  const [deptWorking, setDeptWorking] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);

  const [newPositionTitle, setNewPositionTitle] = useState("");
  const [positionDept, setPositionDept] = useState("");
  const [positionWorking, setPositionWorking] = useState(false);

  const [shiftForm, setShiftForm] = useState({ name: "", start_time: "", end_time: "", break_minutes: "0" });
  const [shiftWorking, setShiftWorking] = useState(false);

  const [empForm, setEmpForm] = useState(EMPTY_EMPLOYEE_FORM);
  const [empWorking, setEmpWorking] = useState(false);
  const [empError, setEmpError] = useState<string | null>(null);
  const [editingEmpId, setEditingEmpId] = useState<number | null>(null);

  async function loadAll() {
    try {
      const [depts, poss, shs, emps, brs] = await Promise.all([
        api.listDepartments(),
        api.listPositions(),
        api.listShifts(),
        api.listEmployees(),
        api.listBranches(),
      ]);
      setDepartments(depts);
      setPositions(poss);
      setShifts(shs);
      setEmployees(emps);
      setBranches(brs);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load HR data.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddDepartment(e: React.FormEvent) {
    e.preventDefault();
    setDeptWorking(true);
    try {
      const payload = { name: newDeptName, branch: deptBranch ? Number(deptBranch) : null };
      if (editingDeptId) {
        await api.updateDepartment(editingDeptId, payload);
      } else {
        await api.createDepartment(payload);
      }
      setNewDeptName("");
      setDeptBranch("");
      setEditingDeptId(null);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save department.");
    } finally {
      setDeptWorking(false);
    }
  }

  function startEditDepartment(d: Department) {
    setEditingDeptId(d.id);
    setNewDeptName(d.name);
    setDeptBranch(d.branch ? String(d.branch) : "");
  }

  async function handleDeleteDepartment(id: number) {
    try {
      await api.deleteDepartment(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to delete department.");
    }
  }

  async function handleAddPosition(e: React.FormEvent) {
    e.preventDefault();
    setPositionWorking(true);
    try {
      await api.createPosition({
        title: newPositionTitle,
        department: positionDept ? Number(positionDept) : null,
      });
      setNewPositionTitle("");
      setPositionDept("");
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save position.");
    } finally {
      setPositionWorking(false);
    }
  }

  async function handleDeletePosition(id: number) {
    try {
      await api.deletePosition(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to delete position.");
    }
  }

  async function handleAddShift(e: React.FormEvent) {
    e.preventDefault();
    setShiftWorking(true);
    try {
      await api.createShift({
        name: shiftForm.name,
        start_time: shiftForm.start_time,
        end_time: shiftForm.end_time,
        break_minutes: shiftForm.break_minutes ? Number(shiftForm.break_minutes) : 0,
      });
      setShiftForm({ name: "", start_time: "", end_time: "", break_minutes: "0" });
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save shift.");
    } finally {
      setShiftWorking(false);
    }
  }

  async function handleDeleteShift(id: number) {
    try {
      await api.deleteShift(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to delete shift.");
    }
  }

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault();
    setEmpWorking(true);
    setEmpError(null);
    try {
      const payload = {
        first_name: empForm.first_name,
        last_name: empForm.last_name,
        email: empForm.email,
        phone: empForm.phone,
        position: empForm.position ? Number(empForm.position) : null,
        department: empForm.department ? Number(empForm.department) : null,
        branch: empForm.branch ? Number(empForm.branch) : null,
        shift: empForm.shift ? Number(empForm.shift) : null,
        salary_cents: empForm.salary_cents ? Math.round(Number(empForm.salary_cents) * 100) : 0,
        joining_date: empForm.joining_date || null,
        status: empForm.status,
      };
      if (editingEmpId) {
        await api.updateEmployee(editingEmpId, payload);
      } else {
        await api.createEmployee(payload);
      }
      setEmpForm(EMPTY_EMPLOYEE_FORM);
      setEditingEmpId(null);
      await loadAll();
    } catch (err) {
      setEmpError(err instanceof ApiError ? err.message : "Failed to save employee.");
    } finally {
      setEmpWorking(false);
    }
  }

  function startEditEmployee(emp: Employee) {
    setEditingEmpId(emp.id);
    setEmpForm({
      first_name: emp.first_name,
      last_name: emp.last_name,
      email: emp.email,
      phone: emp.phone,
      position: emp.position ? String(emp.position) : "",
      department: emp.department ? String(emp.department) : "",
      branch: emp.branch ? String(emp.branch) : "",
      shift: emp.shift ? String(emp.shift) : "",
      salary_cents: emp.salary_cents ? String(emp.salary_cents / 100) : "",
      joining_date: emp.joining_date ?? "",
      status: emp.status,
    });
  }

  async function handleDeleteEmployee(id: number) {
    try {
      await api.deleteEmployee(id);
      await loadAll();
    } catch (err) {
      setEmpError(err instanceof ApiError ? err.message : "Failed to delete employee.");
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hr.manage") ?? false;
  const departmentName = (id: number | null) => departments?.find((d) => d.id === id)?.name ?? "—";
  const branchName = (id: number | null) => branches?.find((b) => b.id === id)?.name ?? "—";
  const positionTitle = (id: number | null) => positions?.find((p) => p.id === id)?.title ?? "—";
  const shiftName = (id: number | null) => shifts?.find((s) => s.id === id)?.name ?? "—";

  return (
    <ModuleShell moduleKey="hr" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>HR</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
            <p className={shared.hint} style={{ marginTop: 4 }}>
              <a href="/dashboard/hr/leave-and-contracts">Leave requests & employee contracts &rarr;</a>
              {" · "}
              <a href="/dashboard/hr/payroll">Payroll &rarr;</a>
              {" · "}
              <a href="/dashboard/hr/recruitment">Recruitment &rarr;</a>
              {" · "}
              <a href="/dashboard/hr/performance">Performance & Training &rarr;</a>
            </p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Departments</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <tbody>
                {departments?.map((d) => (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td className={shared.tableMuted}>{branchName(d.branch)}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions
                          onEdit={() => startEditDepartment(d)}
                          onDelete={() => handleDeleteDepartment(d.id)}
                          disabled={deptWorking}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {departments?.length === 0 && (
                  <tr>
                    <td colSpan={3} className={shared.tableMuted}>
                      No departments yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddDepartment} className={shared.formRow} style={{ marginTop: 12 }}>
                <input
                  placeholder="New department name"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  className={shared.input}
                  style={{ flex: 1, maxWidth: 280 }}
                />
                <select
                  value={deptBranch}
                  onChange={(e) => setDeptBranch(e.target.value)}
                  className={shared.select}
                >
                  <option value="">No branch</option>
                  {branches?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={deptWorking || !newDeptName}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  {editingDeptId ? "Save changes" : "Add department"}
                </button>
                {editingDeptId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDeptId(null);
                      setNewDeptName("");
                      setDeptBranch("");
                    }}
                    className={shared.btn}
                  >
                    Cancel
                  </button>
                )}
              </form>
            )}
          </div>
        </div>

          <div className={shared.section}>
            <h2 className={shared.sectionTitle}>Positions</h2>
            <div className={shared.card}>
              <table className={shared.table}>
                <tbody>
                  {positions?.map((p) => (
                    <tr key={p.id}>
                      <td>{p.title}</td>
                      <td className={shared.tableMuted}>{departmentName(p.department)}</td>
                      {canManage && (
                        <td style={{ textAlign: "right" }}>
                          <RowActions
                            onDelete={() => handleDeletePosition(p.id)}
                            disabled={positionWorking}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                  {positions?.length === 0 && (
                    <tr>
                      <td colSpan={3} className={shared.tableMuted}>
                        No positions yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {canManage && (
                <form onSubmit={handleAddPosition} className={shared.formRow} style={{ marginTop: 12 }}>
                  <input
                    placeholder="New position title (e.g. Sales Manager)"
                    value={newPositionTitle}
                    onChange={(e) => setNewPositionTitle(e.target.value)}
                    className={shared.input}
                    style={{ flex: 1, maxWidth: 280 }}
                  />
                  <select
                    value={positionDept}
                    onChange={(e) => setPositionDept(e.target.value)}
                    className={shared.select}
                  >
                    <option value="">No department</option>
                    {departments?.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={positionWorking || !newPositionTitle}
                    className={`${shared.btn} ${shared.btnPrimary}`}
                  >
                    Add position
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className={shared.section}>
            <h2 className={shared.sectionTitle}>Shifts</h2>
            <p className={shared.hint}>
              <a href="/dashboard/hr/attendance">Attendance records &rarr;</a>
            </p>
            <div className={shared.card}>
              <table className={shared.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Hours</th>
                    <th>Break</th>
                    <th>Scheduled</th>
                    {canManage && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {shifts?.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>
                        {s.start_time}–{s.end_time}
                      </td>
                      <td>{s.break_minutes} min</td>
                      <td>{s.scheduled_hours}h</td>
                      {canManage && (
                        <td style={{ textAlign: "right" }}>
                          <RowActions onDelete={() => handleDeleteShift(s.id)} disabled={shiftWorking} />
                        </td>
                      )}
                    </tr>
                  ))}
                  {shifts?.length === 0 && (
                    <tr>
                      <td colSpan={5} className={shared.tableMuted}>
                        No shifts yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {canManage && (
                <form onSubmit={handleAddShift} className={shared.formRow} style={{ marginTop: 12 }}>
                  <input
                    placeholder="Shift name (e.g. Day Shift)"
                    value={shiftForm.name}
                    onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                    className={shared.input}
                    style={{ flex: 1, maxWidth: 200 }}
                  />
                  <input
                    type="time"
                    required
                    value={shiftForm.start_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                    className={shared.input}
                  />
                  <input
                    type="time"
                    required
                    value={shiftForm.end_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                    className={shared.input}
                  />
                  <input
                    placeholder="Break (min)"
                    type="number"
                    value={shiftForm.break_minutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, break_minutes: e.target.value })}
                    className={shared.input}
                    style={{ width: 100 }}
                  />
                  <button
                    type="submit"
                    disabled={shiftWorking || !shiftForm.name || !shiftForm.start_time || !shiftForm.end_time}
                    className={`${shared.btn} ${shared.btnPrimary}`}
                  >
                    Add shift
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className={shared.section}>
            <h2 className={shared.sectionTitle}>Employees</h2>
            <div className={shared.card}>
              <table className={shared.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Position</th>
                    <th>Department</th>
                    <th>Branch</th>
                    <th>Shift</th>
                    <th>Status</th>
                    <th></th>
                    {canManage && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {employees?.map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        {emp.first_name} {emp.last_name}
                      </td>
                      <td>{positionTitle(emp.position)}</td>
                      <td>{departmentName(emp.department)}</td>
                      <td>{branchName(emp.branch)}</td>
                      <td>{shiftName(emp.shift)}</td>
                      <td>{STATUS_LABELS[emp.status]}</td>
                      <td style={{ textAlign: "right" }}>
                        <span style={{ display: "inline-flex", gap: 6 }}>
                          <DocumentsPanel
                            target={{ appLabel: "hr", model: "employee", objectId: emp.id }}
                            canManage={canManage}
                          />
                          <NotesPanel
                            target={{ appLabel: "hr", model: "employee", objectId: emp.id }}
                            canManage={canManage}
                          />
                          <ActivityPanel target={{ appLabel: "hr", model: "employee", objectId: emp.id }} />
                        </span>
                      </td>
                      {canManage && (
                        <td style={{ textAlign: "right" }}>
                          <RowActions
                            onEdit={() => startEditEmployee(emp)}
                            onDelete={() => handleDeleteEmployee(emp.id)}
                            disabled={empWorking}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                  {employees?.length === 0 && (
                    <tr>
                      <td colSpan={8} className={shared.tableMuted}>
                        No employees yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {canManage && (
                <form onSubmit={handleAddEmployee} className={shared.formGrid} style={{ marginTop: 16 }}>
                  <input
                    placeholder="First name"
                    required
                    value={empForm.first_name}
                    onChange={(e) => setEmpForm({ ...empForm, first_name: e.target.value })}
                    className={shared.input}
                  />
                  <input
                    placeholder="Last name"
                    required
                    value={empForm.last_name}
                    onChange={(e) => setEmpForm({ ...empForm, last_name: e.target.value })}
                    className={shared.input}
                  />
                  <input
                    placeholder="Email"
                    type="email"
                    value={empForm.email}
                    onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                    className={shared.input}
                  />
                  <input
                    placeholder="Phone"
                    value={empForm.phone}
                    onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                    className={shared.input}
                  />
                  <select
                    value={empForm.position}
                    onChange={(e) => setEmpForm({ ...empForm, position: e.target.value })}
                    className={shared.select}
                  >
                    <option value="">No position</option>
                    {positions?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={empForm.department}
                    onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })}
                    className={shared.select}
                  >
                    <option value="">No department</option>
                    {departments?.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={empForm.branch}
                    onChange={(e) => setEmpForm({ ...empForm, branch: e.target.value })}
                    className={shared.select}
                  >
                    <option value="">No branch</option>
                    {branches?.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={empForm.shift}
                    onChange={(e) => setEmpForm({ ...empForm, shift: e.target.value })}
                    className={shared.select}
                  >
                    <option value="">No shift</option>
                    {shifts?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Salary (e.g. 50000)"
                    type="number"
                    value={empForm.salary_cents}
                    onChange={(e) => setEmpForm({ ...empForm, salary_cents: e.target.value })}
                    className={shared.input}
                  />
                  <input
                    type="date"
                    value={empForm.joining_date}
                    onChange={(e) => setEmpForm({ ...empForm, joining_date: e.target.value })}
                    className={shared.input}
                  />
                  <select
                    value={empForm.status}
                    onChange={(e) =>
                      setEmpForm({ ...empForm, status: e.target.value as Employee["status"] })
                    }
                    className={shared.select}
                  >
                    <option value="active">Active</option>
                    <option value="on_leave">On leave</option>
                    <option value="terminated">Terminated</option>
                  </select>
                  <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                    <button
                      type="submit"
                      disabled={empWorking || !empForm.first_name || !empForm.last_name}
                      className={`${shared.btn} ${shared.btnPrimary}`}
                    >
                      {editingEmpId ? "Save changes" : "Add employee"}
                    </button>
                    {editingEmpId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEmpId(null);
                          setEmpForm(EMPTY_EMPLOYEE_FORM);
                        }}
                        className={shared.btn}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  {empError && (
                    <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                      {empError}
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



