import type {
  AppState,
  AttentionItem,
  AttentionKind,
  Communication,
  Intent,
  NextActionType,
  Priority,
  Prospect,
  Task,
} from "@/lib/domain/types";
import { NEXT_ACTION_LABEL, ageMinutes, relativeTime } from "@/lib/format";

/**
 * Attention engine.
 *
 * Rather than a fixed rule list, every candidate is scored on four axes —
 * urgency, signal strength, value and staleness — then ordered by the spec's
 * priority order from the dashboard requirements:
 *
 *   1. new emails / responses
 *   2. missed calls / call responses
 *   3. hottest prospects
 *   4. missed / overdue actions
 *   5. incomplete forms / intake
 *
 * The same ranking powers the dashboard, the notification order and the AI
 * Command Center's "what should I do next?" answer.
 */

const KIND_RANK: Record<AttentionKind, number> = {
  email_response: 1,
  unanswered_message: 1.2,
  missed_call: 2,
  hot_prospect: 3,
  stalled_deal: 3.5,
  overdue_follow_up: 4,
  task_overdue: 4.2,
  missed_appointment: 4.4,
  incomplete_intake: 5,
  unanswered_email: 5.5,
};

const URGENT_INTENTS = new Set(["high_intent", "scheduling", "pricing", "objection"]);

export interface AttentionContext {
  now?: number;
  /** Restrict to a single owner (used by "assigned to me" views). */
  ownerId?: string;
  limit?: number;
}

