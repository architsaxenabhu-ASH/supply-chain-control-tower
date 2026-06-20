import type { ComponentType } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  Boxes,
  BrainCircuit,
  ClipboardCheck,
  ClipboardList,
  Compass,
  FileSpreadsheet,
  FileUp,
  Banknote,
  CalendarRange,
  Gauge,
  GitBranch,
  Globe2,
  HandCoins,
  Handshake,
  History,
  Inbox,
  LayoutDashboard,
  PackageOpen,
  PlaneLanding,
  RotateCcw,
  LineChart,
  Package,
  RadioTower,
  Rocket,
  ScanText,
  ScrollText,
  Send,
  Settings2,
  ShieldCheck,
  Ship,
  Stamp,
  TrendingUp,
  Truck,
  Upload,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";

import type { ApiAuthenticatedUser } from "../lib/api";
import type { Signature } from "../motion/motion";

// Workspace navigation registry. Single source of truth for the platform's
// information architecture. Permissions (never role names) drive visibility;
// Admin bypasses everything. Adding a screen = one tab entry here + its render
// branch in App.tsx.
//
// Phase 7B — the platform is organised around how users THINK, not by module or
// department. There are exactly four top-level tabs, each answering one
// question:
//
//   Overview    — "What is happening?"            (live observation, leadership)
//   Management  — "Why is it happening?"          (analysis & intelligence)
//   Operations  — "What work needs to be done?"   (execute business processes)
//   My Work     — "What do I personally need to do?" (personal, email-driven)
//
// Every existing workspace lives under exactly one of these four. Within a tab,
// workspaces may carry an optional `group` label (e.g. Governance) to cluster
// related screens.

export type SectionId = "overview" | "management" | "operations" | "mywork";

export const SECTIONS: { id: SectionId; label: string; icon: NavIcon; question: string }[] = [
  { id: "overview", label: "Overview", icon: RadioTower, question: "What is happening?" },
  { id: "management", label: "Management", icon: LineChart, question: "Why is it happening?" },
  { id: "operations", label: "Operations", icon: Boxes, question: "What work needs to be done?" },
  { id: "mywork", label: "My Work", icon: Inbox, question: "What do I personally need to do?" },
];

