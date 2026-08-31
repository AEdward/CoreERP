"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ModuleShell } from "@/components/ModuleShell";
import {
  api,
  ApiError,
  type BOQItem,
  type ChangeOrder,
  type ConstructionCosting,
  type ConstructionProject,
  type Contract,
  type Customer,
  type Employee,
  type Equipment,
  type EquipmentAssignment,
  type Item,
  type LaborAssignment,
  type MaterialIssue,
  type QualityInspection,
  type SafetyIncident,
  type SiteExpense,
  type SiteLog,
  type Supplier,
  type Warehouse,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const PROJECT_STATUS_BADGES: Record<ConstructionProject["status"], string> = {
  planning: shared.badgeInfo,
  in_progress: shared.badgeWarn,
  on_hold: shared.badgeDanger,
  completed: shared.badgeSuccess,
  cancelled: shared.badgeDanger,
};

const CONTRACT_STATUS_BADGES: Record<Contract["status"], string> = {
  draft: shared.badgeInfo,
  active: shared.badgeWarn,
  completed: shared.badgeSuccess,
  terminated: shared.badgeDanger,
};

const CHANGE_ORDER_BADGES: Record<ChangeOrder["status"], string> = {
  pending: shared.badgeWarn,
  approved: shared.badgeSuccess,
  rejected: shared.badgeDanger,
};

const QUALITY_BADGES: Record<QualityInspection["result"], string> = {
  pass: shared.badgeSuccess,
  fail: shared.badgeDanger,
  conditional: shared.badgeWarn,
};

const SEVERITY_BADGES: Record<SafetyIncident["severity"], string> = {
  low: shared.badgeInfo,
  medium: shared.badgeWarn,
  high: shared.badgeDanger,
  critical: shared.badgeDanger,
};

export default function ConstructionProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = Number(params.id);
  const { me, activeMembership, error: sessionError } = useSession();

  const [project, setProject] = useState<ConstructionProject | null>(null);
  const [costing, setCosting] = useState<ConstructionCosting | null>(null);
  const [boqItems, setBoqItems] = useState<BOQItem[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [siteLogs, setSiteLogs] = useState<SiteLog[]>([]);
  const [materialIssues, setMaterialIssues] = useState<MaterialIssue[]>([]);
  const [equipmentAssignments, setEquipmentAssignments] = useState<EquipmentAssignment[]>([]);
  const [laborAssignments, setLaborAssignments] = useState<LaborAssignment[]>([]);
  const [siteExpenses, setSiteExpenses] = useState<SiteExpense[]>([]);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [qualityInspections, setQualityInspections] = useState<QualityInspection[]>([]);
  const [safetyIncidents, setSafetyIncidents] = useState<SafetyIncident[]>([]);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [boqForm, setBoqForm] = useState({ category: "", description: "", unit: "", quantity: "1", unit_cost_cents: "" });
  const [contractForm, setContractForm] = useState({
    contract_type: "main" as Contract["contract_type"],
    customer: "",
    supplier: "",
    scope_of_work: "",
    contract_value_cents: "",
    retention_percent: "",
    start_date: "",
  });
  const [logForm, setLogForm] = useState({ log_date: "", percent_complete: "0", work_summary: "", weather: "", logged_by: "" });
  const [materialForm, setMaterialForm] = useState({ item: "", warehouse: "", quantity: "1" });
  const [equipmentForm, setEquipmentForm] = useState({ equipment: "", start_date: "", daily_rate_cents: "" });
  const [laborForm, setLaborForm] = useState({ employee: "", role: "", start_date: "", daily_rate_cents: "" });
  const [expenseForm, setExpenseForm] = useState({ category: "", description: "", amount_cents: "", expense_date: "" });
  const [changeOrderForm, setChangeOrderForm] = useState({ description: "", amount_cents: "", requested_date: "" });
  const [qualityForm, setQualityForm] = useState({ inspected_by: "", inspection_date: "", result: "pass" as QualityInspection["result"], notes: "" });
  const [safetyForm, setSafetyForm] = useState({ incident_date: "", description: "", severity: "low" as SafetyIncident["severity"], reported_by: "", corrective_action: "" });

  async function load() {
    try {
      const [
        proj,
        cost,
        boq,
        con,
        logs,
        materials,
        equipAssign,
        labor,
        expenses,
        changes,
        quality,
        safety,
        cust,
        supp,
        emp,
        it,
        wh,
        eq,
      ] = await Promise.all([
        api.getConstructionProject(projectId),
        api.getConstructionProjectCosting(projectId),
        api.listBOQItems(projectId),
        api.listContracts(projectId),
        api.listSiteLogs(projectId),
        api.listMaterialIssues(projectId),
        api.listEquipmentAssignments({ project: projectId }),
        api.listLaborAssignments(projectId),
        api.listSiteExpenses(projectId),
        api.listChangeOrders(projectId),
        api.listQualityInspections(projectId),
        api.listSafetyIncidents(projectId),
        api.listCustomers(),
        api.listSuppliers(),
        api.listEmployees(),
        api.listItems(),
        api.listWarehouses(),
        api.listEquipment(),
      ]);
      setProject(proj);
      setCosting(cost);
      setBoqItems(boq);
      setContracts(con);
      setSiteLogs(logs);
      setMaterialIssues(materials);
      setEquipmentAssignments(equipAssign);
      setLaborAssignments(labor);
      setSiteExpenses(expenses);
      setChangeOrders(changes);
      setQualityInspections(quality);
      setSafetyIncidents(safety);
      setCustomers(cust);
      setSuppliers(supp);
      setEmployees(emp);
      setItems(it);
      setWarehouses(wh);
      setEquipmentList(eq);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load project.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id, projectId]);

  async function withWorking<T>(fn: () => Promise<T>, errMsg: string) {
    setWorking(true);
    setActionError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : errMsg);
    } finally {
      setWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("construction.manage") ?? false;
  const availableEquipment = equipmentList.filter((eq) => eq.status === "available");

  return (
    <ModuleShell moduleKey="construction" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>{project?.name ?? "Project"}</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
            <p className={shared.hint} style={{ marginTop: 4 }}>
              <Link href="/dashboard/construction">&larr; Back to projects</Link>
            </p>
          </div>
          {project && (
            <div className={shared.pageActions}>
              <span className={`${shared.badge} ${PROJECT_STATUS_BADGES[project.status]}`}>{project.status.replace("_", " ")}</span>
            </div>
          )}
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}
        {actionError && <p className={shared.errorText}>{actionError}</p>}

        {project && (
          <div className={shared.section}>
            <div className={shared.card}>
              <div className={shared.formGrid}>
                <div>
                  <div className={shared.label}>Number</div>
                  <div>{project.number}</div>
                </div>
                <div>
                  <div className={shared.label}>Client</div>
                  <div>{project.client_name || "—"}</div>
                </div>
                <div>
                  <div className={shared.label}>Site manager</div>
                  <div>{project.site_manager_name || "—"}</div>
                </div>
                <div>
                  <div className={shared.label}>Site address</div>
                  <div>{project.site_address || "—"}</div>
                </div>
                <div>
                  <div className={shared.label}>Start / end</div>
                  <div>
                    {project.start_date || "—"} → {project.end_date || "—"}
                  </div>
                </div>
                <div>
                  <div className={shared.label}>Budget</div>
                  <div>{formatCents(project.budget_cents)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {costing && (
          <div className={shared.section}>
            <h2 className={shared.sectionTitle}>Project costing</h2>
            <div className={shared.card}>
              <div className={shared.formGrid}>
                <div>
                  <div className={shared.label}>Budget</div>
                  <div>{formatCents(costing.budget_cents)}</div>
                </div>
                <div>
                  <div className={shared.label}>BOQ estimate</div>
                  <div>{formatCents(costing.estimated_cents)}</div>
                </div>
                <div>
                  <div className={shared.label}>Materials (actual)</div>
                  <div>{formatCents(costing.materials_cents)}</div>
                </div>
                <div>
                  <div className={shared.label}>Labor (to date)</div>
                  <div>{formatCents(costing.labor_cents)}</div>
                </div>
                <div>
                  <div className={shared.label}>Equipment (to date)</div>
                  <div>{formatCents(costing.equipment_cents)}</div>
                </div>
                <div>
                  <div className={shared.label}>Subcontracts (active)</div>
                  <div>{formatCents(costing.subcontract_cents)}</div>
                </div>
                <div>
                  <div className={shared.label}>Site expenses</div>
                  <div>{formatCents(costing.site_expenses_cents)}</div>
                </div>
                <div>
                  <div className={shared.label}>Total actual</div>
                  <div>{formatCents(costing.actual_cents)}</div>
                </div>
                <div>
                  <div className={shared.label}>Variance</div>
                  <div style={{ color: costing.variance_cents < 0 ? "crimson" : undefined }}>
                    {formatCents(costing.variance_cents)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Bill of Quantities</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Unit</th>
                  <th>Quantity</th>
                  <th>Unit cost</th>
                  <th>Estimated cost</th>
                </tr>
              </thead>
              <tbody>
                {boqItems.map((b) => (
                  <tr key={b.id}>
                    <td className={shared.tableMuted}>{b.category || "—"}</td>
                    <td>{b.description}</td>
                    <td className={shared.tableMuted}>{b.unit || "—"}</td>
                    <td className={shared.tableMuted}>{b.quantity}</td>
                    <td className={shared.tableMuted}>{formatCents(b.unit_cost_cents)}</td>
                    <td className={shared.tableMuted}>{formatCents(b.estimated_cost_cents)}</td>
                  </tr>
                ))}
                {boqItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No BOQ items yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  withWorking(
                    () =>
                      api.createBOQItem({
                        project: projectId,
                        category: boqForm.category,
                        description: boqForm.description,
                        unit: boqForm.unit,
                        quantity: boqForm.quantity,
                        unit_cost_cents: Math.round(Number(boqForm.unit_cost_cents || 0) * 100),
                      }),
                    "Failed to save BOQ item."
                  ).then(() => setBoqForm({ category: "", description: "", unit: "", quantity: "1", unit_cost_cents: "" }));
                }}
                className={shared.formRow}
                style={{ marginTop: 12, flexWrap: "wrap" }}
              >
                <input placeholder="Category" value={boqForm.category} onChange={(e) => setBoqForm({ ...boqForm, category: e.target.value })} className={shared.input} />
                <input
                  placeholder="Description"
                  required
                  value={boqForm.description}
                  onChange={(e) => setBoqForm({ ...boqForm, description: e.target.value })}
                  className={shared.input}
                />
                <input placeholder="Unit" value={boqForm.unit} onChange={(e) => setBoqForm({ ...boqForm, unit: e.target.value })} className={shared.input} style={{ maxWidth: 90 }} />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Qty"
                  value={boqForm.quantity}
                  onChange={(e) => setBoqForm({ ...boqForm, quantity: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 90 }}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Unit cost"
                  value={boqForm.unit_cost_cents}
                  onChange={(e) => setBoqForm({ ...boqForm, unit_cost_cents: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 100 }}
                />
                <button type="submit" disabled={working || !boqForm.description} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Add BOQ item
                </button>
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Contracts &amp; Subcontractors</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Type</th>
                  <th>Party</th>
                  <th>Scope</th>
                  <th>Value</th>
                  <th>Retention</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.id}>
                    <td>{c.number}</td>
                    <td className={shared.tableMuted}>{c.contract_type === "main" ? "Main" : "Subcontract"}</td>
                    <td className={shared.tableMuted}>{c.customer_name || c.supplier_name || "—"}</td>
                    <td className={shared.tableMuted}>{c.scope_of_work || "—"}</td>
                    <td className={shared.tableMuted}>{formatCents(c.contract_value_cents)}</td>
                    <td className={shared.tableMuted}>{c.retention_percent}%</td>
                    <td>
                      <span className={`${shared.badge} ${CONTRACT_STATUS_BADGES[c.status]}`}>{c.status}</span>
                    </td>
                  </tr>
                ))}
                {contracts.length === 0 && (
                  <tr>
                    <td colSpan={7} className={shared.tableMuted}>
                      No contracts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  withWorking(
                    () =>
                      api.createContract({
                        project: projectId,
                        contract_type: contractForm.contract_type,
                        customer: contractForm.contract_type === "main" && contractForm.customer ? Number(contractForm.customer) : null,
                        supplier: contractForm.contract_type === "subcontract" && contractForm.supplier ? Number(contractForm.supplier) : null,
                        scope_of_work: contractForm.scope_of_work,
                        contract_value_cents: Math.round(Number(contractForm.contract_value_cents || 0) * 100),
                        retention_percent: contractForm.retention_percent || "0",
                        start_date: contractForm.start_date || null,
                      }),
                    "Failed to save contract."
                  ).then(() =>
                    setContractForm({
                      contract_type: "main",
                      customer: "",
                      supplier: "",
                      scope_of_work: "",
                      contract_value_cents: "",
                      retention_percent: "",
                      start_date: "",
                    })
                  );
                }}
                className={shared.formRow}
                style={{ marginTop: 12, flexWrap: "wrap" }}
              >
                <select
                  value={contractForm.contract_type}
                  onChange={(e) => setContractForm({ ...contractForm, contract_type: e.target.value as Contract["contract_type"] })}
                  className={shared.select}
                >
                  <option value="main">Main contract</option>
                  <option value="subcontract">Subcontract</option>
                </select>
                {contractForm.contract_type === "main" ? (
                  <select value={contractForm.customer} onChange={(e) => setContractForm({ ...contractForm, customer: e.target.value })} className={shared.select}>
                    <option value="">Client…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select value={contractForm.supplier} onChange={(e) => setContractForm({ ...contractForm, supplier: e.target.value })} className={shared.select}>
                    <option value="">Subcontractor…</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  placeholder="Scope of work"
                  value={contractForm.scope_of_work}
                  onChange={(e) => setContractForm({ ...contractForm, scope_of_work: e.target.value })}
                  className={shared.input}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Value"
                  value={contractForm.contract_value_cents}
                  onChange={(e) => setContractForm({ ...contractForm, contract_value_cents: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 110 }}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Retention %"
                  value={contractForm.retention_percent}
                  onChange={(e) => setContractForm({ ...contractForm, retention_percent: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 100 }}
                />
                <input
                  type="date"
                  value={contractForm.start_date}
                  onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={working || (contractForm.contract_type === "main" ? !contractForm.customer : !contractForm.supplier)}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Add contract
                </button>
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Site logs (work progress)</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>% complete</th>
                  <th>Summary</th>
                  <th>Weather</th>
                  <th>Logged by</th>
                </tr>
              </thead>
              <tbody>
                {siteLogs.map((l) => (
                  <tr key={l.id}>
                    <td>{l.log_date}</td>
                    <td className={shared.tableMuted}>{l.percent_complete}%</td>
                    <td className={shared.tableMuted}>{l.work_summary || "—"}</td>
                    <td className={shared.tableMuted}>{l.weather || "—"}</td>
                    <td className={shared.tableMuted}>{l.logged_by_name || "—"}</td>
                  </tr>
                ))}
                {siteLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} className={shared.tableMuted}>
                      No site logs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  withWorking(
                    () =>
                      api.createSiteLog({
                        project: projectId,
                        log_date: logForm.log_date,
                        percent_complete: Number(logForm.percent_complete || 0),
                        work_summary: logForm.work_summary,
                        weather: logForm.weather,
                        logged_by: logForm.logged_by ? Number(logForm.logged_by) : null,
                      }),
                    "Failed to save site log."
                  ).then(() => setLogForm({ log_date: "", percent_complete: "0", work_summary: "", weather: "", logged_by: "" }));
                }}
                className={shared.formRow}
                style={{ marginTop: 12, flexWrap: "wrap" }}
              >
                <input type="date" required value={logForm.log_date} onChange={(e) => setLogForm({ ...logForm, log_date: e.target.value })} className={shared.input} />
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="% complete"
                  value={logForm.percent_complete}
                  onChange={(e) => setLogForm({ ...logForm, percent_complete: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 110 }}
                />
                <input
                  placeholder="Work summary"
                  value={logForm.work_summary}
                  onChange={(e) => setLogForm({ ...logForm, work_summary: e.target.value })}
                  className={shared.input}
                />
                <input placeholder="Weather" value={logForm.weather} onChange={(e) => setLogForm({ ...logForm, weather: e.target.value })} className={shared.input} style={{ maxWidth: 110 }} />
                <select value={logForm.logged_by} onChange={(e) => setLogForm({ ...logForm, logged_by: e.target.value })} className={shared.select}>
                  <option value="">Logged by…</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={working || !logForm.log_date} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Add log
                </button>
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Materials issued</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Warehouse</th>
                  <th>Quantity</th>
                  <th>Unit cost</th>
                  <th>Total cost</th>
                </tr>
              </thead>
              <tbody>
                {materialIssues.map((m) => (
                  <tr key={m.id}>
                    <td>{m.item_name}</td>
                    <td className={shared.tableMuted}>{m.warehouse_name}</td>
                    <td className={shared.tableMuted}>{m.quantity}</td>
                    <td className={shared.tableMuted}>{formatCents(m.unit_cost_cents)}</td>
                    <td className={shared.tableMuted}>{formatCents(m.unit_cost_cents * m.quantity)}</td>
                  </tr>
                ))}
                {materialIssues.length === 0 && (
                  <tr>
                    <td colSpan={5} className={shared.tableMuted}>
                      No materials issued yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  withWorking(
                    () =>
                      api.createMaterialIssue({
                        project: projectId,
                        item: Number(materialForm.item),
                        warehouse: Number(materialForm.warehouse),
                        quantity: Number(materialForm.quantity),
                      }),
                    "Failed to issue material."
                  ).then(() => setMaterialForm({ item: "", warehouse: "", quantity: "1" }));
                }}
                className={shared.formRow}
                style={{ marginTop: 12, flexWrap: "wrap" }}
              >
                <select required value={materialForm.item} onChange={(e) => setMaterialForm({ ...materialForm, item: e.target.value })} className={shared.select}>
                  <option value="">Item…</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
                <select required value={materialForm.warehouse} onChange={(e) => setMaterialForm({ ...materialForm, warehouse: e.target.value })} className={shared.select}>
                  <option value="">Warehouse…</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={materialForm.quantity}
                  onChange={(e) => setMaterialForm({ ...materialForm, quantity: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 90 }}
                />
                <button
                  type="submit"
                  disabled={working || !materialForm.item || !materialForm.warehouse}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Issue material
                </button>
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Equipment on site</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Equipment</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Daily rate</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {equipmentAssignments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.equipment_name}</td>
                    <td className={shared.tableMuted}>{a.start_date}</td>
                    <td className={shared.tableMuted}>{a.end_date || "—"}</td>
                    <td className={shared.tableMuted}>{formatCents(a.daily_rate_cents)}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        {!a.end_date && (
                          <button
                            type="button"
                            onClick={() => withWorking(() => api.endEquipmentAssignment(a.id), "Failed to end assignment.")}
                            disabled={working}
                            className={`${shared.btn} ${shared.btnSmall}`}
                          >
                            End
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {equipmentAssignments.length === 0 && (
                  <tr>
                    <td colSpan={5} className={shared.tableMuted}>
                      No equipment assigned yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  withWorking(
                    () =>
                      api.createEquipmentAssignment({
                        equipment: Number(equipmentForm.equipment),
                        project: projectId,
                        start_date: equipmentForm.start_date,
                        daily_rate_cents: Math.round(Number(equipmentForm.daily_rate_cents || 0) * 100),
                      }),
                    "Failed to assign equipment."
                  ).then(() => setEquipmentForm({ equipment: "", start_date: "", daily_rate_cents: "" }));
                }}
                className={shared.formRow}
                style={{ marginTop: 12, flexWrap: "wrap" }}
              >
                <select required value={equipmentForm.equipment} onChange={(e) => setEquipmentForm({ ...equipmentForm, equipment: e.target.value })} className={shared.select}>
                  <option value="">Equipment…</option>
                  {availableEquipment.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name}
                    </option>
                  ))}
                </select>
                <input type="date" required value={equipmentForm.start_date} onChange={(e) => setEquipmentForm({ ...equipmentForm, start_date: e.target.value })} className={shared.input} />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Daily rate"
                  value={equipmentForm.daily_rate_cents}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, daily_rate_cents: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 110 }}
                />
                <button type="submit" disabled={working || !equipmentForm.equipment || !equipmentForm.start_date} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Assign equipment
                </button>
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Labor on site</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Daily rate</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {laborAssignments.map((a) => (
                  <tr key={a.id}>
                    <td>{a.employee_name}</td>
                    <td className={shared.tableMuted}>{a.role || "—"}</td>
                    <td className={shared.tableMuted}>{a.start_date}</td>
                    <td className={shared.tableMuted}>{a.end_date || "—"}</td>
                    <td className={shared.tableMuted}>{formatCents(a.daily_rate_cents)}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        {!a.end_date && (
                          <button
                            type="button"
                            onClick={() => withWorking(() => api.endLaborAssignment(a.id), "Failed to end assignment.")}
                            disabled={working}
                            className={`${shared.btn} ${shared.btnSmall}`}
                          >
                            End
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {laborAssignments.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No labor assigned yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  withWorking(
                    () =>
                      api.createLaborAssignment({
                        employee: Number(laborForm.employee),
                        project: projectId,
                        role: laborForm.role,
                        start_date: laborForm.start_date,
                        daily_rate_cents: Math.round(Number(laborForm.daily_rate_cents || 0) * 100),
                      }),
                    "Failed to assign labor."
                  ).then(() => setLaborForm({ employee: "", role: "", start_date: "", daily_rate_cents: "" }));
                }}
                className={shared.formRow}
                style={{ marginTop: 12, flexWrap: "wrap" }}
              >
                <select required value={laborForm.employee} onChange={(e) => setLaborForm({ ...laborForm, employee: e.target.value })} className={shared.select}>
                  <option value="">Employee…</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </option>
                  ))}
                </select>
                <input placeholder="Role" value={laborForm.role} onChange={(e) => setLaborForm({ ...laborForm, role: e.target.value })} className={shared.input} style={{ maxWidth: 120 }} />
                <input type="date" required value={laborForm.start_date} onChange={(e) => setLaborForm({ ...laborForm, start_date: e.target.value })} className={shared.input} />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Daily rate"
                  value={laborForm.daily_rate_cents}
                  onChange={(e) => setLaborForm({ ...laborForm, daily_rate_cents: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 110 }}
                />
                <button type="submit" disabled={working || !laborForm.employee || !laborForm.start_date} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Assign labor
                </button>
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Site expenses</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {siteExpenses.map((e) => (
                  <tr key={e.id}>
                    <td>{e.expense_date}</td>
                    <td className={shared.tableMuted}>{e.category || "—"}</td>
                    <td className={shared.tableMuted}>{e.description || "—"}</td>
                    <td className={shared.tableMuted}>{formatCents(e.amount_cents)}</td>
                  </tr>
                ))}
                {siteExpenses.length === 0 && (
                  <tr>
                    <td colSpan={4} className={shared.tableMuted}>
                      No site expenses yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  withWorking(
                    () =>
                      api.createSiteExpense({
                        project: projectId,
                        category: expenseForm.category,
                        description: expenseForm.description,
                        amount_cents: Math.round(Number(expenseForm.amount_cents || 0) * 100),
                        expense_date: expenseForm.expense_date,
                      }),
                    "Failed to save expense."
                  ).then(() => setExpenseForm({ category: "", description: "", amount_cents: "", expense_date: "" }));
                }}
                className={shared.formRow}
                style={{ marginTop: 12, flexWrap: "wrap" }}
              >
                <input placeholder="Category" value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })} className={shared.input} style={{ maxWidth: 120 }} />
                <input
                  placeholder="Description"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className={shared.input}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={expenseForm.amount_cents}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount_cents: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 110 }}
                />
                <input type="date" required value={expenseForm.expense_date} onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} className={shared.input} />
                <button type="submit" disabled={working || !expenseForm.amount_cents || !expenseForm.expense_date} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Add expense
                </button>
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Change orders</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Requested</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {changeOrders.map((co) => (
                  <tr key={co.id}>
                    <td>{co.number}</td>
                    <td>{co.description}</td>
                    <td className={shared.tableMuted}>{formatCents(co.amount_cents)}</td>
                    <td className={shared.tableMuted}>{co.requested_date}</td>
                    <td>
                      <span className={`${shared.badge} ${CHANGE_ORDER_BADGES[co.status]}`}>{co.status}</span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        {co.status === "pending" && (
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => withWorking(() => api.approveChangeOrder(co.id), "Failed to approve change order.")}
                              disabled={working}
                              className={`${shared.btn} ${shared.btnSmall}`}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => withWorking(() => api.rejectChangeOrder(co.id), "Failed to reject change order.")}
                              disabled={working}
                              className={`${shared.btn} ${shared.btnSmall}`}
                            >
                              Reject
                            </button>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {changeOrders.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No change orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  withWorking(
                    () =>
                      api.createChangeOrder({
                        project: projectId,
                        description: changeOrderForm.description,
                        amount_cents: Math.round(Number(changeOrderForm.amount_cents || 0) * 100),
                        requested_date: changeOrderForm.requested_date,
                      }),
                    "Failed to save change order."
                  ).then(() => setChangeOrderForm({ description: "", amount_cents: "", requested_date: "" }));
                }}
                className={shared.formRow}
                style={{ marginTop: 12, flexWrap: "wrap" }}
              >
                <input
                  placeholder="Description"
                  required
                  value={changeOrderForm.description}
                  onChange={(e) => setChangeOrderForm({ ...changeOrderForm, description: e.target.value })}
                  className={shared.input}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount (+/-)"
                  value={changeOrderForm.amount_cents}
                  onChange={(e) => setChangeOrderForm({ ...changeOrderForm, amount_cents: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 130 }}
                />
                <input
                  type="date"
                  required
                  value={changeOrderForm.requested_date}
                  onChange={(e) => setChangeOrderForm({ ...changeOrderForm, requested_date: e.target.value })}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={working || !changeOrderForm.description || !changeOrderForm.amount_cents}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Request change order
                </button>
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Quality &amp; safety</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Detail</th>
                  <th>Result / Severity</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {qualityInspections.map((q) => (
                  <tr key={`qi-${q.id}`}>
                    <td>{q.inspection_date}</td>
                    <td className={shared.tableMuted}>Inspection</td>
                    <td className={shared.tableMuted}>{q.notes || "—"}</td>
                    <td>
                      <span className={`${shared.badge} ${QUALITY_BADGES[q.result]}`}>{q.result}</span>
                    </td>
                    <td className={shared.tableMuted}>{q.inspected_by_name || "—"}</td>
                  </tr>
                ))}
                {safetyIncidents.map((s) => (
                  <tr key={`si-${s.id}`}>
                    <td>{s.incident_date}</td>
                    <td className={shared.tableMuted}>Safety incident</td>
                    <td className={shared.tableMuted}>{s.description}</td>
                    <td>
                      <span className={`${shared.badge} ${SEVERITY_BADGES[s.severity]}`}>{s.severity}</span>
                    </td>
                    <td className={shared.tableMuted}>{s.reported_by_name || "—"}</td>
                  </tr>
                ))}
                {qualityInspections.length === 0 && safetyIncidents.length === 0 && (
                  <tr>
                    <td colSpan={5} className={shared.tableMuted}>
                      No quality inspections or safety incidents yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    withWorking(
                      () =>
                        api.createQualityInspection({
                          project: projectId,
                          inspected_by: qualityForm.inspected_by ? Number(qualityForm.inspected_by) : null,
                          inspection_date: qualityForm.inspection_date,
                          result: qualityForm.result,
                          notes: qualityForm.notes,
                        }),
                      "Failed to save quality inspection."
                    ).then(() => setQualityForm({ inspected_by: "", inspection_date: "", result: "pass", notes: "" }));
                  }}
                  className={shared.formRow}
                  style={{ marginTop: 12, flexWrap: "wrap" }}
                >
                  <input type="date" required value={qualityForm.inspection_date} onChange={(e) => setQualityForm({ ...qualityForm, inspection_date: e.target.value })} className={shared.input} />
                  <select value={qualityForm.result} onChange={(e) => setQualityForm({ ...qualityForm, result: e.target.value as QualityInspection["result"] })} className={shared.select}>
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                    <option value="conditional">Conditional pass</option>
                  </select>
                  <select value={qualityForm.inspected_by} onChange={(e) => setQualityForm({ ...qualityForm, inspected_by: e.target.value })} className={shared.select}>
                    <option value="">Inspected by…</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                      </option>
                    ))}
                  </select>
                  <input placeholder="Notes" value={qualityForm.notes} onChange={(e) => setQualityForm({ ...qualityForm, notes: e.target.value })} className={shared.input} />
                  <button type="submit" disabled={working || !qualityForm.inspection_date} className={`${shared.btn} ${shared.btnPrimary}`}>
                    Log inspection
                  </button>
                </form>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    withWorking(
                      () =>
                        api.createSafetyIncident({
                          project: projectId,
                          incident_date: safetyForm.incident_date,
                          description: safetyForm.description,
                          severity: safetyForm.severity,
                          reported_by: safetyForm.reported_by ? Number(safetyForm.reported_by) : null,
                          corrective_action: safetyForm.corrective_action,
                        }),
                      "Failed to save safety incident."
                    ).then(() =>
                      setSafetyForm({ incident_date: "", description: "", severity: "low", reported_by: "", corrective_action: "" })
                    );
                  }}
                  className={shared.formRow}
                  style={{ marginTop: 8, flexWrap: "wrap" }}
                >
                  <input type="date" required value={safetyForm.incident_date} onChange={(e) => setSafetyForm({ ...safetyForm, incident_date: e.target.value })} className={shared.input} />
                  <input
                    placeholder="Description"
                    required
                    value={safetyForm.description}
                    onChange={(e) => setSafetyForm({ ...safetyForm, description: e.target.value })}
                    className={shared.input}
                  />
                  <select value={safetyForm.severity} onChange={(e) => setSafetyForm({ ...safetyForm, severity: e.target.value as SafetyIncident["severity"] })} className={shared.select}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                  <select value={safetyForm.reported_by} onChange={(e) => setSafetyForm({ ...safetyForm, reported_by: e.target.value })} className={shared.select}>
                    <option value="">Reported by…</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Corrective action"
                    value={safetyForm.corrective_action}
                    onChange={(e) => setSafetyForm({ ...safetyForm, corrective_action: e.target.value })}
                    className={shared.input}
                  />
                  <button type="submit" disabled={working || !safetyForm.incident_date || !safetyForm.description} className={`${shared.btn} ${shared.btnPrimary}`}>
                    Log safety incident
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
