"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
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

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("sales.manage") ?? false;
  const customerName = (id: number) => customers?.find((c) => c.id === id)?.name ?? "—";
  const memberName = (id: number | null) => (id ? members?.find((m) => m.user_id === id)?.name ?? "—" : "—");
  const activeLeads = leads?.filter((l) => l.status !== "converted") ?? [];

  return (
    <main style={{ maxWidth: 1100, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <AppHeader activeMembership={activeMembership} />

      {!activeMembership ? (
        <p style={{ color: "#666" }}>
          Pick an active company on the <a href="/dashboard">dashboard</a> first.
        </p>
      ) : (
        <>
          <h1 style={{ fontSize: 20 }}>CRM pipeline — {activeMembership.company.name}</h1>
          <p style={{ color: "#666", fontSize: 13 }}>
            <a href="/dashboard/sales">&larr; Back to Sales</a>
          </p>
          {loadError && <p style={{ color: "crimson" }}>{loadError}</p>}

          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Leads
            </h2>
            <p style={{ fontSize: 12, color: "#999", maxWidth: 600 }}>
              Converting a lead creates a real Customer and a Prospecting-stage Opportunity in one
              step. A converted lead can&apos;t be converted again.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Name</th>
                  <th style={{ padding: "6px 4px" }}>Company</th>
                  <th style={{ padding: "6px 4px" }}>Source</th>
                  <th style={{ padding: "6px 4px" }}>Assigned to</th>
                  <th style={{ padding: "6px 4px" }}>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {activeLeads.map((l) => (
                  <tr key={l.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{l.name}</td>
                    <td style={{ padding: "6px 4px" }}>{l.company_name}</td>
                    <td style={{ padding: "6px 4px" }}>{l.source}</td>
                    <td style={{ padding: "6px 4px" }}>{l.assigned_to_name || "—"}</td>
                    <td style={{ padding: "6px 4px" }}>{l.status}</td>
                    {canManage && (
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        <span style={{ display: "inline-flex", gap: 6 }}>
                          <button
                            type="button"
                            disabled={leadWorking}
                            onClick={() => handleConvertLead(l.id)}
                            style={{ padding: "4px 10px" }}
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
                    <td colSpan={6} style={{ padding: "6px 4px", color: "#999" }}>
                      No open leads.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form
                onSubmit={handleAddLead}
                style={{
                  marginTop: 16,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 8,
                  maxWidth: 900,
                }}
              >
                <input
                  placeholder="Name"
                  required
                  value={leadForm.name}
                  onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Company"
                  value={leadForm.company_name}
                  onChange={(e) => setLeadForm({ ...leadForm, company_name: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Email"
                  type="email"
                  value={leadForm.email}
                  onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Phone"
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Source (e.g. Referral)"
                  value={leadForm.source}
                  onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}
                  style={{ padding: 8 }}
                />
                <select
                  value={leadForm.assigned_to}
                  onChange={(e) => setLeadForm({ ...leadForm, assigned_to: e.target.value })}
                  style={{ padding: 8 }}
                >
                  <option value="">Assigned to…</option>
                  {members?.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <button type="submit" disabled={leadWorking || !leadForm.name} style={{ padding: 8 }}>
                  Add lead
                </button>
                {leadError && (
                  <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{leadError}</p>
                )}
              </form>
            )}
          </section>

          <section style={{ marginTop: 40, marginBottom: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Opportunities
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Name</th>
                  <th style={{ padding: "6px 4px" }}>Customer</th>
                  <th style={{ padding: "6px 4px" }}>Stage</th>
                  <th style={{ padding: "6px 4px" }}>Amount</th>
                  <th style={{ padding: "6px 4px" }}>Expected close</th>
                  <th style={{ padding: "6px 4px" }}>Assigned to</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {opportunities?.map((o) => (
                  <tr key={o.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{o.name}</td>
                    <td style={{ padding: "6px 4px" }}>{customerName(o.customer)}</td>
                    <td style={{ padding: "6px 4px" }}>{STAGE_LABELS[o.stage]}</td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(o.amount_cents)}</td>
                    <td style={{ padding: "6px 4px" }}>{o.expected_close_date ?? "—"}</td>
                    <td style={{ padding: "6px 4px" }}>{memberName(o.assigned_to)}</td>
                    {canManage && (
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
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
                    <td colSpan={7} style={{ padding: "6px 4px", color: "#999" }}>
                      No opportunities yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form
                onSubmit={handleSubmitOpp}
                style={{
                  marginTop: 16,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 8,
                  maxWidth: 900,
                }}
              >
                <select
                  required
                  value={oppForm.customer}
                  onChange={(e) => setOppForm({ ...oppForm, customer: e.target.value })}
                  style={{ padding: 8 }}
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
                  style={{ padding: 8 }}
                />
                <select
                  value={oppForm.stage}
                  onChange={(e) => setOppForm({ ...oppForm, stage: e.target.value as Opportunity["stage"] })}
                  style={{ padding: 8 }}
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
                  style={{ padding: 8 }}
                />
                <input
                  type="date"
                  value={oppForm.expected_close_date}
                  onChange={(e) => setOppForm({ ...oppForm, expected_close_date: e.target.value })}
                  style={{ padding: 8 }}
                />
                <select
                  value={oppForm.assigned_to}
                  onChange={(e) => setOppForm({ ...oppForm, assigned_to: e.target.value })}
                  style={{ padding: 8 }}
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
                    style={{ padding: "8px 16px" }}
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
                      style={{ padding: "8px 16px" }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {oppError && (
                  <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{oppError}</p>
                )}
              </form>
            )}
          </section>

          <section style={{ marginTop: 40, marginBottom: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Contacts
            </h2>
            <select
              value={selectedCustomerId ?? ""}
              onChange={(e) => setSelectedCustomerId(e.target.value ? Number(e.target.value) : null)}
              style={{ padding: 8, marginTop: 8 }}
            >
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Name</th>
                  <th style={{ padding: "6px 4px" }}>Title</th>
                  <th style={{ padding: "6px 4px" }}>Email</th>
                  <th style={{ padding: "6px 4px" }}>Phone</th>
                  <th style={{ padding: "6px 4px" }}>Primary</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {contacts?.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{c.name}</td>
                    <td style={{ padding: "6px 4px" }}>{c.title}</td>
                    <td style={{ padding: "6px 4px" }}>{c.email}</td>
                    <td style={{ padding: "6px 4px" }}>{c.phone}</td>
                    <td style={{ padding: "6px 4px" }}>{c.is_primary ? "Yes" : ""}</td>
                    {canManage && (
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        <RowActions onDelete={() => handleDeleteContact(c.id)} disabled={contactWorking} />
                      </td>
                    )}
                  </tr>
                ))}
                {contacts?.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "6px 4px", color: "#999" }}>
                      No contacts for this customer yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && selectedCustomerId !== null && (
              <form
                onSubmit={handleAddContact}
                style={{
                  marginTop: 16,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 8,
                  maxWidth: 900,
                }}
              >
                <input
                  placeholder="Name"
                  required
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Title"
                  value={contactForm.title}
                  onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Email"
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Phone"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  style={{ padding: 8 }}
                />
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={contactForm.is_primary}
                    onChange={(e) => setContactForm({ ...contactForm, is_primary: e.target.checked })}
                  />
                  Primary contact
                </label>
                <button type="submit" disabled={contactWorking} style={{ padding: 8 }}>
                  Add contact
                </button>
                {contactError && (
                  <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{contactError}</p>
                )}
              </form>
            )}
          </section>
        </>
      )}
    </main>
  );
}
