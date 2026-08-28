"use client";

import { useEffect, useMemo, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type Department, type Employee, type Position } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

interface TreeNode {
  employee: Employee;
  children: TreeNode[];
}

function buildTree(employees: Employee[]): TreeNode[] {
  const byId = new Map<number, TreeNode>(employees.map((e) => [e.id, { employee: e, children: [] }]));
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    const managerId = node.employee.manager;
    if (managerId && byId.has(managerId)) {
      byId.get(managerId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function OrgNode({
  node,
  positionTitle,
  departmentName,
}: {
  node: TreeNode;
  positionTitle: (id: number | null) => string;
  departmentName: (id: number | null) => string;
}) {
  const { employee, children } = node;
  return (
    <li style={{ textAlign: "center" }}>
      <div
        style={{
          display: "inline-block",
          padding: "8px 14px",
          borderRadius: 10,
          border: "1px solid var(--gray-200, #e5e7eb)",
          background: "var(--card-bg, #fff)",
          minWidth: 160,
        }}
      >
        <div style={{ fontWeight: 600 }}>
          {employee.first_name} {employee.last_name}
        </div>
        <div className={shared.tableMuted} style={{ fontSize: 12 }}>
          {positionTitle(employee.position)}
          {employee.department ? ` · ${departmentName(employee.department)}` : ""}
        </div>
      </div>
      {children.length > 0 && (
        <ul style={{ ...TREE_UL_STYLE, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--gray-200, #e5e7eb)" }}>
          {children.map((child) => (
            <OrgNode
              key={child.employee.id}
              node={child}
              positionTitle={positionTitle}
              departmentName={departmentName}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

const TREE_UL_STYLE: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  gap: 24,
  flexWrap: "wrap",
};

export default function OrgChartPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeMembership) return;
    (async () => {
      try {
        const [emps, poss, depts] = await Promise.all([
          api.listEmployees(),
          api.listPositions(),
          api.listDepartments(),
        ]);
        setEmployees(emps);
        setPositions(poss);
        setDepartments(depts);
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load the org chart.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  const tree = useMemo(() => buildTree(employees ?? []), [employees]);

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const positionTitle = (id: number | null) => positions?.find((p) => p.id === id)?.title ?? "—";
  const departmentName = (id: number | null) => departments?.find((d) => d.id === id)?.name ?? "";

  return (
    <ModuleShell moduleKey="hr" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Org Chart</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
            <p className={shared.hint} style={{ marginTop: 4 }}>
              <a href="/dashboard/hr">&larr; Back to HR</a>
            </p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}
        <p className={shared.hint} style={{ maxWidth: 700 }}>
          Built from each employee&apos;s manager, set on the Employees list (Edit &rarr; More
          details). Employees with no manager are shown at the top level.
        </p>
        <div className={shared.card} style={{ overflowX: "auto" }}>
          {employees === null ? (
            <p className={shared.hint}>Loading…</p>
          ) : tree.length === 0 ? (
            <p className={shared.tableMuted}>No employees yet.</p>
          ) : (
            <ul style={TREE_UL_STYLE}>
              {tree.map((node) => (
                <OrgNode key={node.employee.id} node={node} positionTitle={positionTitle} departmentName={departmentName} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </ModuleShell>
  );
}
