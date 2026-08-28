"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import {
  api,
  ApiError,
  type EmployeePickerEntry,
  type EmployeeSkill,
  type Skill,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const PROFICIENCY_LABELS: Record<EmployeeSkill["proficiency"], string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
};

const EMPTY_SKILL_FORM = { name: "", category: "" };
const EMPTY_ASSIGN_FORM = { employee: "", skill: "", proficiency: "beginner" as EmployeeSkill["proficiency"] };

export default function SkillsPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [employeeSkills, setEmployeeSkills] = useState<EmployeeSkill[] | null>(null);
  const [employees, setEmployees] = useState<EmployeePickerEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [skillForm, setSkillForm] = useState(EMPTY_SKILL_FORM);
  const [skillWorking, setSkillWorking] = useState(false);
  const [skillError, setSkillError] = useState<string | null>(null);

  const [assignForm, setAssignForm] = useState(EMPTY_ASSIGN_FORM);
  const [assignWorking, setAssignWorking] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [sk, es, emp] = await Promise.all([
        api.listSkills(),
        api.listEmployeeSkills(),
        api.listEmployeePicker(),
      ]);
      setSkills(sk);
      setEmployeeSkills(es);
      setEmployees(emp);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load skills data.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddSkill(e: React.FormEvent) {
    e.preventDefault();
    setSkillWorking(true);
    setSkillError(null);
    try {
      await api.createSkill({ name: skillForm.name, category: skillForm.category });
      setSkillForm(EMPTY_SKILL_FORM);
      await loadAll();
    } catch (err) {
      setSkillError(err instanceof ApiError ? err.message : "Failed to save skill.");
    } finally {
      setSkillWorking(false);
    }
  }

  async function handleDeleteSkill(id: number) {
    try {
      await api.deleteSkill(id);
      await loadAll();
    } catch (err) {
      setSkillError(err instanceof ApiError ? err.message : "Failed to delete skill.");
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setAssignWorking(true);
    setAssignError(null);
    try {
      await api.createEmployeeSkill({
        employee: Number(assignForm.employee),
        skill: Number(assignForm.skill),
        proficiency: assignForm.proficiency,
      });
      setAssignForm(EMPTY_ASSIGN_FORM);
      await loadAll();
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.message : "Failed to assign skill.");
    } finally {
      setAssignWorking(false);
    }
  }

  async function handleUpdateProficiency(es: EmployeeSkill, proficiency: EmployeeSkill["proficiency"]) {
    setAssignWorking(true);
    setAssignError(null);
    try {
      await api.updateEmployeeSkill(es.id, { proficiency });
      await loadAll();
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.message : "Failed to update proficiency.");
    } finally {
      setAssignWorking(false);
    }
  }

  async function handleUnassign(id: number) {
    try {
      await api.deleteEmployeeSkill(id);
      await loadAll();
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.message : "Failed to remove skill.");
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
            <h1 className={shared.pageTitle}>Skills</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
            <p className={shared.hint} style={{ marginTop: 4 }}>
              <a href="/dashboard/hr">&larr; Back to HR</a>
            </p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}
        <p className={shared.hint} style={{ maxWidth: 700 }}>
          A resume/CV attaches to each employee via the documents panel on the Employees table —
          this page is only the skills matrix.
        </p>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Skill catalog</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {skills?.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td className={shared.tableMuted}>{s.category || "—"}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDeleteSkill(s.id)} disabled={skillWorking} />
                      </td>
                    )}
                  </tr>
                ))}
                {skills?.length === 0 && (
                  <tr>
                    <td colSpan={3} className={shared.tableMuted}>
                      No skills defined yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddSkill} className={shared.formRow} style={{ marginTop: 12 }}>
                <input
                  placeholder="Skill name (e.g. Python)"
                  value={skillForm.name}
                  onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })}
                  className={shared.input}
                  style={{ flex: 1, maxWidth: 240 }}
                />
                <input
                  placeholder="Category (optional)"
                  value={skillForm.category}
                  onChange={(e) => setSkillForm({ ...skillForm, category: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 180 }}
                />
                <button
                  type="submit"
                  disabled={skillWorking || !skillForm.name}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Add skill
                </button>
                {skillError && <p className={shared.errorText}>{skillError}</p>}
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Employee skills matrix</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Skill</th>
                  <th>Proficiency</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {employeeSkills?.map((es) => (
                  <tr key={es.id}>
                    <td>{es.employee_name}</td>
                    <td>
                      {es.skill_name}
                      {es.skill_category && <div className={shared.tableMuted}>{es.skill_category}</div>}
                    </td>
                    <td>
                      {canManage ? (
                        <select
                          value={es.proficiency}
                          onChange={(e) =>
                            handleUpdateProficiency(es, e.target.value as EmployeeSkill["proficiency"])
                          }
                          disabled={assignWorking}
                          className={shared.select}
                        >
                          {Object.entries(PROFICIENCY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        PROFICIENCY_LABELS[es.proficiency]
                      )}
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleUnassign(es.id)} disabled={assignWorking} />
                      </td>
                    )}
                  </tr>
                ))}
                {employeeSkills?.length === 0 && (
                  <tr>
                    <td colSpan={4} className={shared.tableMuted}>
                      No skills assigned yet.
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
                  value={assignForm.skill}
                  onChange={(e) => setAssignForm({ ...assignForm, skill: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Skill…</option>
                  {skills?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={assignForm.proficiency}
                  onChange={(e) =>
                    setAssignForm({
                      ...assignForm,
                      proficiency: e.target.value as EmployeeSkill["proficiency"],
                    })
                  }
                  className={shared.select}
                >
                  {Object.entries(PROFICIENCY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={assignWorking || !assignForm.employee || !assignForm.skill}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Assign skill
                </button>
                {assignError && <p className={shared.errorText}>{assignError}</p>}
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
