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
  myprofile: {
    a: "#0ea5e9",
    b: "#1e293b",
    render: (a, b) => (
      <>
        <circle cx="24" cy="17" r="10" fill={a} />
        <path d="M8 42c0-9 7-16 16-16s16 7 16 16z" fill={b} opacity="0.9" />
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
  tasks: {
    a: "#4f46e5",
    b: "#10b981",
    render: (a, b) => (
      <>
        <rect x="8" y="6" width="26" height="34" rx="5" fill={a} opacity="0.9" />
        <path
          d="M15 24 l6 6 12 -14"
          stroke={b}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </>
    ),
  },
  calendar: {
    a: "#f43f5e",
    b: "#6366f1",
    render: (a, b) => (
      <>
        <rect x="6" y="10" width="36" height="30" rx="5" fill={b} opacity="0.9" />
        <rect x="6" y="10" width="36" height="9" rx="5" fill={a} />
        <rect x="14" y="24" width="8" height="8" rx="2" fill="white" opacity="0.9" />
        <rect x="26" y="24" width="8" height="8" rx="2" fill="white" opacity="0.55" />
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
  expenses: {
    a: "#0891b2",
    b: "#f59e0b",
    render: (a, b) => (
      <>
        <rect x="6" y="10" width="36" height="26" rx="5" fill={a} opacity="0.9" />
        <rect x="26" y="19" width="16" height="16" rx="8" fill="white" />
        <circle cx="34" cy="27" r="4" fill={b} />
      </>
    ),
  },
  // Section J: Hotel & Hospitality, ported from AEdward/MiranErp.
  hotel: {
    a: "#7c3aed",
    b: "#f59e0b",
    render: (a, b) => (
      <>
        <rect x="6" y="20" width="36" height="18" rx="4" fill={a} opacity="0.9" />
        <rect x="10" y="10" width="12" height="14" rx="3" fill={b} />
        <rect x="26" y="10" width="12" height="14" rx="3" fill={b} opacity="0.7" />
      </>
    ),
  },
  housekeeping: {
    a: "#0ea5e9",
    b: "#f472b6",
    render: (a, b) => (
      <>
        <circle cx="24" cy="24" r="16" fill={a} opacity="0.9" />
        <path d="M17 26 l5 5 10 -12" stroke={b} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ),
  },
  maintenance: {
    a: "#64748b",
    b: "#f59e0b",
    render: (a, b) => (
      <>
        <path
          d="M30 10 a8 8 0 1 0 6 14 l-4 -4 2 -6 6 -2 4 4 a8 8 0 0 0 -14 -6 z"
          fill={a}
        />
        <rect x="8" y="30" width="18" height="8" rx="4" fill={b} transform="rotate(-45 17 34)" />
      </>
    ),
  },
  conference: {
    a: "#0d9488",
    b: "#6366f1",
    render: (a, b) => (
      <>
        <circle cx="16" cy="16" r="7" fill={a} />
        <circle cx="32" cy="16" r="7" fill={b} opacity="0.85" />
        <rect x="8" y="26" width="32" height="12" rx="4" fill={a} opacity="0.6" />
      </>
    ),
  },
  gym: {
    a: "#dc2626",
    b: "#1e293b",
    render: (a, b) => (
      <>
        <rect x="6" y="20" width="8" height="8" rx="2" fill={b} />
        <rect x="34" y="20" width="8" height="8" rx="2" fill={b} />
        <rect x="14" y="22" width="20" height="4" rx="2" fill={a} />
      </>
    ),
  },
  laundry: {
    a: "#0891b2",
    b: "white",
    render: (a) => (
      <>
        <rect x="8" y="6" width="32" height="36" rx="6" fill={a} opacity="0.9" />
        <circle cx="24" cy="26" r="10" fill="white" opacity="0.9" />
        <circle cx="24" cy="26" r="5" fill={a} />
      </>
    ),
  },
  spa: {
    a: "#16a34a",
    b: "#0ea5e9",
    render: (a, b) => (
      <>
        <path d="M24 8 C10 16 10 32 24 40 C38 32 38 16 24 8 Z" fill={a} opacity="0.9" />
        <circle cx="24" cy="26" r="6" fill={b} opacity="0.85" />
      </>
    ),
  },
  loyalty: {
    a: "#eab308",
    b: "#e11d48",
    render: (a, b) => (
      <>
        <path
          d="M24 6 L29 18 L42 19 L32 27 L36 40 L24 33 L12 40 L16 27 L6 19 L19 18 Z"
          fill={a}
        />
        <circle cx="24" cy="24" r="5" fill={b} opacity="0.85" />
      </>
    ),
  },
  pos: {
    a: "#2563eb",
    b: "#f97316",
    render: (a, b) => (
      <>
        <rect x="8" y="14" width="32" height="20" rx="4" fill={a} opacity="0.9" />
        <rect x="14" y="20" width="20" height="4" rx="2" fill="white" opacity="0.85" />
        <circle cx="16" cy="40" r="3" fill={b} />
        <circle cx="32" cy="40" r="3" fill={b} />
      </>
    ),
  },
  manufacturing: {
    a: "#475569",
    b: "#f97316",
    render: (a, b) => (
      <>
        <path
          d="M24 10a14 14 0 0 1 13.6 10.7l4.4.9-1.4 5.8-4.4-.5a14 14 0 0 1-4.1 5.9l1.9 4-5.3 2.8-2.6-3.6a14 14 0 0 1-7 0l-2.6 3.6-5.3-2.8 1.9-4a14 14 0 0 1-4.1-5.9l-4.4.5-1.4-5.8 4.4-.9A14 14 0 0 1 24 10Z"
          fill={a}
        />
        <circle cx="24" cy="24" r="6.5" fill={b} />
      </>
    ),
  },
  realestate: {
    a: "#0f766e",
    b: "#fbbf24",
    render: (a, b) => (
      <>
        <rect x="10" y="14" width="16" height="26" fill={a} opacity="0.92" />
        <rect x="26" y="20" width="12" height="20" fill={a} opacity="0.7" />
        <rect x="14" y="18" width="3" height="3" fill="white" opacity="0.85" />
        <rect x="19" y="18" width="3" height="3" fill="white" opacity="0.85" />
        <rect x="14" y="24" width="3" height="3" fill="white" opacity="0.85" />
        <rect x="19" y="24" width="3" height="3" fill="white" opacity="0.85" />
        <rect x="14" y="30" width="3" height="3" fill="white" opacity="0.85" />
        <rect x="19" y="30" width="3" height="3" fill="white" opacity="0.85" />
        <rect x="29" y="24" width="3" height="3" fill="white" opacity="0.85" />
        <rect x="29" y="30" width="3" height="3" fill="white" opacity="0.85" />
        <rect x="17" y="35" width="5" height="5" fill={b} />
      </>
    ),
  },
  retail: {
    a: "#7c3aed",
    b: "#22c55e",
    render: (a, b) => (
      <>
        <path d="M14 16h20l-2 18a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3Z" fill={a} opacity="0.9" />
        <path
          d="M18 16v-2a6 6 0 0 1 12 0v2"
          fill="none"
          stroke={a}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <rect x="19" y="24" width="2.4" height="9" fill="white" opacity="0.9" />
        <rect x="22.5" y="24" width="1.2" height="9" fill="white" opacity="0.9" />
        <rect x="25" y="24" width="2.4" height="9" fill="white" opacity="0.9" />
        <rect x="28.5" y="24" width="1.2" height="9" fill="white" opacity="0.9" />
        <circle cx="33" cy="35" r="5" fill={b} />
      </>
    ),
  },
  healthcare: {
    a: "#dc2626",
    b: "#0891b2",
    render: (a, b) => (
      <>
        <circle cx="24" cy="24" r="17" fill={b} opacity="0.16" />
        <rect x="19" y="10" width="10" height="28" rx="2.5" fill={a} />
        <rect x="10" y="19" width="28" height="10" rx="2.5" fill={a} />
        <path
          d="M9 30h7l3-6 4 10 3-7 2 3h11"
          fill="none"
          stroke={b}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
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
