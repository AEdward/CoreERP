/** Flat, two-tone abstract app icons — same visual language as Odoo's
 * app launcher (colorful geometric marks, no icon-font dependency).
 * One component per module key; add a case here when a new module
 * gets a dashboard tile. */

import type { ReactNode } from "react";

const ICONS: Record<string, { a: string; b: string; render: (a: string, b: string) => ReactNode }> = {
  settings: {
    a: "#0891b2",
    b: "#f59e0b",
    render: (a, b) => (
      <>
        <rect x="6" y="6" width="26" height="26" rx="8" fill={a} transform="rotate(-12 19 19)" />
        <rect x="16" y="16" width="26" height="26" rx="8" fill={b} transform="rotate(18 29 29)" opacity="0.92" />
      </>
    ),
  },
  accounting: {
    a: "#7c3aed",
    b: "#eab308",
    render: (a, b) => (
      <>
        <rect x="8" y="24" width="8" height="16" rx="3" fill={a} />
        <rect x="20" y="14" width="8" height="26" rx="3" fill={b} />
        <rect x="32" y="20" width="8" height="20" rx="3" fill={a} opacity="0.75" />
      </>
    ),
  },
  hr: {
    a: "#e11d48",
    b: "#475569",
    render: (a, b) => (
      <>
        <circle cx="18" cy="16" r="10" fill={a} />
        <circle cx="30" cy="24" r="8" fill={b} opacity="0.9" />
      </>
    ),
  },
  sales: {
    a: "#0d9488",
    b: "#8b5cf6",
    render: (a, b) => (
      <>
        <path d="M24 6 L40 34 L8 34 Z" fill={a} opacity="0.9" />
        <circle cx="24" cy="28" r="9" fill={b} />
      </>
    ),
  },
  inventory: {
    a: "#2563eb",
    b: "#f97316",
    render: (a, b) => (
      <>
        <path d="M24 6 L42 16 L24 26 L6 16 Z" fill={a} />
        <path d="M6 16 L24 26 L24 42 L6 32 Z" fill={b} />
        <path d="M42 16 L24 26 L24 42 L42 32 Z" fill={a} opacity="0.65" />
      </>
    ),
  },
  procurement: {
    a: "#16a34a",
    b: "#0ea5e9",
    render: (a, b) => (
      <>
        <path
          d="M10 18 a14 14 0 0 1 24 -8 M34 8 v8 h-8"
          stroke={a}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M38 30 a14 14 0 0 1 -24 8 M14 40 v-8 h8"
          stroke={b}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </>
    ),
  },
};

export function ModuleIcon({ moduleKey, muted, size = 44 }: { moduleKey: string; muted?: boolean; size?: number }) {
  const icon = ICONS[moduleKey];
  if (!icon) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      style={{ filter: muted ? "grayscale(1)" : undefined, opacity: muted ? 0.45 : 1 }}
    >
      {icon.render(icon.a, icon.b)}
    </svg>
  );
}
