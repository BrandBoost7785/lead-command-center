import type { PermissionKey, Role, RoleKey, Membership, User } from "./types";

/**
 * Permission catalog. Kept as data (rather than checks scattered through the UI)
 * so admins can compose roles and so the service layer can enforce the same
 * rules the UI reflects.
 */
export interface PermissionDefinition {
  key: PermissionKey;
  group: string;
  label: string;
  description: string;
  risk: "low" | "medium" | "high";
}

export const PERMISSIONS: PermissionDefinition[] = [
  {
    key: "leads.view",
    group: "Leads",
    label: "View leads",
    description: "See prospects and their records",
    risk: "low",
  },
  {
    key: "leads.edit",
    group: "Leads",
    label: "Edit leads",
    description: "Change prospect details, owners and tags",
    risk: "medium",
  },
  {
    key: "leads.delete",
    group: "Leads",
    label: "Delete leads",
    description: "Permanently remove prospects",
    risk: "high",
  },
  {
    key: "data.export",
    group: "Data",
    label: "Export data",
    description: "Export CSV/Sheets of business data",
    risk: "high",
  },
  {
    key: "comms.view",
    group: "Communications",
    label: "View communications",
    description: "Read email, SMS and WhatsApp threads",
    risk: "medium",
  },
  {
    key: "comms.send",
    group: "Communications",
    label: "Send communications",
    description: "Send email, SMS and WhatsApp replies",
    risk: "medium",
  },
  {
    key: "calls.view",
    group: "Communications",
    label: "View calls",
    description: "See call history and outcomes",
    risk: "low",
  },
  {
    key: "calls.transcripts",
    group: "Communications",
    label: "View transcripts",
    description: "Read call transcripts and recordings",
    risk: "high",
  },
  {
    key: "forms.manage",
    group: "Intake",
    label: "Manage forms",
    description: "Create, edit and publish intake forms",
    risk: "medium",
  },
  {
    key: "pipeline.manage",
    group: "Pipeline",
    label: "Manage pipeline",
    description: "Configure states and override movement",
    risk: "medium",
  },
  {
    key: "automations.manage",
    group: "Automation",
    label: "Manage automations",
    description: "Create and edit WHEN/IF/THEN rules",
    risk: "high",
  },
  {
    key: "ai.run",
    group: "AI",
    label: "Run AI actions",
    description: "Ask the AI to act on the business",
    risk: "medium",
  },
  {
    key: "ai.approve",
    group: "AI",
    label: "Approve AI actions",
    description: "Approve actions queued for human sign-off",
    risk: "high",
  },
  {
    key: "ai.configure",
    group: "AI",
    label: "Configure AI",
    description: "Change autonomy, agents and scoring weights",
    risk: "high",
  },
  {
    key: "ai.viewDecisions",
    group: "AI",
    label: "View AI decision logs",
    description: "Inspect why the AI did something",
    risk: "medium",
  },
  {
    key: "integrations.manage",
    group: "Integrations",
    label: "Manage integrations",
    description: "Connect email, telephony and CRM providers",
    risk: "high",
  },
  {
    key: "reports.view",
    group: "Reporting",
    label: "View reports",
    description: "Access analytics and performance data",
    risk: "low",
  },
  {
    key: "users.manage",
    group: "Administration",
    label: "Manage users",
    description: "Invite users and change roles",
    risk: "high",
  },
  {
    key: "businesses.manage",
    group: "Administration",
    label: "Manage businesses",
    description: "Create and configure businesses",
    risk: "high",
  },
  {
    key: "billing.manage",
    group: "Administration",
    label: "Manage billing",
    description: "Plans, seats and invoices",
    risk: "high",
  },
];

export const PERMISSION_GROUPS = Array.from(new Set(PERMISSIONS.map((p) => p.group)));

const ALL: PermissionKey[] = PERMISSIONS.map((p) => p.key);