export function buildAttentionQueue(
  state: AppState,
  businessId: string,
  ctx: AttentionContext = {},
): AttentionItem[] {
  const now = ctx.now ?? Date.now();
  const items: AttentionItem[] = [];
  const prospects = state.prospects.filter((p) => p.businessId === businessId);
  const byId = new Map(prospects.map((p) => [p.id, p]));
  const contactOf = (p?: Prospect) => state.contacts.find((c) => c.id === p?.contactId);
  const companyOf = (p?: Prospect) => state.companies.find((c) => c.id === p?.companyId);

  const push = (item: Omit<AttentionItem, "ageMinutes" | "urgency"> & { urgency?: number }) => {
    if (ctx.ownerId && item.prospectId && byId.get(item.prospectId)?.ownerId !== ctx.ownerId)
      return;
    const age = ageMinutes(item.occurredAt, now);
    const urgency =
      item.urgency ?? scoreUrgency(item.kind, item.priority, age, byId.get(item.prospectId ?? ""));
    items.push({ ...item, ageMinutes: age, urgency });
  };

  /* 1 — inbound communications awaiting a response */
  for (const comm of state.communications) {
    if (comm.businessId !== businessId) continue;
    if (comm.direction !== "inbound") continue;
    if (comm.handled || !comm.requiresResponse) continue;
    const prospect = byId.get(comm.prospectId);
    if (!prospect) continue;
    const contact = contactOf(prospect);
    const company = companyOf(prospect);
    const name = contact ? `${contact.firstName} ${contact.lastName}` : "Unknown contact";
    const intent = comm.enrichment?.intent;

    if (comm.channel === "call" || comm.status === "missed") {
      push({
        id: `att_call_${comm.id}`,
        kind: "missed_call",
        priority: intent && URGENT_INTENTS.has(intent) ? "critical" : "high",
        prospectId: prospect.id,
        contactId: prospect.contactId,
        companyId: prospect.companyId,
        companyName: company?.name,
        title: `${name} — return missed call`,
        reason: `Inbound call missed ${relativeTime(comm.occurredAt, now)}${prospect.value > 15_000 ? " · high-value prospect" : ""}`,
        occurredAt: comm.occurredAt,
        recommendedAction: "call",
        recommendedActionLabel: NEXT_ACTION_LABEL.call,
        insight: prospect.summary,
        scoreImpact: prospect.score,
        href: `/prospects/${prospect.id}`,
      });
      continue;
    }

    const isEmail = comm.channel === "email";
    push({
      id: `att_${comm.id}`,
      kind: isEmail ? "email_response" : "unanswered_message",
      priority: priorityForIntent(intent, prospect),
      prospectId: prospect.id,
      contactId: prospect.contactId,
      companyId: prospect.companyId,
      companyName: company?.name,
      title: `${name} — ${isEmail ? "respond to email" : comm.channel === "form" ? "review intake request" : `respond on ${comm.channel}`}`,
      reason: `${capitalise(comm.channel)} received ${relativeTime(comm.occurredAt, now)}${intent ? ` · ${intentLabel(intent)}` : ""}`,
      occurredAt: comm.occurredAt,
      recommendedAction: "reply",
      recommendedActionLabel: NEXT_ACTION_LABEL.reply,
      insight: comm.enrichment?.summary ?? comm.preview,
      scoreImpact: prospect.score,
      href: `/prospects/${prospect.id}`,
    });
  }

  /* 4 — overdue follow-ups and tasks */
  for (const task of state.tasks) {
    if (task.businessId !== businessId) continue;
    if (task.status === "completed" || task.status === "cancelled") continue;
    if (+new Date(task.dueAt) >= now) continue;
    const prospect = task.prospectId ? byId.get(task.prospectId) : undefined;
    const contact = contactOf(prospect);
    const overdueMinutes = ageMinutes(task.dueAt, now);
    push({
      id: `att_task_${task.id}`,
      kind: prospect ? "overdue_follow_up" : "task_overdue",
      priority: overdueMinutes > 1_440 ? "high" : task.priority,
      prospectId: task.prospectId,
      contactId: task.contactId,
      companyId: task.companyId,
      companyName: prospect ? companyOf(prospect)?.name : undefined,
      title: `${task.title}`,
      reason: contact
        ? `Follow-up was due ${relativeTime(task.dueAt, now)} · ${task.reason}`
        : `${task.reason} · due ${relativeTime(task.dueAt, now)}`,
      occurredAt: task.dueAt,
      recommendedAction:
        task.type === "call" ? "call" : task.type === "reply" ? "reply" : "follow_up",
      recommendedActionLabel:
        task.type === "call" ? NEXT_ACTION_LABEL.call : NEXT_ACTION_LABEL.follow_up,
      insight: task.aiRecommendation,
      scoreImpact: prospect?.score,
      href: task.prospectId ? `/prospects/${task.prospectId}` : "/tasks",
    });
  }

  /* 5 — incomplete / abandoned intake */
  for (const sub of state.submissions) {
    if (sub.businessId !== businessId) continue;
    if (sub.status === "completed") continue;
    if (sub.completion < 35) continue;
    const prospect = sub.prospectId ? byId.get(sub.prospectId) : undefined;
    const contact = contactOf(prospect);
    const form = state.forms.find((f) => f.id === sub.formId);
    push({
      id: `att_sub_${sub.id}`,
      kind: "incomplete_intake",
      priority: sub.valueEstimate >= 20_000 ? "high" : "medium",
      prospectId: sub.prospectId,
      contactId: sub.contactId,
      companyId: sub.companyId,
      companyName: prospect ? companyOf(prospect)?.name : undefined,
      title: `${contact ? `${contact.firstName} ${contact.lastName}` : "Unlinked lead"} — intake incomplete`,
      reason: `${form?.name ?? "Intake"} ${sub.completion}% complete · waiting ${relativeTime(sub.lastActivityAt, now)}`,
      occurredAt: sub.lastActivityAt,
      recommendedAction: "send_reminder",
      recommendedActionLabel: NEXT_ACTION_LABEL.send_reminder,
      insight:
        sub.valueEstimate >= 20_000
          ? `High-value intake ($${sub.valueEstimate.toLocaleString()}) — abandoned intakes beyond 48h complete at 12% instead of 64%.`
          : "Intake stalled before completion.",
      scoreImpact: prospect?.score,
      href: sub.prospectId ? `/prospects/${sub.prospectId}` : "/forms",
    });
  }

  /* missed appointments */
  for (const appt of state.appointments) {
    if (appt.businessId !== businessId) continue;
    if (appt.status !== "missed") continue;
    const prospect = appt.prospectId ? byId.get(appt.prospectId) : undefined;
    const contact = contactOf(prospect);
    push({
      id: `att_appt_${appt.id}`,
      kind: "missed_appointment",
      priority: "high",
      prospectId: appt.prospectId,
      contactId: appt.contactId,
      companyId: appt.companyId,
      companyName: contact ? companyOf(prospect)?.name : undefined,
      title: `${appt.title} — missed`,
      reason: `Appointment missed ${relativeTime(appt.startAt, now)}`,
      occurredAt: appt.startAt,
      recommendedAction: "schedule",
      recommendedActionLabel: NEXT_ACTION_LABEL.schedule,
      insight:
        "Offer two alternative slots and ask whether the original time is generally difficult.",
      href: appt.prospectId ? `/prospects/${appt.prospectId}` : "/calendar",
    });
  }

  /* 3 — hottest prospects with no other open item (so the hottest always surface) */
  const alreadyFlagged = new Set(items.map((i) => i.prospectId).filter(Boolean));
  const hot = prospects
    .filter((p) => p.score >= 70 && !p.doNotContact && !alreadyFlagged.has(p.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  for (const p of hot) {
    const contact = contactOf(p);
    const company = companyOf(p);
    push({
      id: `att_hot_${p.id}`,
      kind: "hot_prospect",
      priority: p.score >= 88 ? "critical" : "high",
      prospectId: p.id,
      contactId: p.contactId,
      companyId: p.companyId,
      companyName: company?.name,
      title: `${contact ? `${contact.firstName} ${contact.lastName}` : p.id} — hot prospect`,
      reason: `Score ${p.score} · last activity ${relativeTime(p.lastActivityAt, now)}`,
      occurredAt: p.lastActivityAt,
      recommendedAction: p.nextActionType ?? "follow_up",
      recommendedActionLabel: NEXT_ACTION_LABEL[p.nextActionType ?? "follow_up"],
      insight: p.summary,
      scoreImpact: p.score,
      href: `/prospects/${p.id}`,
      urgency: 40 + p.score * 0.25,
    });
  }

  items.sort((a, b) => {
    if (b.urgency !== a.urgency) return b.urgency - a.urgency;
    const rankDiff = KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (rankDiff !== 0) return rankDiff;
    return +new Date(b.occurredAt) - +new Date(a.occurredAt);
  });

  return ctx.limit ? items.slice(0, ctx.limit) : items;
}

function scoreUrgency(
  kind: AttentionKind,
  priority: Priority,
  age: number,
  prospect?: Prospect,
): number {
  const base: Record<Priority, number> = { critical: 88, high: 74, medium: 55, low: 35 };
  let score = base[priority];
  score -= KIND_RANK[kind] * 0.6;
  // Fresh items outrank stale ones of the same kind, but stale critical items still matter.
  score += Math.max(-6, 12 - age / 8);
  if (prospect) {
    score += Math.min(8, prospect.score / 14);
    if (prospect.value >= 20_000) score += 5;
    if (prospect.healthFlags.includes("hot")) score += 3;
  }
  return Math.max(1, Math.round(score));
}

function priorityForIntent(intent: Intent | undefined, prospect: Prospect): Priority {
  if (intent === "high_intent" || intent === "objection") return "critical";
  if (intent === "scheduling" || intent === "pricing" || intent === "interested") return "high";
  if (prospect.score >= 80) return "high";
  return "medium";
}

function intentLabel(intent: string): string {
  return intent.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* -------------------------------------------------------------------------- */
/* Incoming activity feed (dashboard "NEW RESPONSES" panel)                    */
/* -------------------------------------------------------------------------- */

export interface IncomingFeed {
  communications: Communication[];
  missed: Communication[];
  unansweredEmails: Communication[];
  byChannel: Record<string, Communication[]>;
}

export function buildIncomingFeed(
  state: AppState,
  businessId: string,
  now = Date.now(),
): IncomingFeed {
  const window = 36 * 60 * 60_000;
  const comms = state.communications
    .filter((c) => c.businessId === businessId && now - +new Date(c.occurredAt) <= window)
    .sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));

  const inbound = comms.filter((c) => c.direction === "inbound");
  const byChannel: Record<string, Communication[]> = {};
  for (const c of inbound) {
    byChannel[c.channel] = [...(byChannel[c.channel] ?? []), c];
  }

  return {
    communications: comms,
    missed: comms.filter(
      (c) =>
        (c.channel === "call" && c.status === "missed" && !c.handled) ||
        (c.requiresResponse && c.direction === "inbound" && !c.handled && c.channel !== "email"),
    ),
    unansweredEmails: comms.filter(
      (c) => c.channel === "email" && c.direction === "inbound" && c.requiresResponse && !c.handled,
    ),
    byChannel,
  };
}

/* -------------------------------------------------------------------------- */
/* Missed activity panel                                                       */
/* -------------------------------------------------------------------------- */

export interface MissedItem {
  id: string;
  kind: AttentionKind;
  label: string;
  detail: string;
  occurredAt: string;
  prospectId?: string;
  actionLabel: string;
  priority: Priority;
}

export function buildMissedActivity(
  state: AppState,
  businessId: string,
  now = Date.now(),
): MissedItem[] {
  const out: MissedItem[] = [];
  const prospects = state.prospects.filter((p) => p.businessId === businessId);
  const byId = new Map(prospects.map((p) => [p.id, p]));
  const contactName = (p?: Prospect) => {
    const c = state.contacts.find((x) => x.id === p?.contactId);
    return c ? `${c.firstName} ${c.lastName}` : "Prospect";
  };

  for (const c of state.communications) {
    if (c.businessId !== businessId) continue;
    const prospect = byId.get(c.prospectId);
    if (c.channel === "call" && c.status === "missed" && !c.handled) {
      out.push({
        id: `missed_call_${c.id}`,
        kind: "missed_call",
        label: `Missed call — ${contactName(prospect)}`,
        detail: relativeTime(c.occurredAt, now),
        occurredAt: c.occurredAt,
        prospectId: prospect?.id,
        actionLabel: "Call back",
        priority: "critical",
      });
    }
    if (c.channel === "email" && c.direction === "inbound" && c.requiresResponse && !c.handled) {
      out.push({
        id: `unanswered_email_${c.id}`,
        kind: "unanswered_email",
        label: `Unanswered email — ${contactName(prospect)}`,
        detail: `${relativeTime(c.occurredAt, now)} · ${c.enrichment?.intent.replace(/_/g, " ") ?? "unclassified"}`,
        occurredAt: c.occurredAt,
        prospectId: prospect?.id,
        actionLabel: "Reply",
        priority: c.enrichment?.intent === "high_intent" ? "critical" : "high",
      });
    }
    if (
      (c.channel === "sms" || c.channel === "whatsapp") &&
      c.direction === "inbound" &&
      c.requiresResponse &&
      !c.handled
    ) {
      out.push({
        id: `unanswered_msg_${c.id}`,
        kind: "unanswered_message",
        label: `Unanswered ${c.channel} — ${contactName(prospect)}`,
        detail: relativeTime(c.occurredAt, now),
        occurredAt: c.occurredAt,
        prospectId: prospect?.id,
        actionLabel: "Reply",
        priority: "high",
      });
    }
  }

  for (const t of state.tasks) {
    if (t.businessId !== businessId) continue;
    if (t.status === "completed" || t.status === "cancelled") continue;
    if (+new Date(t.dueAt) >= now) continue;
    out.push({
      id: `overdue_${t.id}`,
      kind: "overdue_follow_up",
      label: t.title,
      detail: `Due ${relativeTime(t.dueAt, now)} · ${t.reason}`,
      occurredAt: t.dueAt,
      prospectId: t.prospectId,
      actionLabel: "Follow up",
      priority: t.priority,
    });
  }

  for (const a of state.appointments) {
    if (a.businessId !== businessId || a.status !== "missed") continue;
    out.push({
      id: `missed_appt_${a.id}`,
      kind: "missed_appointment",
      label: `Missed appointment — ${a.title}`,
      detail: relativeTime(a.startAt, now),
      occurredAt: a.startAt,
      prospectId: a.prospectId,
      actionLabel: "Reschedule",
      priority: "high",
    });
  }

  for (const s of state.submissions) {
    if (s.businessId !== businessId || s.status === "completed") continue;
    out.push({
      id: `incomplete_${s.id}`,
      kind: "incomplete_intake",
      label: `Incomplete intake — ${s.completion}% complete`,
      detail: `Waiting ${relativeTime(s.lastActivityAt, now)} · missing ${s.missingFields.length} fields`,
      occurredAt: s.lastActivityAt,
      prospectId: s.prospectId,
      actionLabel: "Send reminder",
      priority: s.valueEstimate >= 20_000 ? "high" : "medium",
    });
  }

  return out.sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));
}

