import type { AppState, Prospect, ScoreBreakdown, ScoringWeights } from "@/lib/domain/types";
import {
  DEFAULT_WEIGHTS,
  computeScore,
  inferPipelineState,
  priorityFromScore,
  recommendNextAction,
} from "@/lib/intelligence/scoring";
import { buildTenantBundle } from "./seed-base";
import { buildCrm } from "./seed-crm";
import {
  buildActions,
  buildAppointments,
  buildAutomations,
  buildDeals,
  buildDocuments,
  buildEventsAndAudit,
  buildForms,
  buildInsights,
  buildIntegrations,
  buildNotifications,
  buildPipelines,
  buildTasks,
} from "./seed-ops";

export const SEED_VERSION = 4;

/**
 * Assemble the full application state for a fresh tenant. Everything is
 * relative to `now`, and scores/priorities/next-actions are computed by the
 * real intelligence engine rather than hand-written — so the UI you see is
 * the output of the same code path that runs in production.
 */
export function buildSeedState(now: number = Date.now()): AppState {
  const { tenant, businesses, users, memberships, teams, agents } = buildTenantBundle(now);
  const { companies, contacts, prospects, communications } = buildCrm(now);
  const tasks = buildTasks(now);
  const appointments = buildAppointments(now);
  const { forms, submissions } = buildForms(now);
  const deals = buildDeals(now, prospects);
  const documents = buildDocuments(now);
  const pipelines = buildPipelines();
  const { automations, runs } = buildAutomations(now);
  const insights = buildInsights(now);
  const actions = buildActions(now);
  const notifications = buildNotifications(now);
  const integrations = buildIntegrations(now);

  const scoreBreakdowns: Record<string, ScoreBreakdown> = {};
  const hydratedProspects = prospects.map((p) =>
    hydrateProspect(p, {
      communications,
      submissions,
      tasks,
      appointments,
      now,
      weights: weightsFor(p.businessId, businesses),
      scoreBreakdowns,
    }),
  );

  const eventsAndAudit = buildEventsAndAudit(now, hydratedProspects, communications, {
    tasks,
    appointments,
    forms,
    submissions,
    deals,
    documents,
    automations,
    runs,
    insights,
    actions,
    notifications,
    integrations,
  });

  return {
    version: SEED_VERSION,
    seededAt: new Date(now).toISOString(),
    tenants: [tenant],
    businesses,
    users,
    memberships,
    teams,
    agents,
    companies,
    contacts,
    prospects: hydratedProspects,
    communications,
    forms,
    submissions,
    tasks,
    appointments,
    documents,
    pipelines,
    deals,
    events: eventsAndAudit.events,
    insights,
    actions,
    automations,
    automationRuns: runs,
    integrations,
    notifications,
    audit: eventsAndAudit.audit,
    savedViews: [
      {
        id: "sv_hot",
        tenantId: tenant.id,
        businessId: "biz_northwind",
        userId: "u_alex",
        name: "🔥 Hottest prospects",
        entity: "prospects",
        filters: { band: "hot", sort: "score" },
        createdAt: new Date(now - 20 * 86_400_000).toISOString(),
        icon: "flame",
      },
      {
        id: "sv_waiting",
        tenantId: tenant.id,
        businessId: "biz_northwind",
        userId: "u_alex",
        name: "Waiting on us",
        entity: "prospects",
        filters: { awaitingReply: true },
        createdAt: new Date(now - 12 * 86_400_000).toISOString(),
        icon: "clock",
      },
      {
        id: "sv_missed",
        tenantId: tenant.id,
        businessId: "biz_northwind",
        userId: "u_priya",
        name: "Missed this week",
        entity: "prospects",
        filters: { missedActivity: true },
        createdAt: new Date(now - 6 * 86_400_000).toISOString(),
        icon: "phone-missed",
      },
      {
        id: "sv_intake",
        tenantId: tenant.id,
        businessId: "biz_northwind",
        userId: "shared",
        name: "Incomplete intakes",
        entity: "prospects",
        filters: { formStatus: "incomplete" },
        createdAt: new Date(now - 4 * 86_400_000).toISOString(),
        icon: "clipboard",
      },
      {
        id: "sv_meridian",
        tenantId: tenant.id,
        businessId: "biz_meridian",
        userId: "u_mer_ty",
        name: "Storm season urgent",
        entity: "prospects",
        filters: { priority: "critical" },
        createdAt: new Date(now - 3 * 86_400_000).toISOString(),
        icon: "zap",
      },
    ],
    session: {
      userId: "u_alex",
      tenantId: tenant.id,
      businessId: "biz_northwind",
      startedAt: new Date(now).toISOString(),
      onboardingComplete: true,
    },
    aiPausedBusinessIds: [],
    scoreBreakdowns,
  };
}