export const ROLES: Record<RoleKey, Role> = {
  owner: {
    key: "owner",
    name: "Owner",
    description: "Full control of the organization, billing and every business.",
    system: true,
    permissions: ALL,
  },
  admin: {
    key: "admin",
    name: "Admin",
    description: "Operates the business: users, integrations, automation and AI configuration.",
    system: true,
    permissions: ALL.filter((p) => p !== "billing.manage"),
  },
  manager: {
    key: "manager",
    name: "Manager",
    description:
      "Runs a team: sees everything in the business, approves AI actions, owns the pipeline.",
    system: true,
    permissions: [
      "leads.view",
      "leads.edit",
      "leads.delete",
      "data.export",
      "comms.view",
      "comms.send",
      "calls.view",
      "calls.transcripts",
      "forms.manage",
      "pipeline.manage",
      "automations.manage",
      "ai.run",
      "ai.approve",
      "ai.viewDecisions",
      "reports.view",
      "users.manage",
    ],
  },
  salesperson: {
    key: "salesperson",
    name: "Salesperson",
    description: "Works their own book of prospects and communications.",
    system: true,
    permissions: [
      "leads.view",
      "leads.edit",
      "comms.view",
      "comms.send",
      "calls.view",
      "calls.transcripts",
      "forms.manage",
      "ai.run",
      "reports.view",
    ],
  },
  assistant: {
    key: "assistant",
    name: "Assistant",
    description: "Supports the team with scheduling, admin and intake follow-up.",
    system: true,
    permissions: [
      "leads.view",
      "leads.edit",
      "comms.view",
      "comms.send",
      "calls.view",
      "reports.view",
    ],
  },
  ai_agent: {
    key: "ai_agent",
    name: "AI Agent",
    description: "Autonomous assistant operating inside explicit, audited scopes.",
    system: true,
    permissions: [
      "leads.view",
      "leads.edit",
      "comms.view",
      "comms.send",
      "calls.view",
      "ai.run",
      "reports.view",
    ],
  },
  client: {
    key: "client",
    name: "Client",
    description: "External collaborator with visibility into their own records only.",
    system: true,
    permissions: ["leads.view", "comms.view"],
  },
  analyst: {
    key: "analyst",
    name: "Analyst",
    description: "Read-only access to pipeline and performance reporting.",
    system: true,
    permissions: [
      "leads.view",
      "comms.view",
      "calls.view",
      "reports.view",
      "ai.viewDecisions",
      "data.export",
    ],
  },
};

export const ROLE_LIST: Role[] = Object.values(ROLES);

export function isRoleKey(value: string): value is RoleKey {
  return value in ROLES;
}

/**
 * Effective permission set for a membership: role grants plus explicit
 * per-user overrides. Used identically by the UI and the service layer.
 */
export function effectivePermissions(membership: Membership): Set<PermissionKey> {
  const role = ROLES[membership.roleKey];
  const perms = new Set<PermissionKey>(role?.permissions ?? []);
  for (const [key, granted] of Object.entries(membership.permissionOverrides ?? {})) {
    if (!key) continue;
    if (granted) perms.add(key as PermissionKey);
    else perms.delete(key as PermissionKey);
  }
  return perms;
}

export function membershipFor(
  state: { memberships: Membership[] },
  userId: string,
  businessId?: string,
): Membership | undefined {
  return state.memberships.find(
    (m) =>
      m.userId === userId &&
      (businessId ? m.businessId === businessId : true) &&
      m.status === "active",
  );
}

export function userCan(
  state: { memberships: Membership[]; users: User[] },
  userId: string,
  businessId: string,
  permission: PermissionKey,
): boolean {
  const membership = membershipFor(state, userId, businessId);
  if (!membership) return false;
  // Owners always keep full control of their own tenant.
  if (membership.roleKey === "owner") return true;
  return effectivePermissions(membership).has(permission);
}

export function canAny(
  state: { memberships: Membership[]; users: User[] },
  userId: string,
  businessId: string,
  permissions: PermissionKey[],
): boolean {
  return permissions.some((p) => userCan(state, userId, businessId, p));
}
