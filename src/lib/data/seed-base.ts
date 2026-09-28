/**
 * Sample business data — realistic enough that the dashboard demonstrates the
 * product's value on first load, and rich enough to exercise every screen.
 *
 * Everything is generated relative to `now`, so the demo is always "live":
 * the store re-anchors timestamps on load (see `shiftTimestamps`).
 */
import { DEFAULT_WEIGHTS } from "@/lib/intelligence/scoring";
import type {
  AIAction,
  AIAgent,
  AIInsight,
  AppState,
  Appointment,
  AuditLogEntry,
  Automation,
  AutomationRun,
  Business,
  CallDetail,
  Channel,
  Communication,
  CommunicationStatus,
  Company,
  Contact,
  Deal,
  Document,
  DomainEvent,
  EventEffect,
  EventType,
  FormSubmission,
  IntakeForm,
  Integration,
  Intent,
  LeadSource,
  Membership,
  Notification,
  Pipeline,
  Priority,
  Prospect,
  RoleKey,
  Sentiment,
  Task,
  Team,
  Tenant,
  User,
} from "@/lib/domain/types";

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

const TENANT = "t_northwind";
const BIZ1 = "biz_northwind";
const BIZ2 = "biz_meridian";

function makeIso(now: number, minutesAgo: number): string {
  return new Date(now - minutesAgo * 60_000).toISOString();
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

interface CommSpec {
  ch: Channel;
  dir: "in" | "out";
  m: number;
  st: CommunicationStatus;
  subject?: string;
  body: string;
  intent?: Intent;
  sentiment?: Sentiment;
  urgency?: Priority;
  topics?: string[];
  handled?: boolean;
  requiresResponse?: boolean;
  dur?: number;
  outcome?: CallDetail["outcome"];
  respMin?: number;
  tags?: string[];
}

interface ProspectSpec {
  id: string;
  name: string;
  company?: string;
  title: string;
  email?: string;
  phone?: string;
  source: LeadSource;
  state: Prospect["state"];
  intent: Intent;
  engagement: number;
  value: number;
  owner: string;
  tags?: string[];
  flags?: string[];
  summary: string;
  preferred?: Channel;
  h: CommSpec[];
  extraContacts?: { name: string; title: string; email: string }[];
}

const AVATAR_COLORS = [
  "oklch(0.62 0.19 264)",
  "oklch(0.66 0.17 150)",
  "oklch(0.7 0.17 55)",
  "oklch(0.6 0.2 330)",
  "oklch(0.65 0.15 200)",
  "oklch(0.68 0.18 25)",
  "oklch(0.58 0.16 300)",
  "oklch(0.72 0.14 120)",
];

/* -------------------------------------------------------------------------- */
/* tenants, businesses, identity                                               */
/* -------------------------------------------------------------------------- */

function buildTenantAndBusinesses(now: number): { tenant: Tenant; businesses: Business[] } {
  const tenant: Tenant = {
    id: TENANT,
    name: "Northwind Group",
    slug: "northwind",
    plan: "growth",
    createdAt: makeIso(now, 60 * 24 * 420),
    billing: {
      seats: 10,
      seatsUsed: 7,
      renewalDate: makeIso(now, -60 * 24 * 12),
      status: "active",
    },
  };

  const businesses: Business[] = [
    {
      id: BIZ1,
      tenantId: TENANT,
      name: "Northwind Dental Studio",
      legalName: "Northwind Dental Studio PLLC",
      industry: "Healthcare — Multi-site dental",
      timezone: "America/Chicago",
      currency: "USD",
      website: "northwinddental.com",
      phone: "+1 (512) 555-0142",
      address: "2210 Congress Ave, Austin, TX",
      brandColor: "oklch(0.58 0.16 250)",
      createdAt: makeIso(now, 60 * 24 * 400),
      settings: {
        defaultAutonomy: "approve",
        quietHours: { start: "20:00", end: "07:00" },
        scoringWeights: DEFAULT_WEIGHTS,
        followUpSlaHours: 24,
        intakeReminderHours: 12,
        workingHours: { start: "08:00", end: "18:00", days: [1, 2, 3, 4, 5] },
        notifications: [
          { key: "new_response", inApp: true, email: true, push: true },
          { key: "missed_call", inApp: true, email: true, push: true },
          { key: "hot_prospect", inApp: true, email: false, push: true },
          { key: "follow_up_overdue", inApp: true, email: true, push: false },
          { key: "form_incomplete", inApp: true, email: false, push: false },
          { key: "appointment", inApp: true, email: true, push: true },
          { key: "ai_action", inApp: true, email: false, push: false },
          { key: "automation_failure", inApp: true, email: true, push: false },
          { key: "integration_issue", inApp: true, email: true, push: false },
          { key: "opportunity", inApp: true, email: false, push: false },
        ],
      },
    },
    {
      id: BIZ2,
      tenantId: TENANT,
      name: "Meridian Roofing Co.",
      legalName: "Meridian Roofing Company LLC",
      industry: "Commercial & residential roofing",
      timezone: "America/Denver",
      currency: "USD",
      website: "meridianroofing.co",
      phone: "+1 (303) 555-0188",
      address: "480 Brighton Blvd, Denver, CO",
      brandColor: "oklch(0.62 0.15 45)",
      createdAt: makeIso(now, 60 * 24 * 210),
      settings: {
        defaultAutonomy: "assist",
        quietHours: { start: "19:00", end: "06:30" },
        scoringWeights: { ...DEFAULT_WEIGHTS, dealValue: 12, appointmentActivity: 11 },
        followUpSlaHours: 4,
        intakeReminderHours: 6,
        workingHours: { start: "07:00", end: "17:00", days: [1, 2, 3, 4, 5, 6] },
        notifications: [
          { key: "new_response", inApp: true, email: true, push: false },
          { key: "missed_call", inApp: true, email: true, push: false },
          { key: "hot_prospect", inApp: true, email: false, push: false },
          { key: "follow_up_overdue", inApp: true, email: false, push: false },
          { key: "form_incomplete", inApp: true, email: false, push: false },
          { key: "appointment", inApp: true, email: true, push: false },
          { key: "ai_action", inApp: true, email: false, push: false },
          { key: "automation_failure", inApp: true, email: true, push: false },
          { key: "integration_issue", inApp: true, email: true, push: false },
          { key: "opportunity", inApp: true, email: false, push: false },
        ],
      },
    },
  ];

  return { tenant, businesses };
}

function buildUsers(now: number): User[] {
  const mk = (
    id: string,
    name: string,
    email: string,
    title: string,
    isAi: boolean,
    lastActiveMinutes: number,
    colorIndex: number,
  ): User => ({
    id,
    tenantId: TENANT,
    name,
    email,
    title,
    isAi,
    avatarColor: AVATAR_COLORS[colorIndex % AVATAR_COLORS.length],
    lastActiveAt: makeIso(now, lastActiveMinutes),
    createdAt: makeIso(now, 60 * 24 * 300),
  });

  return [
    mk("u_alex", "Alex Rivera", "alex@northwinddental.com", "Founder & Principal", false, 4, 0),
    mk("u_priya", "Priya Shah", "priya@northwinddental.com", "Growth Manager", false, 22, 1),
    mk(
      "u_daniel",
      "Daniel Okafor",
      "daniel@northwinddental.com",
      "Patient Coordinator",
      false,
      51,
      2,
    ),
    mk("u_maria", "Maria Chen", "maria@northwinddental.com", "Front Desk Lead", false, 96, 3),
    mk("u_sam", "Sam Delgado", "sam@northwinddental.com", "Revenue Analyst", false, 60 * 26, 4),
    mk("u_ava", "Ava", "ava@agents.northwind.ai", "AI Revenue Agent", true, 0, 5),
    mk("u_nina", "Nina", "nina@agents.northwind.ai", "AI Intake Agent", true, 6, 6),
    mk("u_rex", "Rex", "rex@agents.northwind.ai", "AI Re-engagement Agent", true, 60 * 52, 7),
    mk("u_mer_ty", "Ty Boyd", "ty@meridianroofing.co", "Sales Manager", false, 12, 3),
    mk("u_mer_lu", "Lucia Marin", "lucia@meridianroofing.co", "Estimator", false, 130, 6),
  ];
}

function buildMemberships(now: number): Membership[] {
  const mk = (
    id: string,
    businessId: string,
    userId: string,
    roleKey: RoleKey,
    overrides: Membership["permissionOverrides"] = {},
    status: Membership["status"] = "active",
    teamId?: string,
  ): Membership => ({
    id,
    tenantId: TENANT,
    businessId,
    userId,
    roleKey,
    permissionOverrides: overrides,
    teamId,
    status,
    invitedAt: status === "invited" ? makeIso(now, 60 * 30) : makeIso(now, 60 * 24 * 200),
  });

  return [
    mk("m1", BIZ1, "u_alex", "owner", {}, "active", "team_growth"),
    mk("m2", BIZ1, "u_priya", "manager", {}, "active", "team_growth"),
    mk(
      "m3",
      BIZ1,
      "u_daniel",
      "salesperson",
      { "calls.transcripts": true },
      "active",
      "team_growth",
    ),
    mk("m4", BIZ1, "u_maria", "assistant", {}, "active", "team_frontdesk"),
    mk("m5", BIZ1, "u_sam", "analyst", {}, "active"),
    mk("m6", BIZ1, "u_ava", "ai_agent", {}, "active"),
    mk("m7", BIZ1, "u_nina", "ai_agent", {}, "active"),
    mk("m8", BIZ1, "u_rex", "ai_agent", {}, "suspended"),
    mk("m9", BIZ2, "u_alex", "owner"),
    mk("m10", BIZ2, "u_mer_ty", "manager"),
    mk("m11", BIZ2, "u_mer_lu", "salesperson"),
    mk("m12", BIZ2, "u_daniel", "salesperson", {}, "invited"),
  ];
}

function buildTeams(): Team[] {
  return [
    {
      id: "team_growth",
      tenantId: TENANT,
      businessId: BIZ1,
      name: "Growth pod",
      description: "Owns inbound response, qualification and booking",
      color: "oklch(0.6 0.16 264)",
      memberIds: ["u_alex", "u_priya", "u_daniel"],
      managerId: "u_priya",
    },
    {
      id: "team_frontdesk",
      tenantId: TENANT,
      businessId: BIZ1,
      name: "Front desk",
      description: "Call answering, intake reminders and scheduling",
      color: "oklch(0.68 0.15 170)",
      memberIds: ["u_maria"],
      managerId: "u_priya",
    },
    {
      id: "team_meridian",
      tenantId: TENANT,
      businessId: BIZ2,
      name: "Estimating",
      description: "Site surveys and quote follow-up",
      color: "oklch(0.68 0.16 45)",
      memberIds: ["u_mer_ty", "u_mer_lu"],
      managerId: "u_mer_ty",
    },
  ];
}

function buildAgents(): AIAgent[] {
  return [
    {
      id: "agent_ava",
      tenantId: TENANT,
      businessId: BIZ1,
      name: "Ava",
      purpose: "Monitors inbound responses, scores intent and drafts replies for approval.",
      status: "active",
      autonomy: "approve",
      autonomousActions: [
        "create_task",
        "update_priority",
        "update_pipeline_state",
        "schedule_follow_up",
      ],
      scopes: ["email", "sms", "calls", "forms", "pipeline"],
      confidenceFloor: 0.72,
      model: "lead-intel/reasoner-1",
      escalationUserId: "u_priya",
    },
    {
      id: "agent_nina",
      tenantId: TENANT,
      businessId: BIZ1,
      name: "Nina",
      purpose: "Watches intake forms, chases incomplete high-value submissions autonomously.",
      status: "active",
      autonomy: "autonomous",
      autonomousActions: ["send_intake_reminder", "create_task", "notify_manager"],
      scopes: ["forms", "email", "sms"],
      confidenceFloor: 0.8,
      model: "lead-intel/reasoner-1",
      escalationUserId: "u_priya",
    },
    {
      id: "agent_rex",
      tenantId: TENANT,
      businessId: BIZ1,
      name: "Rex",
      purpose: "Re-engages dormant prospects with sequence-aware nudges.",
      status: "paused",
      autonomy: "assist",
      autonomousActions: ["create_task"],
      scopes: ["email", "sms"],
      confidenceFloor: 0.85,
      model: "lead-intel/reasoner-1",
    },
    {
      id: "agent_meridian",
      tenantId: TENANT,
      businessId: BIZ2,
      name: "Scout",
      purpose: "Qualifies roof inspection requests and flags storm-damage urgency.",
      status: "active",
      autonomy: "assist",
      autonomousActions: ["create_task", "update_priority"],
      scopes: ["forms", "calls", "email"],
      confidenceFloor: 0.75,
      model: "lead-intel/reasoner-1",
      escalationUserId: "u_mer_ty",
    },
  ];
}

export function buildTenantBundle(now: number) {
  const { tenant, businesses } = buildTenantAndBusinesses(now);
  return {
    tenant,
    businesses,
    users: buildUsers(now),
    memberships: buildMemberships(now),
    teams: buildTeams(),
    agents: buildAgents(),
  };
}