/* -------------------------------------------------------------------------- */
/* Hot prospect ranking                                                        */
/* -------------------------------------------------------------------------- */

export interface RankedProspect {
  rank: number;
  prospect: Prospect;
  whyHot: string[];
  nextAction: NextActionType;
  nextActionLabel: string;
}

export function rankHotProspects(
  state: AppState,
  businessId: string,
  limit = 15,
): RankedProspect[] {
  return state.prospects
    .filter((p) => p.businessId === businessId && !p.doNotContact)
    .filter((p) => p.state !== "lost" && p.state !== "won" && p.state !== "customer")
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      return b.value - a.value;
    })
    .slice(0, limit)
    .map((prospect, index) => ({
      rank: index + 1,
      prospect,
      whyHot: state.scoreBreakdowns[prospect.id]?.whyHot ?? ["Ranked on overall signal strength"],
      nextAction: prospect.nextActionType ?? "follow_up",
      nextActionLabel: NEXT_ACTION_LABEL[prospect.nextActionType ?? "follow_up"],
    }));
}

/* -------------------------------------------------------------------------- */
/* Pipeline snapshot (auto-maintained)                                         */
/* -------------------------------------------------------------------------- */

export interface PipelineSnapshot {
  key: string;
  label: string;
  count: number;
  value: number;
  probability: number;
  weightedValue: number;
  color: string;
}

