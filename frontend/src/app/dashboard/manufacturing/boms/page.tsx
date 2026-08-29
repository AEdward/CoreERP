"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type BillOfMaterial, type Item, type WorkCenter } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

type LineDraft = { component_item: string; quantity_per_unit: string };
type ByproductDraft = { item: string; quantity_per_unit: string };
type OperationDraft = { work_center: string; name: string; duration_minutes: string };

const EMPTY_LINE: LineDraft = { component_item: "", quantity_per_unit: "1" };
const EMPTY_BYPRODUCT: ByproductDraft = { item: "", quantity_per_unit: "1" };
const EMPTY_OPERATION: OperationDraft = { work_center: "", name: "", duration_minutes: "0" };

export default function BOMsPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [boms, setBoms] = useState<BillOfMaterial[] | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [workCenters, setWorkCenters] = useState<WorkCenter[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [outputItem, setOutputItem] = useState("");
  const [name, setName] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ ...EMPTY_LINE }]);
  const [byproducts, setByproducts] = useState<ByproductDraft[]>([]);
  const [operations, setOperations] = useState<OperationDraft[]>([]);
  const [working, setWorking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [b, i, wc] = await Promise.all([api.listBOMs(), api.listItems(), api.listWorkCenters()]);
      setBoms(b);
      setItems(i);
      setWorkCenters(wc);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load bills of materials.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  function resetForm() {
    setOutputItem("");
    setName("");
    setLines([{ ...EMPTY_LINE }]);
    setByproducts([]);
    setOperations([]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setFormError(null);
    try {
      await api.createBOM({
        output_item: Number(outputItem),
        name,
        lines: lines
          .filter((l) => l.component_item)
          .map((l) => ({ component_item: Number(l.component_item), quantity_per_unit: Number(l.quantity_per_unit) || 1 })),
        byproducts: byproducts
          .filter((b) => b.item)
          .map((b) => ({ item: Number(b.item), quantity_per_unit: Number(b.quantity_per_unit) || 1 })),
        operations: operations
          .filter((o) => o.work_center && o.name)
          .map((o, i) => ({
            work_center: Number(o.work_center),
            name: o.name,
            sequence: (i + 1) * 10,
            duration_minutes: Number(o.duration_minutes) || 0,
          })),
      });
      resetForm();
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save bill of materials.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteBOM(id);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to delete bill of materials.");
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("manufacturing.manage") ?? false;

  return (
    <ModuleShell moduleKey="manufacturing" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Bills of Materials</h1>
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
                  <th>Output</th>
                  <th>Components</th>
                  <th>Byproducts</th>
                  <th>Operations</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {boms?.map((b) => (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                    <td className={shared.tableMuted}>{b.output_item_name}</td>
                    <td className={shared.tableMuted}>
                      {b.lines.map((l) => `${l.quantity_per_unit}x ${l.component_item_name}`).join(", ") || "—"}
                    </td>
                    <td className={shared.tableMuted}>
                      {b.byproducts.map((bp) => `${bp.quantity_per_unit}x ${bp.item_name}`).join(", ") || "—"}
                    </td>
                    <td className={shared.tableMuted}>
                      {b.operations.map((o) => o.name).join(" → ") || "—"}
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDelete(b.id)} disabled={working} />
                      </td>
                    )}
                  </tr>
                ))}
                {boms?.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No bills of materials yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {canManage && (
          <div className={shared.section}>
            <h2 className={shared.sectionTitle}>New bill of materials</h2>
            <div className={shared.card}>
              <form onSubmit={handleCreate}>
                <div className={shared.formRow}>
                  <select
                    required
                    value={outputItem}
                    onChange={(e) => setOutputItem(e.target.value)}
                    className={shared.select}
                  >
                    <option value="">Output item…</option>
                    {items?.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="BOM name (e.g. Standard)"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={shared.input}
                  />
                </div>

                <p className={shared.hint} style={{ marginTop: 16 }}>
                  Components (raw materials needed per 1 unit of output)
                </p>
                {lines.map((line, i) => (
                  <div key={i} className={shared.formRow} style={{ marginTop: 6 }}>
                    <select
                      value={line.component_item}
                      onChange={(e) => {
                        const next = [...lines];
                        next[i] = { ...next[i], component_item: e.target.value };
                        setLines(next);
                      }}
                      className={shared.select}
                    >
                      <option value="">Component item…</option>
                      {items?.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={line.quantity_per_unit}
                      onChange={(e) => {
                        const next = [...lines];
                        next[i] = { ...next[i], quantity_per_unit: e.target.value };
                        setLines(next);
                      }}
                      className={shared.input}
                      style={{ maxWidth: 100 }}
                    />
                    <button
                      type="button"
                      onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
                      className={`${shared.btn} ${shared.btnSmall}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setLines([...lines, { ...EMPTY_LINE }])}
                  className={`${shared.btn} ${shared.btnGhost} ${shared.btnSmall}`}
                  style={{ marginTop: 6 }}
                >
                  + Add component
                </button>

                <p className={shared.hint} style={{ marginTop: 16 }}>
                  Byproducts (secondary output received alongside the main item, optional)
                </p>
                {byproducts.map((bp, i) => (
                  <div key={i} className={shared.formRow} style={{ marginTop: 6 }}>
                    <select
                      value={bp.item}
                      onChange={(e) => {
                        const next = [...byproducts];
                        next[i] = { ...next[i], item: e.target.value };
                        setByproducts(next);
                      }}
                      className={shared.select}
                    >
                      <option value="">Byproduct item…</option>
                      {items?.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={bp.quantity_per_unit}
                      onChange={(e) => {
                        const next = [...byproducts];
                        next[i] = { ...next[i], quantity_per_unit: e.target.value };
                        setByproducts(next);
                      }}
                      className={shared.input}
                      style={{ maxWidth: 100 }}
                    />
                    <button
                      type="button"
                      onClick={() => setByproducts(byproducts.filter((_, idx) => idx !== i))}
                      className={`${shared.btn} ${shared.btnSmall}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setByproducts([...byproducts, { ...EMPTY_BYPRODUCT }])}
                  className={`${shared.btn} ${shared.btnGhost} ${shared.btnSmall}`}
                  style={{ marginTop: 6 }}
                >
                  + Add byproduct
                </button>

                <p className={shared.hint} style={{ marginTop: 16 }}>
                  Routing operations (steps a production order will auto-generate work orders for, optional)
                </p>
                {operations.map((op, i) => (
                  <div key={i} className={shared.formRow} style={{ marginTop: 6 }}>
                    <select
                      value={op.work_center}
                      onChange={(e) => {
                        const next = [...operations];
                        next[i] = { ...next[i], work_center: e.target.value };
                        setOperations(next);
                      }}
                      className={shared.select}
                    >
                      <option value="">Work center…</option>
                      {workCenters?.map((wc) => (
                        <option key={wc.id} value={wc.id}>
                          {wc.name}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="Operation (e.g. Assemble)"
                      value={op.name}
                      onChange={(e) => {
                        const next = [...operations];
                        next[i] = { ...next[i], name: e.target.value };
                        setOperations(next);
                      }}
                      className={shared.input}
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder="Minutes per unit"
                      value={op.duration_minutes}
                      onChange={(e) => {
                        const next = [...operations];
                        next[i] = { ...next[i], duration_minutes: e.target.value };
                        setOperations(next);
                      }}
                      className={shared.input}
                      style={{ maxWidth: 140 }}
                    />
                    <button
                      type="button"
                      onClick={() => setOperations(operations.filter((_, idx) => idx !== i))}
                      className={`${shared.btn} ${shared.btnSmall}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setOperations([...operations, { ...EMPTY_OPERATION }])}
                  className={`${shared.btn} ${shared.btnGhost} ${shared.btnSmall}`}
                  style={{ marginTop: 6 }}
                >
                  + Add operation
                </button>

                <div style={{ marginTop: 16 }}>
                  <button
                    type="submit"
                    disabled={working || !outputItem || !name || !lines.some((l) => l.component_item)}
                    className={`${shared.btn} ${shared.btnPrimary}`}
                  >
                    Save bill of materials
                  </button>
                </div>
                {formError && <p className={shared.errorText}>{formError}</p>}
              </form>
            </div>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
