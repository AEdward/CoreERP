"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type RetailPromotion } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const EMPTY_FORM = {
  name: "",
  code: "",
  discount_type: "percent" as RetailPromotion["discount_type"],
  discount_value: "",
  end_date: "",
};

export default function PromotionsPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [promotions, setPromotions] = useState<RetailPromotion[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadAll() {
    try {
      setPromotions(await api.listRetailPromotions());
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load promotions.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    try {
      await api.createRetailPromotion({
        name: form.name,
        code: form.code,
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        end_date: form.end_date || null,
      });
      setForm(EMPTY_FORM);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save promotion.");
    } finally {
      setWorking(false);
    }
  }

  async function handleToggleActive(promotion: RetailPromotion) {
    setWorking(true);
    try {
      await api.updateRetailPromotion(promotion.id, { is_active: !promotion.is_active });
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to update promotion.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteRetailPromotion(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to delete promotion.");
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("retail.manage") ?? false;

  return (
    <ModuleShell moduleKey="retail" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Promotions</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.section}>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Discount</th>
                  <th>Active</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {promotions?.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className={shared.tableMuted}>
                      {p.discount_type === "percent" ? `${p.discount_value}%` : p.discount_value}
                    </td>
                    <td>
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => handleToggleActive(p)}
                          disabled={working}
                          className={`${shared.badge} ${p.is_active ? shared.badgeSuccess : ""}`}
                          style={{ border: "none", cursor: "pointer" }}
                        >
                          {p.is_active ? "Active" : "Inactive"}
                        </button>
                      ) : (
                        <span className={`${shared.badge} ${p.is_active ? shared.badgeSuccess : ""}`}>
                          {p.is_active ? "Active" : "Inactive"}
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDelete(p.id)} disabled={working} />
                      </td>
                    )}
                  </tr>
                ))}
                {promotions?.length === 0 && (
                  <tr>
                    <td colSpan={4} className={shared.tableMuted}>
                      No promotions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleCreate} className={shared.formRow} style={{ marginTop: 12 }}>
                <input
                  placeholder="Promotion name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={shared.input}
                />
                <select
                  value={form.discount_type}
                  onChange={(e) => setForm({ ...form, discount_type: e.target.value as RetailPromotion["discount_type"] })}
                  className={shared.select}
                >
                  <option value="percent">Percent off</option>
                  <option value="fixed">Fixed amount off</option>
                </select>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Value"
                  required
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 100 }}
                />
                <button
                  type="submit"
                  disabled={working || !form.name || !form.discount_value}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Add promotion
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
