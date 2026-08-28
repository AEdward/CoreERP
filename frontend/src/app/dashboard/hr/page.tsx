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
  type CompanyMember,
  type CostCenter,
  type Department,
  type Employee,
  type Position,
  type SalaryStructure,
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
  cost_center: "",
  manager: "",
  salary_structure: "",
  salary_cents: "",
  joining_date: "",
  status: "active" as Employee["status"],
  user: "",
  payment_method: "bank_transfer" as Employee["payment_method"],
  bank_name: "",
  bank_account_number: "",
  bank_account_name: "",
  national_id: "",
  passport_number: "",
  date_of_birth: "",
  gender: "" as Employee["gender"],
  marital_status: "" as Employee["marital_status"],
  address: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
};

export default function HrPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [shifts, setShifts] = useState<ShiftTemplate[] | null>(null);
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[] | null>(null);
  const [costCenters, setCostCenters] = useState<CostCenter[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newDeptName, setNewDeptName] = useState("");
  const [deptBranch, setDeptBranch] = useState("");
  const [deptWorking, setDeptWorking] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);

  const [newPositionTitle, setNewPositionTitle] = useState("");
  const [positionDept, setPositionDept] = useState("");
  const [positionWorking, setPositionWorking] = useState(false);

  const [salaryStructures, setSalaryStructures] = useState<SalaryStructure[] | null>(null);
  const [structureForm, setStructureForm] = useState({ name: "", base_salary_cents: "", description: "" });
  const [structureWorking, setStructureWorking] = useState(false);

  const [shiftForm, setShiftForm] = useState({ name: "", start_time: "", end_time: "", break_minutes: "0" });
  const [shiftWorking, setShiftWorking] = useState(false);

  const [empForm, setEmpForm] = useState(EMPTY_EMPLOYEE_FORM);
  const [empWorking, setEmpWorking] = useState(false);
  const [empError, setEmpError] = useState<string | null>(null);
  const [editingEmpId, setEditingEmpId] = useState<number | null>(null);

  async function loadAll() {
    try {
      const [depts, poss, shs, emps, brs, members, ccs, structs] = await Promise.all([
        api.listDepartments(),
        api.listPositions(),
        api.listShifts(),
        api.listEmployees(),
        api.listBranches(),
        api.listCompanyMembers(),
        api.listCostCenters(),
        api.listSalaryStructures(),
      ]);
      setDepartments(depts);
      setPositions(poss);
      setShifts(shs);
      setEmployees(emps);
      setBranches(brs);
      setCompanyMembers(members);
      setCostCenters(ccs);
      setSalaryStructures(structs);
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

  async function handleAddStructure(e: React.FormEvent) {
    e.preventDefault();
    setStructureWorking(true);
    try {
      await api.createSalaryStructure({
        name: structureForm.name,
        base_salary_cents: Math.round(Number(structureForm.base_salary_cents || 0) * 100),
        description: structureForm.description,
      });
      setStructureForm({ name: "", base_salary_cents: "", description: "" });
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save salary structure.");
    } finally {
      setStructureWorking(false);
    }
  }

  async function handleDeleteStructure(id: number) {
    try {
      await api.deleteSalaryStructure(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to delete salary structure.");
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
        cost_center: empForm.cost_center ? Number(empForm.cost_center) : null,
        manager: empForm.manager ? Number(empForm.manager) : null,
        salary_structure: empForm.salary_structure ? Number(empForm.salary_structure) : null,
        salary_cents: empForm.salary_cents ? Math.round(Number(empForm.salary_cents) * 100) : 0,
        joining_date: empForm.joining_date || null,
        status: empForm.status,
        user: empForm.user ? Number(empForm.user) : null,
        payment_method: empForm.payment_method,
        bank_name: empForm.bank_name,
        bank_account_number: empForm.bank_account_number,
        bank_account_name: empForm.bank_account_name,
        national_id: empForm.national_id,
        passport_number: empForm.passport_number,
        date_of_birth: empForm.date_of_birth || null,
        gender: empForm.gender,
        marital_status: empForm.marital_status,
        address: empForm.address,
        emergency_contact_name: empForm.emergency_contact_name,
        emergency_contact_phone: empForm.emergency_contact_phone,
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
      cost_center: emp.cost_center ? String(emp.cost_center) : "",
      manager: emp.manager ? String(emp.manager) : "",
      salary_structure: emp.salary_structure ? String(emp.salary_structure) : "",
      salary_cents: emp.salary_cents ? String(emp.salary_cents / 100) : "",
      joining_date: emp.joining_date ?? "",
      status: emp.status,
      user: emp.user ? String(emp.user) : "",
      payment_method: emp.payment_method,
      bank_name: emp.bank_name,
      bank_account_number: emp.bank_account_number,
      bank_account_name: emp.bank_account_name,
      national_id: emp.national_id,
      passport_number: emp.passport_number,
      date_of_birth: emp.date_of_birth ?? "",
      gender: emp.gender,
      marital_status: emp.marital_status,
      address: emp.address,
      emergency_contact_name: emp.emergency_contact_name,
      emergency_contact_phone: emp.emergency_contact_phone,
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
              <a href="/dashboard/hr/roster">Shift roster &rarr;</a>
              {" · "}
              <a href="/dashboard/hr/documents">Employee documents &rarr;</a>
              {" · "}
              <a href="/dashboard/hr/skills">Skills &rarr;</a>
              {" · "}
              <a href="/dashboard/hr/fleet">Fleet &rarr;</a>
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
            <h2 className={shared.sectionTitle}>Salary structures</h2>
            <p className={shared.hint}>Pay grades employees can be assigned to instead of a one-off salary.</p>
            <div className={shared.card}>
              <table className={shared.table}>
                <tbody>
                  {salaryStructures?.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{(s.base_salary_cents / 100).toFixed(2)}</td>
                      <td className={shared.tableMuted}>{s.description || "—"}</td>
                      {canManage && (
                        <td style={{ textAlign: "right" }}>
                          <RowActions onDelete={() => handleDeleteStructure(s.id)} disabled={structureWorking} />
                        </td>
                      )}
                    </tr>
                  ))}
                  {salaryStructures?.length === 0 && (
                    <tr>
                      <td colSpan={4} className={shared.tableMuted}>
                        No salary structures yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {canManage && (
                <form onSubmit={handleAddStructure} className={shared.formRow} style={{ marginTop: 12 }}>
                  <input
                    placeholder="Name (e.g. Grade 3)"
                    value={structureForm.name}
                    onChange={(e) => setStructureForm({ ...structureForm, name: e.target.value })}
                    className={shared.input}
                    style={{ maxWidth: 160 }}
                  />
                  <input
                    placeholder="Base salary"
                    type="number"
                    step="0.01"
                    value={structureForm.base_salary_cents}
                    onChange={(e) => setStructureForm({ ...structureForm, base_salary_cents: e.target.value })}
                    className={shared.input}
                    style={{ width: 130 }}
                  />
                  <input
                    placeholder="Description"
                    value={structureForm.description}
                    onChange={(e) => setStructureForm({ ...structureForm, description: e.target.value })}
                    className={shared.input}
                    style={{ flex: 1, maxWidth: 220 }}
                  />
                  <button
                    type="submit"
                    disabled={structureWorking || !structureForm.name}
                    className={`${shared.btn} ${shared.btnPrimary}`}
                  >
                    Add structure
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
                    <th>Manager</th>
                    <th>Status</th>
                    <th>Linked account</th>
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
                      <td className={shared.tableMuted}>{emp.manager_name || "—"}</td>
                      <td>{STATUS_LABELS[emp.status]}</td>
                      <td className={shared.tableMuted}>{emp.user_name || "—"}</td>
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
                      <td colSpan={10} className={shared.tableMuted}>
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
                  <select
                    value={empForm.salary_structure}
                    onChange={(e) => setEmpForm({ ...empForm, salary_structure: e.target.value })}
                    className={shared.select}
                    title="When set, payroll uses this pay grade's base salary instead of the typed-in salary"
                  >
                    <option value="">No salary structure (use typed salary)</option>
                    {salaryStructures?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({(s.base_salary_cents / 100).toFixed(2)})
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Salary (e.g. 50000)"
                    type="number"
                    value={empForm.salary_cents}
                    onChange={(e) => setEmpForm({ ...empForm, salary_cents: e.target.value })}
                    className={shared.input}
                    disabled={!!empForm.salary_structure}
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
                  <select
                    value={empForm.user}
                    onChange={(e) => setEmpForm({ ...empForm, user: e.target.value })}
                    className={shared.select}
                    title="Links this employee to a company member's login, enabling Employee Self-Service"
                  >
                    <option value="">No linked account (no self-service)</option>
                    {companyMembers?.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.name} ({m.email})
                      </option>
                    ))}
                  </select>
                  <select
                    value={empForm.cost_center}
                    onChange={(e) => setEmpForm({ ...empForm, cost_center: e.target.value })}
                    className={shared.select}
                  >
                    <option value="">No cost center</option>
                    {costCenters?.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={empForm.manager}
                    onChange={(e) => setEmpForm({ ...empForm, manager: e.target.value })}
                    className={shared.select}
                  >
                    <option value="">No manager (reports to no one)</option>
                    {employees
                      ?.filter((e) => e.id !== editingEmpId)
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.first_name} {e.last_name}
                        </option>
                      ))}
                  </select>
                  <details style={{ gridColumn: "1 / -1" }}>
                    <summary className={shared.hint} style={{ cursor: "pointer" }}>
                      More details (bank &amp; personal)
                    </summary>
                    <div className={shared.formRow} style={{ marginTop: 10 }}>
                      <select
                        value={empForm.payment_method}
                        onChange={(e) =>
                          setEmpForm({ ...empForm, payment_method: e.target.value as Employee["payment_method"] })
                        }
                        className={shared.select}
                      >
                        <option value="bank_transfer">Bank transfer</option>
                        <option value="cash">Cash</option>
                        <option value="mobile_money">Mobile money</option>
                      </select>
                      <input
                        placeholder="Bank name"
                        value={empForm.bank_name}
                        onChange={(e) => setEmpForm({ ...empForm, bank_name: e.target.value })}
                        className={shared.input}
                      />
                      <input
                        placeholder="Bank account number"
                        value={empForm.bank_account_number}
                        onChange={(e) => setEmpForm({ ...empForm, bank_account_number: e.target.value })}
                        className={shared.input}
                      />
                      <input
                        placeholder="Bank account name"
                        value={empForm.bank_account_name}
                        onChange={(e) => setEmpForm({ ...empForm, bank_account_name: e.target.value })}
                        className={shared.input}
                      />
                      <input
                        placeholder="National ID"
                        value={empForm.national_id}
                        onChange={(e) => setEmpForm({ ...empForm, national_id: e.target.value })}
                        className={shared.input}
                      />
                      <input
                        placeholder="Passport number"
                        value={empForm.passport_number}
                        onChange={(e) => setEmpForm({ ...empForm, passport_number: e.target.value })}
                        className={shared.input}
                      />
                      <input
                        type="date"
                        title="Date of birth"
                        value={empForm.date_of_birth}
                        onChange={(e) => setEmpForm({ ...empForm, date_of_birth: e.target.value })}
                        className={shared.input}
                      />
                      <select
                        value={empForm.gender}
                        onChange={(e) => setEmpForm({ ...empForm, gender: e.target.value as Employee["gender"] })}
                        className={shared.select}
                      >
                        <option value="">Gender…</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                      <select
                        value={empForm.marital_status}
                        onChange={(e) =>
                          setEmpForm({ ...empForm, marital_status: e.target.value as Employee["marital_status"] })
                        }
                        className={shared.select}
                      >
                        <option value="">Marital status…</option>
                        <option value="single">Single</option>
                        <option value="married">Married</option>
                        <option value="divorced">Divorced</option>
                        <option value="widowed">Widowed</option>
                      </select>
                      <input
                        placeholder="Address"
                        value={empForm.address}
                        onChange={(e) => setEmpForm({ ...empForm, address: e.target.value })}
                        className={shared.input}
                        style={{ flex: 1, maxWidth: 220 }}
                      />
                      <input
                        placeholder="Emergency contact name"
                        value={empForm.emergency_contact_name}
                        onChange={(e) => setEmpForm({ ...empForm, emergency_contact_name: e.target.value })}
                        className={shared.input}
                      />
                      <input
                        placeholder="Emergency contact phone"
                        value={empForm.emergency_contact_phone}
                        onChange={(e) => setEmpForm({ ...empForm, emergency_contact_phone: e.target.value })}
                        className={shared.input}
                      />
                    </div>
                  </details>
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



