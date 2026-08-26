"use client";

// Small hand-drawn icon set for the dashboard shell — kept as plain inline
// SVGs (no icon library dependency) since the app only needs a dozen or so
// simple glyphs for the sidebar/topbar.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function IconGrid(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  );
}

export function IconBed(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2 18v-7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v7" />
      <path d="M2 18h20" />
      <path d="M6 9V6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v3" />
      <line x1="4" y1="18" x2="4" y2="21" />
      <line x1="20" y1="18" x2="20" y2="21" />
    </svg>
  );
}

export function IconCalendarCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <path d="M8 14l2.5 2.5L16 11" />
    </svg>
  );
}

export function IconBroom(props: IconProps) {
  return (
    <svg {...base(props)}>
      <line x1="13" y1="2" x2="7" y2="15" />
      <path d="M7 15l-4 7 9-3.5z" />
      <line x1="9" y1="10" x2="15" y2="10" />
    </svg>
  );
}

export function IconWrench(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

export function IconUtensils(props: IconProps) {
  return (
    <svg {...base(props)}>
      <line x1="4" y1="2" x2="4" y2="9" />
      <line x1="7" y1="2" x2="7" y2="9" />
      <line x1="10" y1="2" x2="10" y2="9" />
      <path d="M4 9c0 1.5 1.3 2.5 3 2.5s3-1 3-2.5" />
      <line x1="7" y1="11.5" x2="7" y2="22" />
      <path d="M17 2c-2 2-3 4-3 7s1 3 3 3v10" />
    </svg>
  );
}

export function IconMonitor(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

export function IconBox(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <line x1="12" y1="13" x2="12" y2="21" />
    </svg>
  );
}

export function IconTruck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="1" y="6" width="14" height="10" rx="1" />
      <path d="M15 9h4l3 4v3h-7z" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}

export function IconBanknote(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <line x1="6" y1="10" x2="6" y2="10.01" />
      <line x1="18" y1="14" x2="18" y2="14.01" />
    </svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M15.3 14.2c2.5.4 4.2 2.6 4.2 5.8" />
    </svg>
  );
}

export function IconTrendingUp(props: IconProps) {
  return (
    <svg {...base(props)}>
      <polyline points="3 17 9 11 13 15 21 6" />
      <polyline points="15 6 21 6 21 12" />
    </svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <svg {...base(props)}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function IconX(props: IconProps) {
  return (
    <svg {...base(props)}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function IconLogOut(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function IconIdCard(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <circle cx="8" cy="11" r="2.2" />
      <path d="M5 17c0-1.8 1.4-3 3-3s3 1.2 3 3" />
      <line x1="14" y1="9" x2="19" y2="9" />
      <line x1="14" y1="13" x2="19" y2="13" />
    </svg>
  );
}

export function IconMartini(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 4h16l-8 8-8-8z" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <line x1="8" y1="21" x2="16" y2="21" />
    </svg>
  );
}

export function IconWashingMachine(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="2" width="18" height="20" rx="2" />
      <circle cx="12" cy="13" r="5" />
      <circle cx="12" cy="13" r="2" />
      <line x1="7" y1="6" x2="7.01" y2="6" />
      <line x1="10" y1="6" x2="10.01" y2="6" />
    </svg>
  );
}

export function IconSparkles(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3v4" />
      <path d="M12 17v4" />
      <path d="M3 12h4" />
      <path d="M17 12h4" />
      <path d="M5.6 5.6l2.8 2.8" />
      <path d="M15.6 15.6l2.8 2.8" />
      <path d="M18.4 5.6l-2.8 2.8" />
      <path d="M8.4 15.6l-2.8 2.8" />
    </svg>
  );
}

export function IconCalendarEvent(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <circle cx="12" cy="15" r="2.2" />
    </svg>
  );
}

export function IconChartBar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <line x1="4" y1="20" x2="4" y2="10" />
      <line x1="10" y1="20" x2="10" y2="4" />
      <line x1="16" y1="20" x2="16" y2="13" />
      <line x1="3" y1="20" x2="21" y2="20" />
    </svg>
  );
}

export function IconUserCog(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="18" cy="17" r="2.2" />
      <line x1="18" y1="13.5" x2="18" y2="14.5" />
      <line x1="18" y1="19.5" x2="18" y2="20.5" />
      <line x1="21" y1="17" x2="20" y2="17" />
      <line x1="16" y1="17" x2="15" y2="17" />
    </svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function IconDumbbell(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 9v6" />
      <path d="M2 10v4" />
      <path d="M6 7v10" />
      <path d="M18 7v10" />
      <path d="M22 10v4" />
      <path d="M20 9v6" />
      <line x1="6" y1="12" x2="18" y2="12" />
    </svg>
  );
}

