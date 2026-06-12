import type { ComponentType } from "react";
import {
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
  Gauge,
  GitBranch,
  HandCoins,
  Handshake,
  History,
  Inbox,
  PackageOpen,
  PlaneLanding,
  RotateCcw,
  LineChart,
  Package,
  RadioTower,
  Rocket,
  ScrollText,
  Send,
  ShieldCheck,
  Ship,
  Stamp,
  TrendingUp,
  Truck,
  Upload,
  Users,
  Warehouse,
} from "lucide-react";

import type { ApiAuthenticatedUser } from "../lib/api";
import type { Signature } from "../motion/motion";

// Workspace navigation registry (Phase 5C). Single source of truth for the
// management OS information architecture. Permissions (never role names)
// drive visibility; Admin bypasses everything. Adding a screen = one tab
// entry here + its render branch in App.tsx.
//
// Inventory, Primary Sales, and Secondary Sales are deliberately separate
// workspaces — three different management questions:
//   Inventory       — "What do we have?"            (stock and risk)
//   Primary Sales   — "What are we receiving from Meril India?"
//   Secondary Sales — "What are we delivering to customers?"

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
  tabs: TabDef[];
};

export const WORKSPACES: WorkspaceDef[] = [
  {
    id: "command",
    label: "Command Center",
    icon: Gauge,
    tabs: [
      { id: "command-center", label: "Overview", icon: Gauge, signature: "rise" },
      { id: "analytics", label: "Analytics", icon: LineChart, signature: "fade" },
      { id: "platform-progress", label: "Progress", icon: Rocket, signature: "sweep" },
    ],
  },
  {
    id: "mywork",
    label: "My Work",
    icon: Inbox,
    tabs: [{ id: "my-work", label: "Queues", icon: Inbox, signature: "rise" }],
  },
  {
    id: "reviews",
    label: "Reviews",
    icon: ScrollText,
    tabs: [{ id: "reviews", label: "Review Center", icon: ScrollText, signature: "sweep" }],
  },
  {
    id: "approvals",
    label: "Approvals",
    icon: Stamp,
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
    id: "inventory-zone",
    label: "Inventory",
    icon: Warehouse,
    tabs: [
      {
        id: "inventory-hub",
        label: "Overview",
        icon: Warehouse,
        signature: "rise",
        permissions: ["goods_receipt", "inventory_approval", "inventory_value", "expiry_review"],
      },
      {
        id: "inventory",
        label: "Batches",
        icon: Boxes,
        signature: "rise",
        permissions: ["goods_receipt", "inventory_approval", "inventory_value", "expiry_review"],
      },
      {
        id: "receipts",
        label: "Receipts",
        icon: FileSpreadsheet,
        signature: "rise",
        permissions: ["goods_receipt"],
      },
      {
        id: "counts",
        label: "Counts",
        icon: ClipboardCheck,
        signature: "rise",
        permissions: ["inventory_count", "reconciliation"],
      },
      {
        id: "expiry",
        label: "Expiry",
        icon: ClipboardList,
        signature: "sweep",
        permissions: ["expiry_review", "batch_traceability"],
      },
      { id: "traceability", label: "Traceability", icon: GitBranch, signature: "path" },
    ],
  },
  {
    id: "primary-sales-zone",
    label: "Primary Sales",
    icon: PlaneLanding,
    tabs: [
      {
        id: "primary-sales",
        label: "Overview",
        icon: PlaneLanding,
        signature: "glide",
        permissions: ["import_approval", "goods_receipt", "shipment_approval"],
      },
      { id: "goods-tracking", label: "Goods Tracking", icon: RadioTower, signature: "glide" },
      {
        id: "documents",
        label: "Documents",
        icon: FileUp,
        signature: "rise",
        permissions: ["import_approval", "goods_receipt"],
      },
      {
        id: "import-validation",
        label: "Import Validation",
        icon: ClipboardCheck,
        signature: "rise",
        permissions: ["import_approval", "goods_receipt"],
      },
    ],
  },
  {
    id: "secondary-sales-zone",
    label: "Secondary Sales",
    icon: Send,
    tabs: [
      {
        id: "secondary-sales",
        label: "Overview",
        icon: Send,
        signature: "flow",
        permissions: ["shipment_request", "shipment_approval", "dispatch", "customer_read"],
      },
      {
        id: "dispatches",
        label: "Dispatches",
        icon: Truck,
        signature: "glide",
        permissions: ["dispatch", "dispatch_approval"],
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
  {
    id: "operations",
    label: "Operations",
    icon: Boxes,
    tabs: [
      { id: "dashboard", label: "Ops Dashboard", icon: BarChart3, signature: "rise" },
      {
        id: "shipments",
        label: "Shipments",
        icon: Ship,
        signature: "glide",
        permissions: ["shipment_request", "shipment_approval"],
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
      {
        id: "erp-uploads",
        label: "ERP Upload",
        icon: Upload,
        signature: "rise",
        permissions: ["reports_export", "import_approval", "goods_receipt"],
      },
      { id: "products", label: "Products", icon: Package, signature: "rise", permissions: ["masters"] },
    ],
  },
  {
    id: "commercial",
    label: "Commercial",
    icon: TrendingUp,
    tabs: [
      { id: "commercial", label: "Performance", icon: TrendingUp, signature: "network" },
      {
        id: "receivables",
        label: "Receivables",
        icon: Banknote,
        signature: "flow",
        permissions: ["reports_export", "audit", "customer_read"],
      },
      {
        id: "payables",
        label: "Payables",
        icon: HandCoins,
        signature: "flow",
        permissions: ["reports_export", "audit"],
      },
      {
        id: "customers",
        label: "Customers",
        icon: Users,
        signature: "network",
        permissions: ["customer_read", "shipment_request"],
      },
    ],
  },
  {
    id: "decisions",
    label: "Decisions",
    icon: Compass,
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
    tabs: [
      { id: "security", label: "Users & Roles", icon: ShieldCheck, signature: "fade", permissions: ["security"] },
      { id: "audit", label: "Audit", icon: History, signature: "path", permissions: ["audit"] },
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
