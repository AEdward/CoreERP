"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { api, ApiError, type Department, type Employee } from "@/lib/api";
import { useSession } from "@/lib/useSession";

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
  salary_cents: "",
  joining_date: "",
  status: "active" as Employee["status"],
};

export default function HrPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newDeptName, setNewDeptName] = useState("");
  const [deptWorking, setDeptWorking] = useState(false);

  const [empForm, setEmpForm] = useState(EMPTY_EMPLOYEE_FORM);
  const [empWorking, setEmpWorking] = useState(false);
  const [empError, setEmpError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [depts, emps] = await Promise.all([api.listDepartments(), api.listEmployees()]);
      setDepartments(depts);
      setEmployees(emps);
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
      await api.createDepartment({ name: newDeptName });
      setNewDeptName("");
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to create department.");
    } finally {
      setDeptWorking(false);
    }
  }

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault();
    setEmpWorking(true);
    setEmpError(null);
    try {
      await api.createEmployee({
        first_name: empForm.first_name,
        last_name: empForm.last_name,
        email: empForm.email,
        phone: empForm.phone,
        position: empForm.position,
        department: empForm.department ? Number(empForm.department) : null,
        salary_cents: empForm.salary_cents ? Math.round(Number(empForm.salary_cents) * 100) : 0,
        joining_date: empForm.joining_date || null,
        status: empForm.status,
      });
      setEmpForm(EMPTY_EMPLOYEE_FORM);
      await loadAll();
    } catch (err) {
      setEmpError(err instanceof ApiError ? err.message : "Failed to create employee.");
    } finally {
      setEmpWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hr.manage") ?? false;
  const departmentName = (id: number | null) => departments?.find((d) => d.id === id)?.name ?? "—";

  return (
    <main style={{ maxWidth: 960, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <AppHeader activeMembership={activeMembership} />

      {!activeMembership ? (
        <p style={{ color: "#666" }}>
          Pick an active company on the <a href="/dashboard">dashboard</a> first.
        </p>
      ) : (
        <>
          <h1 style={{ fontSize: 20 }}>HR — {activeMembership.company.name}</h1>
          {loadError && <p style={{ color: "crimson" }}>{loadError}</p>}

          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Departments
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
              <tbody>
                {departments?.map((d) => (
                  <tr key={d.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{d.name}</td>
                  </tr>
                ))}
                {departments?.length === 0 && (
                  <tr>
                    <td style={{ padding: "6px 4px", color: "#999" }}>No departments yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddDepartment} style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <input
                  placeholder="New department name"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  style={{ padding: 8, flex: 1, maxWidth: 280 }}
                />
                <button
                  type="submit"
                  disabled={deptWorking || !newDeptName}
                  style={{ padding: "8px 16px" }}
                >
                  Add department
                </button>
              </form>
            )}
          </section>

          <section style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Employees
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Name</th>
                  <th style={{ padding: "6px 4px" }}>Position</th>
                  <th style={{ padding: "6px 4px" }}>Department</th>
                  <th style={{ padding: "6px 4px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {employees?.map((emp) => (
                  <tr key={emp.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>
                      {emp.first_name} {emp.last_name}
                    </td>
                    <td style={{ padding: "6px 4px" }}>{emp.position || "—"}</td>
                    <td style={{ padding: "6px 4px" }}>{departmentName(emp.department)}</td>
                    <td style={{ padding: "6px 4px" }}>{STATUS_LABELS[emp.status]}</td>
                  </tr>
                ))}
                {employees?.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: "6px 4px", color: "#999" }}>
                      No employees yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form
                onSubmit={handleAddEmployee}
                style={{
                  marginTop: 16,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 8,
                  maxWidth: 720,
                }}
              >
                <input
                  placeholder="First name"
                  required
                  value={empForm.first_name}
                  onChange={(e) => setEmpForm({ ...empForm, first_name: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Last name"
                  required
                  value={empForm.last_name}
                  onChange={(e) => setEmpForm({ ...empForm, last_name: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Email"
                  type="email"
                  value={empForm.email}
                  onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Phone"
                  value={empForm.phone}
                  onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Position"
                  value={empForm.position}
                  onChange={(e) => setEmpForm({ ...empForm, position: e.target.value })}
                  style={{ padding: 8 }}
                />
                <select
                  value={empForm.department}
                  onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })}
                  style={{ padding: 8 }}
                >
                  <option value="">No department</option>
                  {departments?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Salary (e.g. 50000)"
                  type="number"
                  value={empForm.salary_cents}
                  onChange={(e) => setEmpForm({ ...empForm, salary_cents: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  type="date"
                  value={empForm.joining_date}
                  onChange={(e) => setEmpForm({ ...empForm, joining_date: e.target.value })}
                  style={{ padding: 8 }}
                />
                <select
                  value={empForm.status}
                  onChange={(e) =>
                    setEmpForm({ ...empForm, status: e.target.value as Employee["status"] })
                  }
                  style={{ padding: 8 }}
                >
                  <option value="active">Active</option>
                  <option value="on_leave">On leave</option>
                  <option value="terminated">Terminated</option>
                </select>
                <button
                  type="submit"
                  disabled={empWorking || !empForm.first_name || !empForm.last_name}
                  style={{ padding: "8px 16px", gridColumn: "1 / -1", justifySelf: "start" }}
                >
                  Add employee
                </button>
                {empError && (
                  <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{empError}</p>
                )}
              </form>
            )}
          </section>
        </>
      )}
    </main>
  );
}
