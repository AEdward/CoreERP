"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import {
  api,
  ApiError,
  type CompanyMember,
  type Contact,
  type Customer,
  type Lead,
  type Opportunity,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const EMPTY_LEAD_FORM = { name: "", company_name: "", email: "", phone: "", source: "", assigned_to: "" };
const EMPTY_OPP_FORM = {
  customer: "",
  name: "",
  stage: "prospecting" as Opportunity["stage"],
  amount: "",
  expected_close_date: "",
  assigned_to: "",
};
const EMPTY_CONTACT_FORM = { name: "", title: "", email: "", phone: "", is_primary: false };

const STAGE_LABELS: Record<Opportunity["stage"], string> = {
  prospecting: "Prospecting",
  qualification: "Qualification",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const STAGE_BADGE: Record<Opportunity["stage"], string> = {
  prospecting: "badgeInfo",
  qualification: "badgeInfo",
  proposal: "badgeWarn",
  negotiation: "badgeWarn",
  won: "badgeSuccess",
  lost: "badgeDanger",
};

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function CrmPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[] | null>(null);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [members, setMembers] = useState<CompanyMember[] | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [leadForm, setLeadForm] = useState(EMPTY_LEAD_FORM);
  const [leadWorking, setLeadWorking] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);

  const [oppForm, setOppForm] = useState(EMPTY_OPP_FORM);
  const [oppWorking, setOppWorking] = useState(false);
  const [oppError, setOppError] = useState<string | null>(null);
  const [editingOppId, setEditingOppId] = useState<number | null>(null);

  const [contactForm, setContactForm] = useState(EMPTY_CONTACT_FORM);
  const [contactWorking, setContactWorking] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [l, o, c, m] = await Promise.all([
        api.listLeads(),
        api.listOpportunities(),
        api.listCustomers(),
        api.listCompanyMembers(),
      ]);
      setLeads(l);
      setOpportunities(o);
      setCustomers(c);
      setMembers(m);
      if (selectedCustomerId === null && c.length > 0) setSelectedCustomerId(c[0].id);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load CRM data.");
    }
  }

  async function loadContacts(customerId: number) {
    try {
      setContacts(await api.listContacts(customerId));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load contacts.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  useEffect(() => {
    if (selectedCustomerId !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadContacts(selectedCustomerId);
    }
  }, [selectedCustomerId]);

  async function handleAddLead(e: React.FormEvent) {
    e.preventDefault();
    setLeadWorking(true);
    setLeadError(null);
    try {
      await api.createLead({
        name: leadForm.name,
        company_name: leadForm.company_name,
        email: leadForm.email,
        phone: leadForm.phone,
        source: leadForm.source,
        assigned_to: leadForm.assigned_to ? Number(leadForm.assigned_to) : null,
      });
      setLeadForm(EMPTY_LEAD_FORM);
      await loadAll();
    } catch (err) {
      setLeadError(err instanceof ApiError ? err.message : "Failed to add lead.");
    } finally {
      setLeadWorking(false);
    }
  }

  async function handleConvertLead(id: number) {
    setLeadWorking(true);
    setLeadError(null);
    try {
      await api.convertLead(id);
      await loadAll();
    } catch (err) {
      setLeadError(err instanceof ApiError ? err.message : "Failed to convert lead.");
    } finally {
      setLeadWorking(false);
    }
  }

  async function handleDeleteLead(id: number) {
    try {
      await api.deleteLead(id);
      await loadAll();
    } catch (err) {
      setLeadError(err instanceof ApiError ? err.message : "Failed to delete lead.");
    }
  }

  async function handleSubmitOpp(e: React.FormEvent) {
    e.preventDefault();
    setOppWorking(true);
    setOppError(null);
    try {
      const payload = {
        customer: Number(oppForm.customer),
        name: oppForm.name,
        stage: oppForm.stage,
        amount_cents: Math.round(Number(oppForm.amount || 0) * 100),
        expected_close_date: oppForm.expected_close_date || null,
        assigned_to: oppForm.assigned_to ? Number(oppForm.assigned_to) : null,
      };
      if (editingOppId) {
        await api.updateOpportunity(editingOppId, payload);
      } else {
        await api.createOpportunity(payload);
      }
      setOppForm(EMPTY_OPP_FORM);
      setEditingOppId(null);
      await loadAll();
    } catch (err) {
      setOppError(err instanceof ApiError ? err.message : "Failed to save opportunity.");
    } finally {
      setOppWorking(false);
    }
  }

  function startEditOpp(o: Opportunity) {
    setEditingOppId(o.id);
    setOppForm({
      customer: String(o.customer),
      name: o.name,
      stage: o.stage,
      amount: (o.amount_cents / 100).toString(),
      expected_close_date: o.expected_close_date ?? "",
      assigned_to: o.assigned_to ? String(o.assigned_to) : "",
    });
  }

  async function handleDeleteOpp(id: number) {
    try {
      await api.deleteOpportunity(id);
      await loadAll();
    } catch (err) {
      setOppError(err instanceof ApiError ? err.message : "Failed to delete opportunity.");
    }
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (selectedCustomerId === null) return;
    setContactWorking(true);
    setContactError(null);
    try {
      await api.createContact({ customer: selectedCustomerId, ...contactForm });
      setContactForm(EMPTY_CONTACT_FORM);
      await loadContacts(selectedCustomerId);
    } catch (err) {
      setContactError(err instanceof ApiError ? err.message : "Failed to add contact.");
    } finally {
      setContactWorking(false);
    }
  }

  async function handleDeleteContact(id: number) {
    try {
      await api.deleteContact(id);
      if (selectedCustomerId !== null) await loadContacts(selectedCustomerId);
    } catch (err) {
      setContactError(err instanceof ApiError ? err.message : "Failed to delete contact.");
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("sales.manage") ?? false;
  const customerName = (id: number) => customers?.find((c) => c.id === id)?.name ?? "—";
  const memberName = (id: number | null) => (id ? members?.find((m) => m.user_id === id)?.name ?? "—" : "—");
  const activeLeads = leads?.filter((l) => l.status !== "converted") ?? [];

  return (
    <ModuleShell moduleKey="sales" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>CRM pipeline</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
          <div className={shared.pageActions}>
            <a href="/dashboard/sales" className={shared.btn}>
              &larr; Back to Sales
            </a>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Leads</h2>
          <div className={shared.card}>
            <p className={shared.hint} style={{ maxWidth: 600, marginBottom: 12 }}>
              Converting a lead creates a real Customer and a Prospecting-stage Opportunity in one
              step. A converted lead can&apos;t be converted again.
            </p>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Source</th>
                  <th>Assigned to</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {activeLeads.map((l) => (
                  <tr key={l.id}>
                    <td>{l.name}</td>
                    <td>{l.company_name}</td>
                    <td>{l.source}</td>
                    <td>{l.assigned_to_name || "—"}</td>
                    <td>{l.status}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <span style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            type="button"
                            disabled={leadWorking}
                            onClick={() => handleConvertLead(l.id)}
                            className={`${shared.btn} ${shared.btnSmall}`}
                          >
                            Convert
                          </button>
                          <RowActions onDelete={() => handleDeleteLead(l.id)} disabled={leadWorking} />
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
                {activeLeads.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No open leads.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form onSubmit={handleAddLead} className={shared.formGrid} style={{ marginTop: 16 }}>
                <input
                  placeholder="Name"
                  required
                  value={leadForm.name}
                  onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Company"
                  value={leadForm.company_name}
                  onChange={(e) => setLeadForm({ ...leadForm, company_name: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Email"
                  type="email"
                  value={leadForm.email}
                  onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Phone"
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Source (e.g. Referral)"
                  value={leadForm.source}
                  onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}
                  className={shared.input}
                />
                <select
                  value={leadForm.assigned_to}
                  onChange={(e) => setLeadForm({ ...leadForm, assigned_to: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Assigned to…</option>
                  {members?.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={leadWorking || !leadForm.name}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Add lead
                </button>
                {leadError && (
                  <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                    {leadError}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Opportunities</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Customer</th>
                  <th>Stage</th>
                  <th>Amount</th>
                  <th>Expected close</th>
                  <th>Assigned to</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {opportunities?.map((o) => (
                  <tr key={o.id}>
                    <td>{o.name}</td>
                    <td>{customerName(o.customer)}</td>
                    <td>
                      <span className={`${shared.badge} ${shared[STAGE_BADGE[o.stage]]}`}>
                        {STAGE_LABELS[o.stage]}
                      </span>
                    </td>
                    <td>{formatCents(o.amount_cents)}</td>
                    <td>{o.expected_close_date ?? "—"}</td>
                    <td>{memberName(o.assigned_to)}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions
                          onEdit={() => startEditOpp(o)}
                          onDelete={() => handleDeleteOpp(o.id)}
                          disabled={oppWorking}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {opportunities?.length === 0 && (
                  <tr>
                    <td colSpan={7} className={shared.tableMuted}>
                      No opportunities yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form onSubmit={handleSubmitOpp} className={shared.formGrid} style={{ marginTop: 16 }}>
                <select
                  required
                  value={oppForm.customer}
                  onChange={(e) => setOppForm({ ...oppForm, customer: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Customer…</option>
                  {customers?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Opportunity name"
                  required
                  value={oppForm.name}
                  onChange={(e) => setOppForm({ ...oppForm, name: e.target.value })}
                  className={shared.input}
                />
                <select
                  value={oppForm.stage}
                  onChange={(e) => setOppForm({ ...oppForm, stage: e.target.value as Opportunity["stage"] })}
                  className={shared.select}
                >
                  {Object.entries(STAGE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Amount"
                  type="number"
                  step="0.01"
                  value={oppForm.amount}
                  onChange={(e) => setOppForm({ ...oppForm, amount: e.target.value })}
                  className={shared.input}
                />
                <input
                  type="date"
                  value={oppForm.expected_close_date}
                  onChange={(e) => setOppForm({ ...oppForm, expected_close_date: e.target.value })}
                  className={shared.input}
                />
                <select
                  value={oppForm.assigned_to}
                  onChange={(e) => setOppForm({ ...oppForm, assigned_to: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Assigned to…</option>
                  {members?.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                  <button
                    type="submit"
                    disabled={oppWorking || !oppForm.customer || !oppForm.name}
                    className={`${shared.btn} ${shared.btnPrimary}`}
                  >
                    {editingOppId ? "Save changes" : "Add opportunity"}
                  </button>
                  {editingOppId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingOppId(null);
                        setOppForm(EMPTY_OPP_FORM);
                      }}
                      className={shared.btn}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {oppError && (
                  <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                    {oppError}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Contacts</h2>
          <div className={shared.card}>
            <select
              value={selectedCustomerId ?? ""}
              onChange={(e) => setSelectedCustomerId(e.target.value ? Number(e.target.value) : null)}
              className={shared.select}
            >
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <table className={shared.table} style={{ marginTop: 16 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Primary</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {contacts?.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.title}</td>
                    <td>{c.email}</td>
                    <td>{c.phone}</td>
                    <td>{c.is_primary ? "Yes" : ""}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDeleteContact(c.id)} disabled={contactWorking} />
                      </td>
                    )}
                  </tr>
                ))}
                {contacts?.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No contacts for this customer yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && selectedCustomerId !== null && (
              <form onSubmit={handleAddContact} className={shared.formGrid} style={{ marginTop: 16 }}>
                <input
                  placeholder="Name"
                  required
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Title"
                  value={contactForm.title}
                  onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Email"
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Phone"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className={shared.input}
                />
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={contactForm.is_primary}
                    onChange={(e) => setContactForm({ ...contactForm, is_primary: e.target.checked })}
                  />
                  Primary contact
                </label>
                <button
                  type="submit"
                  disabled={contactWorking}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Add contact
                </button>
                {contactError && (
                  <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                    {contactError}
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
