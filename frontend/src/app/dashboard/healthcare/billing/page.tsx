"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type InsuranceProvider, type MedicalBill, type PatientInsurance, type Patient } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const BILL_BADGES: Record<MedicalBill["status"], string> = {
  pending: shared.badgeWarn,
  partially_paid: shared.badgeInfo,
  paid: shared.badgeSuccess,
};

export default function BillingPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [providers, setProviders] = useState<InsuranceProvider[]>([]);
  const [patientInsurances, setPatientInsurances] = useState<PatientInsurance[]>([]);
  const [bills, setBills] = useState<MedicalBill[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [providerForm, setProviderForm] = useState({ name: "", contact_phone: "", contact_email: "" });
  const [piForm, setPiForm] = useState({ patient: "", provider: "", policy_number: "", coverage_percent: "" });
  const [billForm, setBillForm] = useState({
    patient: "",
    patient_insurance: "",
    description: "",
    amount: "",
  });
  const [paymentAmounts, setPaymentAmounts] = useState<Record<number, string>>({});

  async function load() {
    try {
      const [pr, pi, b, p] = await Promise.all([
        api.listInsuranceProviders(),
        api.listPatientInsurances(),
        api.listMedicalBills(),
        api.listPatients(),
      ]);
      setProviders(pr);
      setPatientInsurances(pi);
      setBills(b);
      setPatients(p);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load billing data.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddProvider(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setActionError(null);
    try {
      await api.createInsuranceProvider(providerForm);
      setProviderForm({ name: "", contact_phone: "", contact_email: "" });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save insurance provider.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDeleteProvider(id: number) {
    try {
      await api.deleteInsuranceProvider(id);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete insurance provider.");
    }
  }

  async function handleAddPatientInsurance(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setActionError(null);
    try {
      await api.createPatientInsurance({
        patient: Number(piForm.patient),
        provider: Number(piForm.provider),
        policy_number: piForm.policy_number,
        coverage_percent: piForm.coverage_percent || "0",
      });
      setPiForm({ patient: "", provider: "", policy_number: "", coverage_percent: "" });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save patient insurance.");
    } finally {
      setWorking(false);
    }
  }

  async function handleAddBill(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setActionError(null);
    try {
      await api.createMedicalBill({
        patient: Number(billForm.patient),
        patient_insurance: billForm.patient_insurance ? Number(billForm.patient_insurance) : null,
        lines: [{ description: billForm.description, amount_cents: Math.round(Number(billForm.amount) * 100) }],
      });
      setBillForm({ patient: "", patient_insurance: "", description: "", amount: "" });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save bill.");
    } finally {
      setWorking(false);
    }
  }

  async function handleRecordPayment(id: number) {
    const amount = paymentAmounts[id];
    if (!amount) return;
    setWorking(true);
    setActionError(null);
    try {
      await api.recordMedicalBillPayment(id, Math.round(Number(amount) * 100));
      setPaymentAmounts({ ...paymentAmounts, [id]: "" });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to record payment.");
    } finally {
      setWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("healthcare.manage") ?? false;
  const patientInsurancesForForm = patientInsurances.filter((pi) => String(pi.patient) === billForm.patient);

  return (
    <ModuleShell moduleKey="healthcare" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Billing & Insurance</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}
        {actionError && <p className={shared.errorText}>{actionError}</p>}

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Insurance providers</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className={shared.tableMuted}>{p.contact_phone || "—"}</td>
                    <td className={shared.tableMuted}>{p.contact_email || "—"}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDeleteProvider(p.id)} disabled={working} />
                      </td>
                    )}
                  </tr>
                ))}
                {providers.length === 0 && (
                  <tr>
                    <td colSpan={4} className={shared.tableMuted}>
                      No insurance providers yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddProvider} className={shared.formRow} style={{ marginTop: 12 }}>
                <input
                  placeholder="Provider name"
                  required
                  value={providerForm.name}
                  onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Phone"
                  value={providerForm.contact_phone}
                  onChange={(e) => setProviderForm({ ...providerForm, contact_phone: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Email"
                  value={providerForm.contact_email}
                  onChange={(e) => setProviderForm({ ...providerForm, contact_email: e.target.value })}
                  className={shared.input}
                />
                <button type="submit" disabled={working || !providerForm.name} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Add provider
                </button>
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Patient insurance policies</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Provider</th>
                  <th>Policy #</th>
                  <th>Coverage</th>
                </tr>
              </thead>
              <tbody>
                {patientInsurances.map((pi) => (
                  <tr key={pi.id}>
                    <td>
                      <Link href={`/dashboard/healthcare/patients/${pi.patient}`}>{pi.patient_name}</Link>
                    </td>
                    <td className={shared.tableMuted}>{pi.provider_name}</td>
                    <td className={shared.tableMuted}>{pi.policy_number}</td>
                    <td className={shared.tableMuted}>{pi.coverage_percent}%</td>
                  </tr>
                ))}
                {patientInsurances.length === 0 && (
                  <tr>
                    <td colSpan={4} className={shared.tableMuted}>
                      No patient insurance policies yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddPatientInsurance} className={shared.formRow} style={{ marginTop: 12, flexWrap: "wrap" }}>
                <select
                  required
                  value={piForm.patient}
                  onChange={(e) => setPiForm({ ...piForm, patient: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Patient…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={piForm.provider}
                  onChange={(e) => setPiForm({ ...piForm, provider: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Provider…</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Policy #"
                  required
                  value={piForm.policy_number}
                  onChange={(e) => setPiForm({ ...piForm, policy_number: e.target.value })}
                  className={shared.input}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  placeholder="Coverage %"
                  value={piForm.coverage_percent}
                  onChange={(e) => setPiForm({ ...piForm, coverage_percent: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 110 }}
                />
                <button
                  type="submit"
                  disabled={working || !piForm.patient || !piForm.provider || !piForm.policy_number}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Add policy
                </button>
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Bills</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Patient</th>
                  <th>Subtotal</th>
                  <th>Insurance covered</th>
                  <th>Patient owed</th>
                  <th>Paid</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id}>
                    <td>{b.number}</td>
                    <td>
                      <Link href={`/dashboard/healthcare/patients/${b.patient}`}>{b.patient_name}</Link>
                    </td>
                    <td className={shared.tableMuted}>{formatCents(b.subtotal_cents)}</td>
                    <td className={shared.tableMuted}>{formatCents(b.insurance_covered_cents)}</td>
                    <td className={shared.tableMuted}>{formatCents(b.patient_owed_cents)}</td>
                    <td className={shared.tableMuted}>{formatCents(b.paid_amount_cents)}</td>
                    <td>
                      <span className={`${shared.badge} ${BILL_BADGES[b.status]}`}>{b.status.replace("_", " ")}</span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        {b.status !== "paid" && (
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="Amount"
                              value={paymentAmounts[b.id] ?? ""}
                              onChange={(e) => setPaymentAmounts({ ...paymentAmounts, [b.id]: e.target.value })}
                              className={shared.input}
                              style={{ maxWidth: 100 }}
                            />
                            <button
                              type="button"
                              onClick={() => handleRecordPayment(b.id)}
                              disabled={working || !paymentAmounts[b.id]}
                              className={`${shared.btn} ${shared.btnSmall}`}
                            >
                              Record payment
                            </button>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {bills.length === 0 && (
                  <tr>
                    <td colSpan={8} className={shared.tableMuted}>
                      No bills yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddBill} className={shared.formRow} style={{ marginTop: 12, flexWrap: "wrap" }}>
                <select
                  required
                  value={billForm.patient}
                  onChange={(e) => setBillForm({ ...billForm, patient: e.target.value, patient_insurance: "" })}
                  className={shared.select}
                >
                  <option value="">Patient…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  value={billForm.patient_insurance}
                  onChange={(e) => setBillForm({ ...billForm, patient_insurance: e.target.value })}
                  className={shared.select}
                >
                  <option value="">No insurance</option>
                  {patientInsurancesForForm.map((pi) => (
                    <option key={pi.id} value={pi.id}>
                      {pi.provider_name} ({pi.coverage_percent}%)
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Charge description"
                  required
                  value={billForm.description}
                  onChange={(e) => setBillForm({ ...billForm, description: e.target.value })}
                  className={shared.input}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Amount"
                  required
                  value={billForm.amount}
                  onChange={(e) => setBillForm({ ...billForm, amount: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 120 }}
                />
                <button
                  type="submit"
                  disabled={working || !billForm.patient || !billForm.description || !billForm.amount}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Create bill
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