export function buildPipelineSnapshot(state: AppState, businessId: string): PipelineSnapshot[] {
  const pipeline =
    state.pipelines.find((p) => p.businessId === businessId && p.isDefault) ?? state.pipelines[0];
  const prospects = state.prospects.filter((p) => p.businessId === businessId);
  return pipeline.states
    .map((s) => {
      const inState = prospects.filter((p) => p.state === s.key);
      const value = inState.reduce((sum, p) => sum + p.value, 0);
      return {
        key: s.key,
        label: s.label,
        count: inState.length,
        value,
        probability: s.probability,
        weightedValue: Math.round(value * s.probability),
        color: s.color,
      };
    })
    .filter(
      (s) =>
        s.count > 0 ||
        [
          "new",
          "contacted",
          "engaged",
          "qualified",
          "appointment",
          "proposal",
          "negotiation",
        ].includes(s.key),
    );
}

/* -------------------------------------------------------------------------- */
/* Dashboard KPI helpers                                                       */
/* -------------------------------------------------------------------------- */

export interface DashboardStats {
  newLeadsToday: number;
  responsesToday: number;
  highIntent: number;
  overdueFollowUps: number;
  missedCalls: number;
  incompleteIntakes: number;
  appointmentsToday: number;
  hotCount: number;
  weightedPipeline: number;
  wonThisMonth: number;
  aiActionsToday: number;
  awaitingApproval: number;
}