export function weightsFor(
  businessId: string,
  businesses: { id: string; settings: { scoringWeights?: ScoringWeights } }[],
): ScoringWeights {
  const business = businesses.find((b) => b.id === businessId);
  return business?.settings.scoringWeights ?? DEFAULT_WEIGHTS;
}

export interface HydrateContext {
  communications: AppState["communications"];
  submissions: AppState["submissions"];
  tasks: AppState["tasks"];
  appointments: AppState["appointments"];
  now: number;
  weights: ScoringWeights;
  scoreBreakdowns: Record<string, ScoreBreakdown>;
}

/** Compute score, priority, inferred state and next action for one prospect. */
export function hydrateProspect(prospect: Prospect, ctx: HydrateContext): Prospect {
  const breakdown = computeScore(prospect, {
    communications: ctx.communications,
    submissions: ctx.submissions,
    tasks: ctx.tasks,
    appointments: ctx.appointments,
    now: ctx.now,
    weights: ctx.weights,
    previous: ctx.scoreBreakdowns[prospect.id],
  });
  ctx.scoreBreakdowns[prospect.id] = breakdown;

  const inferred = inferPipelineState(prospect, ctx);
  const next = recommendNextAction(prospect, ctx);
  const overdue = ctx.tasks.filter(
    (t) => t.prospectId === prospect.id && t.status !== "completed" && +new Date(t.dueAt) < ctx.now,
  ).length;
  const hasInbound = ctx.communications.some(
    (c) =>
      c.prospectId === prospect.id && c.direction === "inbound" && !c.handled && c.requiresResponse,
  );

  const keepTerminal =
    prospect.state === "won" || prospect.state === "lost" || prospect.state === "customer";

  return {
    ...prospect,
    score: breakdown.total,
    scoreDelta: breakdown.delta,
    priority: priorityFromScore(breakdown.total, overdue, hasInbound),
    state: keepTerminal ? prospect.state : inferred.state,
    stateInferred: !keepTerminal,
    nextActionType: next.type,
    nextActionAt: prospect.nextActionAt,
  };
}

/** Re-hydrate the whole state (scores, priorities, inferred states). */
export function rehydrate(state: AppState, now: number = Date.now()): AppState {
  const scoreBreakdowns: Record<string, ScoreBreakdown> = { ...state.scoreBreakdowns };
  const prospects = state.prospects.map((p) =>
    hydrateProspect(p, {
      communications: state.communications,
      submissions: state.submissions,
      tasks: state.tasks,
      appointments: state.appointments,
      now,
      weights: weightsFor(p.businessId, state.businesses),
      scoreBreakdowns,
    }),
  );
  return { ...state, prospects, scoreBreakdowns };
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/**
 * The demo dataset is generated relative to a seed time. When a returning
 * visitor loads the app, every timestamp is shifted forward by the elapsed
 * time so "8 minutes ago" is still eight minutes ago — the dashboard always
 * looks live without regenerating identity (same ids, same story).
 */
export function shiftTimestamps<T>(value: T, deltaMs: number): T {
  if (deltaMs <= 0) return value;
  if (typeof value === "string") {
    if (ISO.test(value)) {
      return new Date(new Date(value).getTime() + deltaMs).toISOString() as unknown as T;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => shiftTimestamps(v, deltaMs)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = shiftTimestamps(v, deltaMs);
    }
    return out as unknown as T;
  }
  return value;
}
