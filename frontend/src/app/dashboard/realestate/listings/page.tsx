"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type PropertyListing, type PropertyUnit } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const STATUS_BADGES: Record<PropertyListing["status"], string> = {
  active: shared.badgeSuccess,
  withdrawn: shared.badgeWarn,
  closed: shared.badgeDanger,
};

const EMPTY_FORM = { unit: "", listing_type: "sale" as PropertyListing["listing_type"], price_cents: "", listed_date: "" };

export default function ListingsPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [listings, setListings] = useState<PropertyListing[] | null>(null);
  const [units, setUnits] = useState<PropertyUnit[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadAll() {
    try {
      const [l, u] = await Promise.all([api.listPropertyListings(), api.listPropertyUnits()]);
      setListings(l);
      setUnits(u);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load listings.");
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
      await api.createPropertyListing({
        unit: Number(form.unit),
        listing_type: form.listing_type,
        price_cents: Math.round(Number(form.price_cents) * 100),
        listed_date: form.listed_date,
      });
      setForm(EMPTY_FORM);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save listing.");
    } finally {
      setWorking(false);
    }
  }

  async function handleWithdraw(listing: PropertyListing) {
    setWorking(true);
    try {
      await api.updatePropertyListing(listing.id, { status: "withdrawn" });
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to withdraw listing.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deletePropertyListing(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to delete listing.");
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
            <h1 className={shared.pageTitle}>Listings</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.section}>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Type</th>
                  <th>Price</th>
                  <th>Listed</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {listings?.map((l) => (
                  <tr key={l.id}>
                    <td>{l.unit_label}</td>
                    <td className={shared.tableMuted}>{l.listing_type === "sale" ? "For sale" : "For rent"}</td>
                    <td className={shared.tableMuted}>{formatCents(l.price_cents)}</td>
                    <td className={shared.tableMuted}>{l.listed_date}</td>
                    <td>
                      <span className={`${shared.badge} ${STATUS_BADGES[l.status]}`}>{l.status}</span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        {l.status === "active" && (
                          <button
                            type="button"
                            onClick={() => handleWithdraw(l)}
                            disabled={working}
                            className={`${shared.btn} ${shared.btnSmall}`}
                            style={{ marginRight: 6 }}
                          >
                            Withdraw
                          </button>
                        )}
                        <RowActions onDelete={() => handleDelete(l.id)} disabled={working} />
                      </td>
                    )}
                  </tr>
                ))}
                {listings?.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No listings yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleCreate} className={shared.formRow} style={{ marginTop: 12 }}>
                <select
                  required
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Unit…</option>
                  {units?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.building_name} — {u.unit_number}
                    </option>
                  ))}
                </select>
                <select
                  value={form.listing_type}
                  onChange={(e) => setForm({ ...form, listing_type: e.target.value as PropertyListing["listing_type"] })}
                  className={shared.select}
                >
                  <option value="sale">For sale</option>
                  <option value="rent">For rent</option>
                </select>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Price"
                  required
                  value={form.price_cents}
                  onChange={(e) => setForm({ ...form, price_cents: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 140 }}
                />
                <input
                  type="date"
                  required
                  value={form.listed_date}
                  onChange={(e) => setForm({ ...form, listed_date: e.target.value })}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={working || !form.unit || !form.price_cents || !form.listed_date}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Add listing
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
