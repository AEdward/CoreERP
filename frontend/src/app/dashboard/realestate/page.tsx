"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import {
  api,
  ApiError,
  type PropertyProject,
  type PropertyUnit,
  type RealEstateBuilding,
  type UnitType,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const PROJECT_STATUS_LABELS: Record<PropertyProject["status"], string> = {
  planning: "Planning",
  under_construction: "Under construction",
  completed: "Completed",
  on_hold: "On hold",
};

const UNIT_STATUS_LABELS: Record<PropertyUnit["status"], string> = {
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
  rented: "Rented",
  maintenance: "Under maintenance",
};

const UNIT_STATUS_BADGES: Record<PropertyUnit["status"], string> = {
  available: shared.badgeSuccess,
  reserved: shared.badgeWarn,
  sold: shared.badgeInfo,
  rented: shared.badgeInfo,
  maintenance: shared.badgeDanger,
};

export default function RealEstatePropertiesPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [projects, setProjects] = useState<PropertyProject[] | null>(null);
  const [buildings, setBuildings] = useState<RealEstateBuilding[] | null>(null);
  const [unitTypes, setUnitTypes] = useState<UnitType[] | null>(null);
  const [units, setUnits] = useState<PropertyUnit[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const [projectForm, setProjectForm] = useState({ name: "", location: "" });
  const [buildingForm, setBuildingForm] = useState({ project: "", name: "", floors_count: "1" });
  const [unitTypeForm, setUnitTypeForm] = useState({ name: "", bedrooms: "", bathrooms: "" });
  const [unitForm, setUnitForm] = useState({ building: "", unit_type: "", unit_number: "", floor: "" });

  async function loadAll() {
    try {
      const [p, b, ut, u] = await Promise.all([
        api.listPropertyProjects(),
        api.listRealEstateBuildings(),
        api.listUnitTypes(),
        api.listPropertyUnits(),
      ]);
      setProjects(p);
      setBuildings(b);
      setUnitTypes(ut);
      setUnits(u);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load properties.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddProject(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    try {
      await api.createPropertyProject({ name: projectForm.name, location: projectForm.location });
      setProjectForm({ name: "", location: "" });
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save project.");
    } finally {
      setWorking(false);
    }
  }

  async function handleAddBuilding(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    try {
      await api.createRealEstateBuilding({
        project: buildingForm.project ? Number(buildingForm.project) : null,
        name: buildingForm.name,
        floors_count: Number(buildingForm.floors_count) || 1,
      });
      setBuildingForm({ project: "", name: "", floors_count: "1" });
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save building.");
    } finally {
      setWorking(false);
    }
  }

  async function handleAddUnitType(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    try {
      await api.createUnitType({
        name: unitTypeForm.name,
        bedrooms: Number(unitTypeForm.bedrooms) || 0,
        bathrooms: Number(unitTypeForm.bathrooms) || 0,
      });
      setUnitTypeForm({ name: "", bedrooms: "", bathrooms: "" });
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save unit type.");
    } finally {
      setWorking(false);
    }
  }

  async function handleAddUnit(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    try {
      await api.createPropertyUnit({
        building: Number(unitForm.building),
        unit_type: unitForm.unit_type ? Number(unitForm.unit_type) : null,
        unit_number: unitForm.unit_number,
        floor: unitForm.floor ? Number(unitForm.floor) : null,
      });
      setUnitForm({ building: "", unit_type: "", unit_number: "", floor: "" });
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save unit.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDeleteProject(id: number) {
    try {
      await api.deletePropertyProject(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to delete project.");
    }
  }

  async function handleDeleteBuilding(id: number) {
    try {
      await api.deleteRealEstateBuilding(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to delete building.");
    }
  }

  async function handleDeleteUnitType(id: number) {
    try {
      await api.deleteUnitType(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to delete unit type.");
    }
  }

  async function handleDeleteUnit(id: number) {
    try {
      await api.deletePropertyUnit(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to delete unit.");
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("realestate.manage") ?? false;

  return (
    <ModuleShell moduleKey="realestate" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Properties</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Property projects</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Location</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {projects?.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className={shared.tableMuted}>{p.location || "—"}</td>
                    <td className={shared.tableMuted}>{PROJECT_STATUS_LABELS[p.status]}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDeleteProject(p.id)} disabled={working} />
                      </td>
                    )}
                  </tr>
                ))}
                {projects?.length === 0 && (
                  <tr>
                    <td colSpan={4} className={shared.tableMuted}>
                      No projects yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddProject} className={shared.formRow} style={{ marginTop: 12 }}>
                <input
                  placeholder="Project name"
                  required
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Location"
                  value={projectForm.location}
                  onChange={(e) => setProjectForm({ ...projectForm, location: e.target.value })}
                  className={shared.input}
                />
                <button type="submit" disabled={working || !projectForm.name} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Add project
                </button>
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Buildings</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Project</th>
                  <th>Floors</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {buildings?.map((b) => (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                    <td className={shared.tableMuted}>{b.project_name || "—"}</td>
                    <td className={shared.tableMuted}>{b.floors_count}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDeleteBuilding(b.id)} disabled={working} />
                      </td>
                    )}
                  </tr>
                ))}
                {buildings?.length === 0 && (
                  <tr>
                    <td colSpan={4} className={shared.tableMuted}>
                      No buildings yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddBuilding} className={shared.formRow} style={{ marginTop: 12 }}>
                <select
                  value={buildingForm.project}
                  onChange={(e) => setBuildingForm({ ...buildingForm, project: e.target.value })}
                  className={shared.select}
                >
                  <option value="">No project…</option>
                  {projects?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Building name"
                  required
                  value={buildingForm.name}
                  onChange={(e) => setBuildingForm({ ...buildingForm, name: e.target.value })}
                  className={shared.input}
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Floors"
                  value={buildingForm.floors_count}
                  onChange={(e) => setBuildingForm({ ...buildingForm, floors_count: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 100 }}
                />
                <button type="submit" disabled={working || !buildingForm.name} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Add building
                </button>
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Unit types</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Bedrooms</th>
                  <th>Bathrooms</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {unitTypes?.map((ut) => (
                  <tr key={ut.id}>
                    <td>{ut.name}</td>
                    <td className={shared.tableMuted}>{ut.bedrooms}</td>
                    <td className={shared.tableMuted}>{ut.bathrooms}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDeleteUnitType(ut.id)} disabled={working} />
                      </td>
                    )}
                  </tr>
                ))}
                {unitTypes?.length === 0 && (
                  <tr>
                    <td colSpan={4} className={shared.tableMuted}>
                      No unit types yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddUnitType} className={shared.formRow} style={{ marginTop: 12 }}>
                <input
                  placeholder="Name (e.g. 2BR Standard)"
                  required
                  value={unitTypeForm.name}
                  onChange={(e) => setUnitTypeForm({ ...unitTypeForm, name: e.target.value })}
                  className={shared.input}
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Bedrooms"
                  value={unitTypeForm.bedrooms}
                  onChange={(e) => setUnitTypeForm({ ...unitTypeForm, bedrooms: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 100 }}
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Bathrooms"
                  value={unitTypeForm.bathrooms}
                  onChange={(e) => setUnitTypeForm({ ...unitTypeForm, bathrooms: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 100 }}
                />
                <button type="submit" disabled={working || !unitTypeForm.name} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Add unit type
                </button>
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Units</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Building</th>
                  <th>Unit #</th>
                  <th>Type</th>
                  <th>Floor</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {units?.map((u) => (
                  <tr key={u.id}>
                    <td>{u.building_name}</td>
                    <td>{u.unit_number}</td>
                    <td className={shared.tableMuted}>{u.unit_type_name || "—"}</td>
                    <td className={shared.tableMuted}>{u.floor ?? "—"}</td>
                    <td>
                      <span className={`${shared.badge} ${UNIT_STATUS_BADGES[u.status]}`}>
                        {UNIT_STATUS_LABELS[u.status]}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDeleteUnit(u.id)} disabled={working} />
                      </td>
                    )}
                  </tr>
                ))}
                {units?.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No units yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddUnit} className={shared.formRow} style={{ marginTop: 12 }}>
                <select
                  required
                  value={unitForm.building}
                  onChange={(e) => setUnitForm({ ...unitForm, building: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Building…</option>
                  {buildings?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <select
                  value={unitForm.unit_type}
                  onChange={(e) => setUnitForm({ ...unitForm, unit_type: e.target.value })}
                  className={shared.select}
                >
                  <option value="">No type…</option>
                  {unitTypes?.map((ut) => (
                    <option key={ut.id} value={ut.id}>
                      {ut.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Unit number"
                  required
                  value={unitForm.unit_number}
                  onChange={(e) => setUnitForm({ ...unitForm, unit_number: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 120 }}
                />
                <input
                  type="number"
                  placeholder="Floor"
                  value={unitForm.floor}
                  onChange={(e) => setUnitForm({ ...unitForm, floor: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 100 }}
                />
                <button
                  type="submit"
                  disabled={working || !unitForm.building || !unitForm.unit_number}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Add unit
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
