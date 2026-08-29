"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ModuleShell } from "@/components/ModuleShell";
import {
  api,
  ApiError,
  type DiagnosticOrder,
  type Item,
  type MedicalRecord,
  type MedicalStaff,
  type Patient,
  type Prescription,
  type Warehouse,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const DIAGNOSTIC_BADGES: Record<DiagnosticOrder["status"], string> = {
  ordered: shared.badgeInfo,
  in_progress: shared.badgeWarn,
  completed: shared.badgeSuccess,
  cancelled: shared.badgeDanger,
};

const PRESCRIPTION_BADGES: Record<Prescription["status"], string> = {
  active: shared.badgeWarn,
  filled: shared.badgeSuccess,
  cancelled: shared.badgeDanger,
};

export default function PatientChartPage() {
  const params = useParams<{ id: string }>();
  const patientId = Number(params.id);
  const { me, activeMembership, error: sessionError } = useSession();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [staff, setStaff] = useState<MedicalStaff[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [orders, setOrders] = useState<DiagnosticOrder[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [recordForm, setRecordForm] = useState({
    recorded_by: "",
    record_date: "",
    diagnosis: "",
    notes: "",
    blood_pressure: "",
    temperature_celsius: "",
    pulse_bpm: "",
    weight_kg: "",
  });
  const [orderForm, setOrderForm] = useState({
    doctor: "",
    type: "lab" as DiagnosticOrder["type"],
    test_name: "",
    ordered_date: "",
  });
  const [resultText, setResultText] = useState<Record<number, string>>({});
  const [rxForm, setRxForm] = useState({ doctor: "", prescribed_date: "", item: "", quantity: "1", dosage_instructions: "" });
  const [dispenseWarehouse, setDispenseWarehouse] = useState("");

  async function load() {
    try {
      const [p, s, i, w, r, o, rx] = await Promise.all([
        api.getPatient(patientId),
        api.listMedicalStaff(),
        api.listItems(),
        api.listWarehouses(),
        api.listMedicalRecords(patientId),
        api.listDiagnosticOrders(patientId),
        api.listPrescriptions(patientId),
      ]);
      setPatient(p);
      setStaff(s);
      setItems(i);
      setWarehouses(w);
      setRecords(r);
      setOrders(o);
      setPrescriptions(rx);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load patient chart.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id, patientId]);

  async function handleAddRecord(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setActionError(null);
    try {
      await api.createMedicalRecord({
        patient: patientId,
        recorded_by: Number(recordForm.recorded_by),
        record_date: recordForm.record_date,
        diagnosis: recordForm.diagnosis,
        notes: recordForm.notes,
        blood_pressure: recordForm.blood_pressure,
        temperature_celsius: recordForm.temperature_celsius || null,
        pulse_bpm: recordForm.pulse_bpm ? Number(recordForm.pulse_bpm) : null,
        weight_kg: recordForm.weight_kg || null,
      });
      setRecordForm({
        recorded_by: "",
        record_date: "",
        diagnosis: "",
        notes: "",
        blood_pressure: "",
        temperature_celsius: "",
        pulse_bpm: "",
        weight_kg: "",
      });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save medical record.");
    } finally {
      setWorking(false);
    }
  }

  async function handleAddOrder(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setActionError(null);
    try {
      await api.createDiagnosticOrder({
        patient: patientId,
        doctor: Number(orderForm.doctor),
        type: orderForm.type,
        test_name: orderForm.test_name,
        ordered_date: orderForm.ordered_date,
      });
      setOrderForm({ doctor: "", type: "lab", test_name: "", ordered_date: "" });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save diagnostic order.");
    } finally {
      setWorking(false);
    }
  }

  async function handleCompleteOrder(id: number) {
    setWorking(true);
    setActionError(null);
    try {
      await api.completeDiagnosticOrder(id, resultText[id] ?? "");
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to complete diagnostic order.");
    } finally {
      setWorking(false);
    }
  }

  async function handleCancelOrder(id: number) {
    setWorking(true);
    setActionError(null);
    try {
      await api.cancelDiagnosticOrder(id);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to cancel diagnostic order.");
    } finally {
      setWorking(false);
    }
  }

  async function handleAddPrescription(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setActionError(null);
    try {
      await api.createPrescription({
        patient: patientId,
        doctor: Number(rxForm.doctor),
        prescribed_date: rxForm.prescribed_date,
        lines: [
          {
            item: Number(rxForm.item),
            quantity: Number(rxForm.quantity),
            dosage_instructions: rxForm.dosage_instructions,
          },
        ],
      });
      setRxForm({ doctor: "", prescribed_date: "", item: "", quantity: "1", dosage_instructions: "" });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save prescription.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDispense(id: number) {
    if (!dispenseWarehouse) {
      setActionError("Choose a warehouse to dispense from first.");
      return;
    }
    setWorking(true);
    setActionError(null);
    try {
      await api.dispensePrescription(id, Number(dispenseWarehouse));
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to dispense prescription.");
    } finally {
      setWorking(false);
    }
  }

  async function handleCancelPrescription(id: number) {
    setWorking(true);
    setActionError(null);
    try {
      await api.cancelPrescription(id);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to cancel prescription.");
    } finally {
      setWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("healthcare.manage") ?? false;

  return (
    <ModuleShell moduleKey="healthcare" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>{patient?.name ?? "Patient chart"}</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
            <p className={shared.hint} style={{ marginTop: 4 }}>
              <Link href="/dashboard/healthcare">&larr; Back to patients</Link>
            </p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}
        {actionError && <p className={shared.errorText}>{actionError}</p>}

        {patient && (
          <div className={shared.section}>
            <div className={shared.card}>
              <div className={shared.formGrid}>
                <div>
                  <div className={shared.label}>Date of birth</div>
                  <div>{patient.date_of_birth || "—"}</div>
                </div>
                <div>
                  <div className={shared.label}>Gender</div>
                  <div>{patient.gender || "—"}</div>
                </div>
                <div>
                  <div className={shared.label}>Blood type</div>
                  <div>{patient.blood_type ? patient.blood_type.toUpperCase() : "—"}</div>
                </div>
                <div>
                  <div className={shared.label}>Allergies</div>
                  <div>{patient.allergies || "—"}</div>
                </div>
                <div>
                  <div className={shared.label}>Phone</div>
                  <div>{patient.phone || "—"}</div>
                </div>
                <div>
                  <div className={shared.label}>Emergency contact</div>
                  <div>
                    {patient.emergency_contact_name || "—"}
                    {patient.emergency_contact_phone ? ` (${patient.emergency_contact_phone})` : ""}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Medical history</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Recorded by</th>
                  <th>Diagnosis</th>
                  <th>Vitals</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>{r.record_date}</td>
                    <td className={shared.tableMuted}>{r.recorded_by_name}</td>
                    <td className={shared.tableMuted}>{r.diagnosis || "—"}</td>
                    <td className={shared.tableMuted}>
                      {[
                        r.blood_pressure && `BP ${r.blood_pressure}`,
                        r.temperature_celsius && `${r.temperature_celsius}°C`,
                        r.pulse_bpm && `${r.pulse_bpm} bpm`,
                        r.weight_kg && `${r.weight_kg} kg`,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                    <td className={shared.tableMuted}>{r.notes || "—"}</td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={5} className={shared.tableMuted}>
                      No medical records yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddRecord} className={shared.formRow} style={{ marginTop: 12, flexWrap: "wrap" }}>
                <select
                  required
                  value={recordForm.recorded_by}
                  onChange={(e) => setRecordForm({ ...recordForm, recorded_by: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Recorded by…</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  required
                  value={recordForm.record_date}
                  onChange={(e) => setRecordForm({ ...recordForm, record_date: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Diagnosis"
                  value={recordForm.diagnosis}
                  onChange={(e) => setRecordForm({ ...recordForm, diagnosis: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="BP e.g. 120/80"
                  value={recordForm.blood_pressure}
                  onChange={(e) => setRecordForm({ ...recordForm, blood_pressure: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 110 }}
                />
                <input
                  placeholder="Temp °C"
                  type="number"
                  step="0.1"
                  value={recordForm.temperature_celsius}
                  onChange={(e) => setRecordForm({ ...recordForm, temperature_celsius: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 90 }}
                />
                <input
                  placeholder="Pulse bpm"
                  type="number"
                  value={recordForm.pulse_bpm}
                  onChange={(e) => setRecordForm({ ...recordForm, pulse_bpm: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 90 }}
                />
                <input
                  placeholder="Weight kg"
                  type="number"
                  step="0.1"
                  value={recordForm.weight_kg}
                  onChange={(e) => setRecordForm({ ...recordForm, weight_kg: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 90 }}
                />
                <input
                  placeholder="Notes"
                  value={recordForm.notes}
                  onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={working || !recordForm.recorded_by || !recordForm.record_date}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Add record
                </button>
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Diagnostic orders</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Test</th>
                  <th>Doctor</th>
                  <th>Ordered</th>
                  <th>Result</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className={shared.tableMuted}>{o.type}</td>
                    <td>{o.test_name}</td>
                    <td className={shared.tableMuted}>{o.doctor_name}</td>
                    <td className={shared.tableMuted}>{o.ordered_date}</td>
                    <td className={shared.tableMuted}>{o.result_text || "—"}</td>
                    <td>
                      <span className={`${shared.badge} ${DIAGNOSTIC_BADGES[o.status]}`}>{o.status}</span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        {o.status !== "completed" && o.status !== "cancelled" && (
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            <input
                              placeholder="Result"
                              value={resultText[o.id] ?? ""}
                              onChange={(e) => setResultText({ ...resultText, [o.id]: e.target.value })}
                              className={shared.input}
                              style={{ maxWidth: 130 }}
                            />
                            <button
                              type="button"
                              onClick={() => handleCompleteOrder(o.id)}
                              disabled={working}
                              className={`${shared.btn} ${shared.btnSmall}`}
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelOrder(o.id)}
                              disabled={working}
                              className={`${shared.btn} ${shared.btnSmall}`}
                            >
                              Cancel
                            </button>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className={shared.tableMuted}>
                      No diagnostic orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddOrder} className={shared.formRow} style={{ marginTop: 12, flexWrap: "wrap" }}>
                <select
                  required
                  value={orderForm.doctor}
                  onChange={(e) => setOrderForm({ ...orderForm, doctor: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Doctor…</option>
                  {staff.filter((s) => s.role === "doctor").map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={orderForm.type}
                  onChange={(e) => setOrderForm({ ...orderForm, type: e.target.value as DiagnosticOrder["type"] })}
                  className={shared.select}
                >
                  <option value="lab">Laboratory</option>
                  <option value="imaging">Radiology / Imaging</option>
                </select>
                <input
                  placeholder="Test name"
                  required
                  value={orderForm.test_name}
                  onChange={(e) => setOrderForm({ ...orderForm, test_name: e.target.value })}
                  className={shared.input}
                />
                <input
                  type="date"
                  required
                  value={orderForm.ordered_date}
                  onChange={(e) => setOrderForm({ ...orderForm, ordered_date: e.target.value })}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={working || !orderForm.doctor || !orderForm.test_name || !orderForm.ordered_date}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Order test
                </button>
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Prescriptions</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Doctor</th>
                  <th>Date</th>
                  <th>Medications</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {prescriptions.map((rx) => (
                  <tr key={rx.id}>
                    <td>{rx.number}</td>
                    <td className={shared.tableMuted}>{rx.doctor_name}</td>
                    <td className={shared.tableMuted}>{rx.prescribed_date}</td>
                    <td className={shared.tableMuted}>
                      {rx.lines
                        .map((l) => `${l.quantity}x ${l.item_name}${l.dispensed ? " (dispensed)" : ""}`)
                        .join(", ")}
                    </td>
                    <td>
                      <span className={`${shared.badge} ${PRESCRIPTION_BADGES[rx.status]}`}>{rx.status}</span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        {rx.status === "active" && (
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleDispense(rx.id)}
                              disabled={working}
                              className={`${shared.btn} ${shared.btnSmall}`}
                            >
                              Dispense
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelPrescription(rx.id)}
                              disabled={working}
                              className={`${shared.btn} ${shared.btnSmall}`}
                            >
                              Cancel
                            </button>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {prescriptions.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No prescriptions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <>
                <div className={shared.field} style={{ marginTop: 12, maxWidth: 260 }}>
                  <label className={shared.label}>Dispense from warehouse</label>
                  <select
                    value={dispenseWarehouse}
                    onChange={(e) => setDispenseWarehouse(e.target.value)}
                    className={shared.select}
                  >
                    <option value="">Warehouse…</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <form onSubmit={handleAddPrescription} className={shared.formRow} style={{ marginTop: 12, flexWrap: "wrap" }}>
                  <select
                    required
                    value={rxForm.doctor}
                    onChange={(e) => setRxForm({ ...rxForm, doctor: e.target.value })}
                    className={shared.select}
                  >
                    <option value="">Doctor…</option>
                    {staff.filter((s) => s.role === "doctor").map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    required
                    value={rxForm.prescribed_date}
                    onChange={(e) => setRxForm({ ...rxForm, prescribed_date: e.target.value })}
                    className={shared.input}
                  />
                  <select
                    required
                    value={rxForm.item}
                    onChange={(e) => setRxForm({ ...rxForm, item: e.target.value })}
                    className={shared.select}
                  >
                    <option value="">Medication…</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={rxForm.quantity}
                    onChange={(e) => setRxForm({ ...rxForm, quantity: e.target.value })}
                    className={shared.input}
                    style={{ maxWidth: 80 }}
                  />
                  <input
                    placeholder="Dosage instructions"
                    value={rxForm.dosage_instructions}
                    onChange={(e) => setRxForm({ ...rxForm, dosage_instructions: e.target.value })}
                    className={shared.input}
                  />
                  <button
                    type="submit"
                    disabled={working || !rxForm.doctor || !rxForm.prescribed_date || !rxForm.item}
                    className={`${shared.btn} ${shared.btnPrimary}`}
                  >
                    Prescribe
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