export type NavIcon = ComponentType<{
  size?: number;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

export type TabDef = {
  id: string;
  label: string;
  icon: NavIcon;
  signature: Signature;
  /** Any-of permission list. Omitted = open to every signed-in user. */
  permissions?: string[];
};

export type WorkspaceDef = {
  id: string;
  label: string;
  icon: NavIcon;
  section: SectionId;
  /** Optional sub-cluster within a tab, e.g. "Governance" inside Operations. */
  group?: string;
  tabs: TabDef[];
};

// Permission bundles reused across the flow workspaces.
const PRIMARY_PERMS = ["import_approval", "goods_receipt", "shipment_approval"];
const INVENTORY_PERMS = ["goods_receipt", "inventory_approval", "inventory_value", "expiry_review"];
const SECONDARY_PERMS = ["shipment_request", "shipment_approval", "dispatch", "customer_read"];

export const WORKSPACES: WorkspaceDef[] = [
  // ============================= OVERVIEW =============================
  // "What is happening?" — Executive Live Operations Center (Phase 7A),
  // observe-only, for leadership. Three live maps answering: what's entering,
  // what we hold, what's leaving. Gated by `executive_view` (Board / CEO / MD /
  // GM; Admin sees all).
  {
    id: "exec-live",
    label: "Live Center",
    icon: RadioTower,
    section: "overview",
    tabs: [
      // One page; Primary / Inventory / Secondary are MODES switched inside it.
      { id: "exec-overview", label: "Live Center", icon: RadioTower, signature: "glide", permissions: ["executive_view"] },
    ],
  },
  // Executive Summary — a SEPARATE "Mission Control" page that rolls the three
  // operating screens into one Bloomberg/Power-BI style story with live gauges,
  // a network map and signature animations.
  {
    id: "exec-summary-zone",
    label: "Executive Summary",
    icon: Gauge,
    section: "overview",
    tabs: [
      { id: "exec-summary", label: "Executive Summary", icon: Gauge, signature: "rise", permissions: ["executive_view"] },
    ],
  },
  // ============================ OPERATIONS ============================
  // Documents — shipment-first upload + validation; sits above the flow
  // workspaces because every shipment begins as documents.
  {
    id: "documents-zone",
    label: "Documents",
    icon: ScanText,
    section: "operations",
    tabs: [
      {
        id: "upload-center",
        label: "Upload Center",
        icon: Upload,
        signature: "rise",
        permissions: ["goods_receipt", "import_approval", "shipment_request", "dispatch", "customer_read"],
      },
      {
        id: "validation-center",
        label: "Validation Center",
        icon: ClipboardCheck,
        signature: "rise",
        permissions: ["import_approval", "goods_receipt", "shipment_approval", "dispatch_approval", "customer_read"],
      },
      {
        id: "doc-primary-validate",
        label: "Validate · Inbound",
        icon: ShieldCheck,
        signature: "stamp",
        permissions: ["import_approval", "goods_receipt"],
      },
      {
        id: "doc-secondary-validate",
        label: "Validate · Outbound",
        icon: ShieldCheck,
        signature: "stamp",
        permissions: ["shipment_approval", "dispatch_approval", "customer_read"],
      },
    ],
  },
  // 1) Primary Sales — Meril India → Subsidiary (buying stock in).
  {
    id: "primary-sales-zone",
    label: "Primary Sales",
    icon: PlaneLanding,
    section: "operations",
    tabs: [
      {
        id: "primary-sales",
        label: "Planning",
        icon: CalendarRange,
        signature: "glide",
        permissions: PRIMARY_PERMS,
      },
      {
        id: "import-validation",
        label: "Operations",
        icon: ClipboardCheck,
        signature: "rise",
        permissions: PRIMARY_PERMS,
      },
      {
        id: "payables",
        label: "Finance",
        icon: HandCoins,
        signature: "flow",
        permissions: ["reports_export", "audit", "import_approval", "goods_receipt"],
      },
      { id: "goods-tracking", label: "Tracking", icon: RadioTower, signature: "glide" },
    ],
  },
  // 2) Inventory — the central bridge; Primary fills it, Secondary draws it down.
  {
    id: "inventory-zone",
    label: "Inventory",
    icon: Warehouse,
    section: "operations",
    tabs: [
      { id: "inventory-hub", label: "Planning", icon: CalendarRange, signature: "rise", permissions: INVENTORY_PERMS },
      { id: "inventory", label: "Operations", icon: Boxes, signature: "rise", permissions: INVENTORY_PERMS },
      { id: "reviews", label: "Reviews", icon: ScrollText, signature: "sweep" },
      {
        id: "expiry",
        label: "Expiry",
        icon: ClipboardList,
        signature: "sweep",
        permissions: ["expiry_review", "batch_traceability"],
      },
      {
        id: "consignment",
        label: "Consignment",
        icon: PackageOpen,
        signature: "rise",
        permissions: ["inventory_value", "inventory_approval", "goods_receipt", "customer_read"],
      },
      {
        id: "returns",
        label: "Returns",
        icon: RotateCcw,
        signature: "loop",
        permissions: ["goods_receipt", "inventory_count", "reconciliation"],
      },
      { id: "receipts", label: "Receipts", icon: FileSpreadsheet, signature: "rise", permissions: ["goods_receipt"] },
      {
        id: "counts",
        label: "Counts",
        icon: ClipboardCheck,
        signature: "rise",
        permissions: ["inventory_count", "reconciliation"],
      },
      { id: "traceability", label: "Traceability", icon: GitBranch, signature: "path" },
    ],
  },
  // 3) Secondary Sales — Subsidiary → Customer (selling stock out).
  {
    id: "secondary-sales-zone",
    label: "Secondary Sales",
    icon: Send,
    section: "operations",
    tabs: [
      { id: "secondary-sales", label: "Sales", icon: TrendingUp, signature: "network", permissions: SECONDARY_PERMS },
      {
        id: "receivables",
        label: "Finance",
        icon: Banknote,
        signature: "flow",
        permissions: ["reports_export", "audit", "customer_read"],
      },
      { id: "dispatches", label: "Operations", icon: Truck, signature: "glide", permissions: ["dispatch", "dispatch_approval"] },
      { id: "commercial", label: "Performance", icon: LineChart, signature: "network" },
      {
        id: "customers",
        label: "Customers",
        icon: Users,
        signature: "network",
        permissions: ["customer_read", "shipment_request"],
      },
      {
        id: "shipments",
        label: "Shipments",
        icon: Ship,
        signature: "glide",
        permissions: ["shipment_request", "shipment_approval"],
      },
      {
        id: "commitments",
        label: "Commitments",
        icon: Handshake,
        signature: "glide",
        permissions: ["shipment_request", "shipment_approval", "customer_read"],
      },
    ],
  },
  // ============================ MANAGEMENT ============================
  // "Why is it happening?" — analysis & intelligence. (Phase 7B will reshape
  // these fixed dashboards into a chooseable Analysis Marketplace; for now each
  // is reachable as its own workspace under the Management tab.)
  {
    id: "ops-intel-zone",
    label: "Ops Intelligence",
    icon: Activity,
    section: "management",
    tabs: [{ id: "dash-ops-intel", label: "Operations Intelligence", icon: Activity, signature: "rise" }],
  },
  {
    id: "dash-planning-zone",
    label: "Planning",
    icon: CalendarRange,
    section: "management",
    tabs: [
      { id: "dash-planning", label: "Planning", icon: CalendarRange, signature: "sweep" },
      { id: "dash-snapshot", label: "Time Machine", icon: History, signature: "path" },
    ],
  },
  {
    id: "dash-primary-zone",
    label: "Primary Sales",
    icon: PlaneLanding,
    section: "management",
    tabs: [{ id: "dash-primary", label: "Primary Sales", icon: PlaneLanding, signature: "glide" }],
  },
  {
    id: "dash-inventory-zone",
    label: "Inventory",
    icon: Warehouse,
    section: "management",
    tabs: [{ id: "dash-inventory", label: "Inventory", icon: Warehouse, signature: "rise" }],
  },
  {
    id: "dash-secondary-zone",
    label: "Secondary Sales",
    icon: Send,
    section: "management",
    tabs: [{ id: "dash-secondary", label: "Secondary Sales", icon: Send, signature: "flow" }],
  },
  {
    id: "dash-business-zone",
    label: "Business",
    icon: Globe2,
    section: "management",
    tabs: [
      { id: "dash-business", label: "Business", icon: Globe2, signature: "network" },
      { id: "command-center", label: "Command Center", icon: Gauge, signature: "rise" },
      { id: "analytics", label: "Analytics", icon: BarChart3, signature: "fade" },
    ],
  },
  {
    id: "dash-finance-zone",
    label: "Finance",
    icon: Wallet,
    section: "management",
    tabs: [{ id: "dash-finance", label: "Finance", icon: Wallet, signature: "flow" }],
  },
  // ============================== MY WORK =============================
  // "What do I personally need to do?" — personal, email-permission driven.
  {
    id: "mywork",
    label: "My Work",
    icon: Inbox,
    section: "mywork",
    tabs: [{ id: "my-work", label: "Queues", icon: Inbox, signature: "rise" }],
  },
  // ===================== OPERATIONS · GOVERNANCE ======================
  // Admin / App Manager setup that sits inside the Operations tab as a
  // distinct Governance cluster (gated by masters / security / audit perms).
  {
    id: "doc-intel-zone",
    label: "Document Intelligence",
    icon: ScanText,
    section: "operations",
    group: "Governance",
    tabs: [
      {
        id: "doc-intelligence",
        label: "Document Intelligence",
        icon: ScanText,
        signature: "rise",
        permissions: ["import_approval", "goods_receipt", "masters"],
      },
    ],
  },
  {
    id: "approvals",
    label: "Approvals",
    icon: Stamp,
    section: "mywork",
    tabs: [
      {
        id: "approvals",
        label: "Approval Center",
        icon: Stamp,
        signature: "stamp",
        permissions: [
          "import_approval",
          "shipment_approval",
          "dispatch_approval",
          "inventory_approval",
          "reconciliation",
        ],
      },
    ],
  },
  {
    id: "decisions",
    label: "Decisions",
    icon: Compass,
    section: "management",
    tabs: [
      { id: "decision-center", label: "Decision Center", icon: Compass, signature: "path" },
      { id: "learning", label: "Learning", icon: BrainCircuit, signature: "path" },
      { id: "assistant", label: "Assistant", icon: Bot, signature: "fade" },
    ],
  },
  {
    id: "access",
    label: "Access",
    icon: ShieldCheck,
    section: "operations",
    group: "Governance",
    tabs: [
      { id: "security", label: "Users & Roles", icon: ShieldCheck, signature: "fade", permissions: ["security"] },
      { id: "audit", label: "Audit", icon: History, signature: "path", permissions: ["audit"] },
    ],
  },
  {
    id: "setup",
    label: "Setup",
    icon: Settings2,
    section: "operations",
    group: "Governance",
    tabs: [
      { id: "products", label: "Products", icon: Package, signature: "rise", permissions: ["masters"] },
      {
        id: "erp-uploads",
        label: "ERP Upload",
        icon: Upload,
        signature: "rise",
        permissions: ["reports_export", "import_approval", "goods_receipt"],
      },
      { id: "platform-progress", label: "Progress", icon: Rocket, signature: "sweep" },
      { id: "dashboard", label: "Ops Dashboard", icon: LayoutDashboard, signature: "rise" },
    ],
  },
];

export const ALL_TABS: TabDef[] = WORKSPACES.flatMap((workspace) => workspace.tabs);

const WORKSPACE_BY_VIEW = new Map<string, WorkspaceDef>(
  WORKSPACES.flatMap((workspace) => workspace.tabs.map((tab) => [tab.id, workspace] as const)),
);

const TAB_BY_VIEW = new Map<string, TabDef>(ALL_TABS.map((tab) => [tab.id, tab]));

export function hasPermission(user: ApiAuthenticatedUser | null, permission: string): boolean {
  if (!user) return false;
  return user.role_name === "Admin" || user.permissions.includes(permission);
}

export function canAccessView(user: ApiAuthenticatedUser | null, viewId: string): boolean {
  if (!user) return false;
  if (user.role_name === "Admin") return true;
  const tab = TAB_BY_VIEW.get(viewId);
  if (!tab) return false;
  if (!tab.permissions || tab.permissions.length === 0) return true;
  return tab.permissions.some((permission) => user.permissions.includes(permission));
}

export function workspaceOfView(viewId: string): WorkspaceDef | undefined {
  return WORKSPACE_BY_VIEW.get(viewId);
}

export function tabOfView(viewId: string): TabDef | undefined {
  return TAB_BY_VIEW.get(viewId);
}

export function visibleTabs(user: ApiAuthenticatedUser | null, workspace: WorkspaceDef): TabDef[] {
  return workspace.tabs.filter((tab) => canAccessView(user, tab.id));
}

export function visibleWorkspaces(user: ApiAuthenticatedUser | null): WorkspaceDef[] {
  return WORKSPACES.filter((workspace) => visibleTabs(user, workspace).length > 0);
}

/** Visible workspaces grouped by section, preserving section order and
 *  dropping any section the user can't see at all. */
export function visibleSections(
  user: ApiAuthenticatedUser | null,
): { id: SectionId; label: string; icon: NavIcon; question: string; workspaces: WorkspaceDef[] }[] {
  const visible = visibleWorkspaces(user);
  return SECTIONS.map((section) => ({
    ...section,
    workspaces: visible.filter((workspace) => workspace.section === section.id),
  })).filter((section) => section.workspaces.length > 0);
}

/** The first screen the user can open inside a given primary tab (section).
 *  Used when a top-level tab is clicked, so it lands on that tab's first
 *  accessible workspace. Returns null when the tab is empty for this user. */
export function firstViewOfSection(user: ApiAuthenticatedUser | null, sectionId: SectionId): string | null {
  const section = visibleSections(user).find((candidate) => candidate.id === sectionId);
  if (!section) return null;
  for (const workspace of section.workspaces) {
    const tabs = visibleTabs(user, workspace);
    if (tabs.length > 0) return tabs[0].id;
  }
  return null;
}

/** The first screen this user is actually allowed to open — used as a safe
 *  landing / redirect target so a restricted user never lands on a blocked
 *  view. Falls back to the Business dashboard (open to all signed-in users). */
export function firstAccessibleView(user: ApiAuthenticatedUser | null): string {
  for (const section of visibleSections(user)) {
    for (const workspace of section.workspaces) {
      const tabs = visibleTabs(user, workspace);
      if (tabs.length > 0) return tabs[0].id;
    }
  }
  return "dash-business";
}