export function buildDashboardStats(
  state: AppState,
  businessId: string,
  now = Date.now(),
): DashboardStats {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const dayStart = +startOfDay;
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const scoped = <T extends { businessId: string }>(items: T[]) =>
    items.filter((i) => i.businessId === businessId);
  const prospects = scoped(state.prospects);

  return {
    newLeadsToday: prospects.filter((p) => +new Date(p.createdAt) >= dayStart).length,
    responsesToday: scoped(state.communications).filter(
      (c) => c.direction === "inbound" && +new Date(c.occurredAt) >= dayStart,
    ).length,
    highIntent: prospects.filter((p) => p.intent === "high_intent" && p.state !== "lost").length,
    overdueFollowUps: scoped(state.tasks).filter(
      (t) => t.status !== "completed" && t.status !== "cancelled" && +new Date(t.dueAt) < now,
    ).length,
    missedCalls: scoped(state.communications).filter(
      (c) => c.channel === "call" && c.status === "missed" && !c.handled,
    ).length,
    incompleteIntakes: scoped(state.submissions).filter((s) => s.status !== "completed").length,
    appointmentsToday: scoped(state.appointments).filter((a) => {
      const start = +new Date(a.startAt);
      return start >= dayStart && start < dayStart + 86_400_000 && a.status !== "cancelled";
    }).length,
    hotCount: prospects.filter((p) => p.score >= 70 && p.state !== "lost").length,
    weightedPipeline: prospects
      .filter((p) => p.state !== "lost" && p.state !== "won")
      .reduce((sum, p) => sum + p.value * probabilityFor(p), 0),
    wonThisMonth: scoped(state.deals)
      .filter((d) => d.won && d.closedAt && +new Date(d.closedAt) >= +monthStart)
      .reduce((s, d) => s + d.value, 0),
    aiActionsToday: scoped(state.actions).filter((a) => +new Date(a.createdAt) >= dayStart).length,
    awaitingApproval: scoped(state.actions).filter(
      (a) => a.status === "awaiting_approval" || a.status === "proposed",
    ).length,
  };
}

function probabilityFor(p: Prospect): number {
  const map: Record<string, number> = {
    new: 0.05,
    contacted: 0.12,
    engaged: 0.28,
    qualified: 0.45,
    appointment: 0.62,
    proposal: 0.72,
    negotiation: 0.84,
    won: 1,
    customer: 1,
    lost: 0,
  };
  return map[p.state] ?? 0.3;
}

export function relativeAge(iso: string, now = Date.now()): string {
  return relativeTime(iso, now);
}