export function IconGift(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <rect x="4" y="12" width="16" height="9" rx="1" />
      <line x1="12" y1="8" x2="12" y2="21" />
      <path d="M12 8c-1.5-4-6-4-6-1.5S8.5 8 12 8z" />
      <path d="M12 8c1.5-4 6-4 6-1.5S15.5 8 12 8z" />
    </svg>
  );
}

export function IconBriefcase(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  );
}

export function IconGraduationCap(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2 9l10-5 10 5-10 5-10-5z" />
      <path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
      <path d="M22 9v6" />
    </svg>
  );
}

export function IconWallet(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconReceipt(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 3h14v18l-2.5-1.5L14 21l-2.5-1.5L9 21l-2.5-1.5L4 21V3z" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="12" y2="16" />
    </svg>
  );
}

export function IconPercent(props: IconProps) {
  return (
    <svg {...base(props)}>
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}

export function IconHandCoins(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="8" cy="8" r="3.5" />
      <path d="M14 6h3a2 2 0 0 1 2 2v0" />
      <path d="M2 18c2-3 5-4 7-4h5.5a1.5 1.5 0 0 1 0 3H10" />
      <path d="M12 14l6-2a1.8 1.8 0 0 1 1.5 3.2L14 18" />
    </svg>
  );
}

export function IconArrowLeft(props: IconProps) {
  return (
    <svg {...base(props)}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export function IconArrowDownCircle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="8 11 12 15 16 11" />
      <line x1="12" y1="7" x2="12" y2="15" />
    </svg>
  );
}

export function IconArrowUpCircle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="16 13 12 9 8 13" />
      <line x1="12" y1="9" x2="12" y2="17" />
    </svg>
  );
}

export function IconBuilding(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <line x1="8" y1="7" x2="8" y2="7.01" />
      <line x1="12" y1="7" x2="12" y2="7.01" />
      <line x1="16" y1="7" x2="16" y2="7.01" />
      <line x1="8" y1="11" x2="8" y2="11.01" />
      <line x1="12" y1="11" x2="12" y2="11.01" />
      <line x1="16" y1="11" x2="16" y2="11.01" />
      <line x1="8" y1="15" x2="8" y2="15.01" />
      <line x1="16" y1="15" x2="16" y2="15.01" />
      <path d="M10 21v-4h4v4" />
    </svg>
  );
}

export function IconTrendingDown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <polyline points="3 7 9 13 13 9 21 18" />
      <polyline points="15 18 21 18 21 12" />
    </svg>
  );
}

export function IconArrowLeftRight(props: IconProps) {
  return (
    <svg {...base(props)}>
      <polyline points="17 3 21 7 17 11" />
      <line x1="21" y1="7" x2="3" y2="7" />
      <polyline points="7 13 3 17 7 21" />
      <line x1="3" y1="17" x2="21" y2="17" />
    </svg>
  );
}

export function IconClipboardCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="5" y="4" width="14" height="18" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <polyline points="9 13 11 15 15 11" />
    </svg>
  );
}

export function IconTag(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 2 21 11l-9 9-9-9V4a2 2 0 0 1 2-2z" />
      <circle cx="7.5" cy="7.5" r="1" />
    </svg>
  );
}

export function IconRuler(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 16 16 3l5 5-13 13-5-5z" />
      <line x1="8" y1="8" x2="10" y2="10" />
      <line x1="11" y1="5" x2="13" y2="7" />
      <line x1="5" y1="11" x2="7" y2="13" />
    </svg>
  );
}

export function IconInbox(props: IconProps) {
  return (
    <svg {...base(props)}>
      <polyline points="4 12 8 12 10 15 14 15 16 12 20 12" />
      <path d="M5.5 5h13l2.5 7v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7z" />
    </svg>
  );
}

export function IconRotateCcw(props: IconProps) {
  return (
    <svg {...base(props)}>
      <polyline points="3 4 3 9 8 9" />
      <path d="M3.5 15a9 9 0 1 0 2-9.5L3 9" />
    </svg>
  );
}

export function IconHome(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

export function IconStar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.2 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  );
}

export function IconBell(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconClock(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}
