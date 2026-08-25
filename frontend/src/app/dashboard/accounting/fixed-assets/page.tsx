"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type FixedAsset } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const EMPTY_FORM = {
  name: "",
  category: "",
  purchase_date: "",
  cost: "",
  salvage_value: "",
  useful_life_months: "",
};

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function FixedAssetsPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [assets, setAssets] = useState<FixedAsset[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [depreciatingId, setDepreciatingId] = useState<number | null>(null);

  async function loadAll() {
    try {
      const a = await api.listFixedAssets();
      setAssets(a);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load fixed assets.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        category: form.category,
        purchase_date: form.purchase_date,
        cost_cents: Math.round(Number(form.cost || 0) * 100),
        salvage_value_cents: Math.round(Number(form.salvage_value || 0) * 100),
        useful_life_months: Number(form.useful_life_months),
      };
      if (editingId) {
        await api.updateFixedAsset(editingId, payload);
      } else {
        await api.createFixedAsset(payload);
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save fixed asset.");
    } finally {
      setWorking(false);
    }
  }

  function startEdit(a: FixedAsset) {
    setEditingId(a.id);
    setForm({
      name: a.name,
      category: a.category,
      purchase_date: a.purchase_date,
      cost: (a.cost_cents / 100).toString(),
      salvage_value: (a.salvage_value_cents / 100).toString(),
      useful_life_months: String(a.useful_life_months),
    });
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteFixedAsset(id);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete fixed asset.");
    }
  }

  async function handleDepreciate(id: number) {
    setDepreciatingId(id);
    setError(null);
    try {
      await api.depreciateFixedAsset(id);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to run depreciation.");
    } finally {
      setDepreciatingId(null);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("accounting.manage") ?? false;

  return (
    <ModuleShell moduleKey="accounting" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Fixed assets</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        <p className={shared.hint} style={{ marginBottom: 12 }}>
          Straight-line depreciation only. Click &quot;Run depreciation&quot; once per calendar
          month per asset to post that month&apos;s Depreciation Expense.
        </p>
        {loadError && <p className={shared.errorText}>{loadError}</p>}
        {error && <p className={shared.errorText}>{error}</p>}

        <div className={shared.card}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Cost</th>
                <th>Accum. depreciation</th>
                <th>Book value</th>
                <th>Status</th>
                <th></th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {assets?.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.category}</td>
                  <td>{formatCents(a.cost_cents)}</td>
                  <td>{formatCents(a.accumulated_depreciation_cents)}</td>
                  <td>{formatCents(a.book_value_cents)}</td>
                  <td>
                    <span
                      className={`${shared.badge} ${a.status === "active" ? shared.badgeSuccess : shared.badgeInfo}`}
                    >
                      {a.status === "active" ? "Active" : "Disposed"}
                    </span>
                  </td>
                  <td>
                    {a.status === "active" && a.book_value_cents > a.salvage_value_cents && (
                      <button
                        type="button"
                        disabled={depreciatingId === a.id}
                        onClick={() => handleDepreciate(a.id)}
                        className={`${shared.btn} ${shared.btnSmall}`}
                      >
                        Run depreciation
                      </button>
                    )}
                  </td>
                  {canManage && (
                    <td style={{ textAlign: "right" }}>
                      <RowActions
                        onEdit={() => startEdit(a)}
                        onDelete={() => handleDelete(a.id)}
                        disabled={working}
                      />
                    </td>
                  )}
                </tr>
              ))}
              {assets?.length === 0 && (
                <tr>
                  <td colSpan={8} className={shared.tableMuted}>
                    No fixed assets yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {canManage && (
            <form onSubmit={handleSubmit} className={shared.formGrid} style={{ marginTop: 16 }}>
              <input
                placeholder="Name (e.g. Delivery van)"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={shared.input}
              />
              <input
                placeholder="Category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={shared.input}
              />
              <input
                type="date"
                required
                value={form.purchase_date}
                onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                className={shared.input}
              />
              <input
                placeholder="Cost"
                type="number"
                step="0.01"
                required
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                className={shared.input}
              />
              <input
                placeholder="Salvage value"
                type="number"
                step="0.01"
                value={form.salvage_value}
                onChange={(e) => setForm({ ...form, salvage_value: e.target.value })}
                className={shared.input}
              />
              <input
                placeholder="Useful life (months)"
                type="number"
                required
                value={form.useful_life_months}
                onChange={(e) => setForm({ ...form, useful_life_months: e.target.value })}
                className={shared.input}
              />
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                <button
                  type="submit"
                  disabled={working || !form.name || !form.purchase_date}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  {editingId ? "Save changes" : "Add fixed asset"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setForm(EMPTY_FORM);
                    }}
                    className={shared.btn}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </ModuleShell>
  );
}
