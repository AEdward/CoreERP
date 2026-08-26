"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { Modal } from "@/components/Modal";
import { RowActions } from "@/components/RowActions";
import { IconPlus } from "@/components/icons";
import { api, ApiError, type Customer } from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_FORM = {
  name: "",
  phone: "",
  email: "",
  type: "individual" as Customer["type"],
  address: "",
  id_type: "" as Customer["id_type"],
  id_number: "",
  nationality: "",
  id_expiry_date: "",
};

const TYPE_BADGE: Record<Customer["type"], string> = {
  individual: "badge-gray",
  business: "badge-gray",
  government: "badge-gray",
  vip: "badge-gold",
};

export default function GuestDirectoryPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [guests, setGuests] = useState<Customer[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [working, setWorking] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function loadAll() {
    try {
      setGuests(await api.listCustomers());
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load the guest directory.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    try {
      let payload: Partial<Customer> | FormData = form;
      if (idFile) {
        const fd = new FormData();
        Object.entries(form).forEach(([key, value]) => fd.append(key, value ?? ""));
        fd.append("id_document", idFile);
        payload = fd;
      }
      if (editingId) {
        await api.updateCustomer(editingId, payload);
      } else {
        await api.createCustomer(payload);
      }
      closeModal();
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save guest.");
    } finally {
      setWorking(false);
    }
  }

  function startAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIdFile(null);
    setShowModal(true);
  }

  function startEdit(g: Customer) {
    setEditingId(g.id);
    setIdFile(null);
    setForm({
      name: g.name,
      phone: g.phone,
      email: g.email,
      type: g.type,
      address: g.address,
      id_type: g.id_type,
      id_number: g.id_number,
      nationality: g.nationality,
      id_expiry_date: g.id_expiry_date ?? "",
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIdFile(null);
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteCustomer(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to delete guest.");
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  // The Customer catalog is gated by sales.*, not hotel.* — see
  // apps.roles.seed's note on Front Office Manager/Receptionist.
  const canManage = activeMembership?.permissions.includes("sales.manage") ?? false;
  const filtered = (guests ?? []).filter((g) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return g.name.toLowerCase().includes(q) || g.phone.includes(q) || g.email.toLowerCase().includes(q);
  });

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px 40px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 className="page-title">Guest Directory</h1>
            <p className="page-subtitle">Every guest who has ever stayed or been booked — contact details and ID registration.</p>
          </div>
          {canManage && (
            <button type="button" className="btn btn-primary" style={{ flexShrink: 0 }} onClick={startAdd}>
              <IconPlus size={16} />
              Add Guest
            </button>
          )}
        </div>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        <div className="panel" style={{ marginTop: 20 }}>
          <input
            className="field-input"
            placeholder="Search by name, phone, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 320, marginBottom: 16 }}
          />
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>ID</th>
                  <th>Registered</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 600 }}>{g.name}</td>
                    <td>
                      <span className={`badge ${TYPE_BADGE[g.type]}`}>{g.type}</span>
                    </td>
                    <td>{g.phone || "—"}</td>
                    <td>{g.email || "—"}</td>
                    <td>{g.id_type ? `${g.id_type.replace("_", " ")} — ${g.id_number}` : "—"}</td>
                    <td>
                      {g.is_registered ? (
                        <span className="badge badge-green">Yes</span>
                      ) : (
                        <span className="badge badge-red">No</span>
                      )}
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onEdit={() => startEdit(g)} onDelete={() => handleDelete(g.id)} disabled={working} />
                      </td>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={7}>No guests match this search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {canManage && showModal && (
          <Modal title={editingId ? "Edit guest" : "Add guest"} onClose={closeModal}>
            <form
              onSubmit={handleSave}
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}
            >
              <input
                className="field-input"
                placeholder="Name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <select
                className="field-select"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as Customer["type"] })}
              >
                <option value="individual">Individual</option>
                <option value="business">Business</option>
                <option value="government">Government</option>
                <option value="vip">VIP</option>
              </select>
              <input
                className="field-input"
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <input
                className="field-input"
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <input
                className="field-input"
                placeholder="Address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                style={{ gridColumn: "1 / -1" }}
              />
              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 10,
                  padding: 12,
                  background: "var(--brand-ivory)",
                  borderRadius: 8,
                }}
              >
                <div style={{ gridColumn: "1 / -1" }} className="page-subtitle">
                  ID registration (required before this guest can check in)
                </div>
                <select
                  className="field-select"
                  value={form.id_type}
                  onChange={(e) => setForm({ ...form, id_type: e.target.value as Customer["id_type"] })}
                >
                  <option value="">ID type…</option>
                  <option value="national_id">National ID</option>
                  <option value="passport">Passport</option>
                  <option value="driving_license">Driving License</option>
                </select>
                <input
                  className="field-input"
                  placeholder="ID number"
                  value={form.id_number}
                  onChange={(e) => setForm({ ...form, id_number: e.target.value })}
                />
                <input
                  className="field-input"
                  placeholder="Nationality"
                  value={form.nationality}
                  onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                />
                <input
                  className="field-input"
                  type="date"
                  value={form.id_expiry_date}
                  onChange={(e) => setForm({ ...form, id_expiry_date: e.target.value })}
                />
                <input
                  className="field-input"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
                  style={{ gridColumn: "1 / -1", padding: 7 }}
                />
                {editingId && guests?.find((g) => g.id === editingId)?.id_document && (
                  <a
                    href={guests.find((g) => g.id === editingId)?.id_document ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--brand-green)" }}
                  >
                    View current ID document
                  </a>
                )}
              </div>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={working || !form.name}>
                  {editingId ? "Save changes" : "Add guest"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}
      </main>
    </ModuleShell>
  );
}
