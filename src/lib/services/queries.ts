import type {
  AppState,
  Communication,
  Company,
  Contact,
  FormSubmission,
  Prospect,
  Task,
} from "@/lib/domain/types";
import { buildPipelineSnapshot } from "@/lib/intelligence/attention";
import { effectivePermissions } from "@/lib/domain/permissions";

/** Read models for each screen. All tenant/business-scoped through the store. */

export function scoped<T extends { businessId: string }>(items: T[], businessId: string): T[] {
  return items.filter((i) => i.businessId === businessId);
}

export function prospectIndex(state: AppState, businessId: string) {
  const prospects = scoped(state.prospects, businessId);
  const byId = new Map(prospects.map((p) => [p.id, p]));
  const contactById = new Map(state.contacts.map((c) => [c.id, c]));
  const companyById = new Map(state.companies.map((c) => [c.id, c]));
  const userById = new Map(state.users.map((u) => [u.id, u]));

  return {
    prospects,
    byId,
    contactOf: (p?: Prospect | null): Contact | undefined =>
      p ? contactById.get(p.contactId) : undefined,
    companyOf: (p?: Prospect | null): Company | undefined =>
      p?.companyId ? companyById.get(p.companyId) : undefined,
    userOf: (id?: string) => (id ? userById.get(id) : undefined),
    nameOf: (p?: Prospect | null) => {
      const c = p ? contactById.get(p.contactId) : undefined;
      return c ? `${c.firstName} ${c.lastName}` : (p?.id ?? "Unknown");
    },
  };
}

/* ------------------------------- prospects -------------------------------- */

export interface ProspectFilters {
  search?: string;
  state?: string;
  intent?: string;
  ownerId?: string;
  band?: "hot" | "warm" | "cold";
  priority?: string;
  source?: string;
  awaitingReply?: boolean;
  followUpOverdue?: boolean;
  missedCall?: boolean;
  formIncomplete?: boolean;
  hasAppointment?: boolean;
  proposalOut?: boolean;
  noResponse?: boolean;
  isNew?: boolean;
  companyId?: string;
  tag?: string;
}

export function filterProspects(
  state: AppState,
  businessId: string,
  filters: ProspectFilters,
  now = Date.now(),
): Prospect[] {
  const { prospects, contactOf, companyOf } = prospectIndex(state, businessId);
  const q = filters.search?.toLowerCase().trim();

  return prospects
    .filter((p) => {
      if (q) {
        const contact = contactOf(p);
        const haystack = [
          contact?.firstName,
          contact?.lastName,
          contact?.email,
          companyOf(p)?.name,
          p.summary,
          p.tags.join(" "),
          p.state,
          p.intent,
          p.source,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.state && p.state !== filters.state) return false;
      if (filters.intent && p.intent !== filters.intent) return false;
      if (filters.ownerId && p.ownerId !== filters.ownerId) return false;
      if (filters.priority && p.priority !== filters.priority) return false;
      if (filters.source && p.source !== filters.source) return false;
      if (filters.band === "hot" && p.score < 70) return false;
      if (filters.band === "warm" && (p.score < 45 || p.score >= 70)) return false;
      if (filters.band === "cold" && p.score >= 45) return false;
      if (filters.companyId && p.companyId !== filters.companyId) return false;
      if (filters.tag && !p.tags.includes(filters.tag)) return false;

      if (filters.awaitingReply) {
        const awaiting = state.communications.some(
          (c) =>
            c.prospectId === p.id && c.direction === "inbound" && c.requiresResponse && !c.handled,
        );
        if (!awaiting) return false;
      }
      if (filters.followUpOverdue) {
        const overdue = state.tasks.some(
          (t) => t.prospectId === p.id && t.status !== "completed" && +new Date(t.dueAt) < now,
        );
        if (!overdue) return false;
      }
      if (filters.missedCall) {
        const missed = state.communications.some(
          (c) =>
            c.prospectId === p.id && c.channel === "call" && c.status === "missed" && !c.handled,
        );
        if (!missed) return false;
      }
      if (filters.formIncomplete) {
        const partial = state.submissions.some(
          (s) => s.prospectId === p.id && s.status !== "completed",
        );
        if (!partial) return false;
      }
      if (filters.hasAppointment) {
        const appt = state.appointments.some(
          (a) => a.prospectId === p.id && a.status !== "cancelled" && +new Date(a.startAt) > now,
        );
        if (!appt) return false;
      }
      if (filters.proposalOut) {
        if (!p.healthFlags.includes("proposal_sent") && p.state !== "proposal") return false;
      }
      if (filters.noResponse) {
        const anyInbound = state.communications.some(
          (c) => c.prospectId === p.id && c.direction === "inbound",
        );
        if (anyInbound) return false;
      }
      if (filters.isNew) {
        if (now - +new Date(p.createdAt) > 7 * 86_400_000) return false;
      }
      return true;
    })
    .sort((a, b) => b.score - a.score);
}

/* ----------------------------- communications ----------------------------- */

export function communicationsFor(
  state: AppState,
  businessId: string,
  channel?: Communication["channel"],
): Communication[] {
  return scoped(state.communications, businessId)
    .filter((c) => (channel ? c.channel === channel : true))
    .sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));
}

export function prospectCommunications(state: AppState, prospectId: string): Communication[] {
  return state.communications
    .filter((c) => c.prospectId === prospectId)
    .sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));
}

/* ---------------------------------- tasks --------------------------------- */

export type TaskView =
  "today" | "overdue" | "upcoming" | "ai" | "manual" | "mine" | "team" | "completed" | "all";

export function tasksFor(
  state: AppState,
  businessId: string,
  view: TaskView,
  userId: string,
  now = Date.now(),
): Task[] {
  const tasks = scoped(state.tasks, businessId);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const filter = (t: Task) => {
    switch (view) {
      case "today":
        return (
          t.status !== "completed" && t.status !== "cancelled" && +new Date(t.dueAt) <= +endOfDay
        );
      case "overdue":
        return t.status !== "completed" && t.status !== "cancelled" && +new Date(t.dueAt) < now;
      case "upcoming":
        return (
          t.status !== "completed" && t.status !== "cancelled" && +new Date(t.dueAt) > +endOfDay
        );
      case "ai":
        return t.createdByKind === "ai" || t.createdByKind === "automation";
      case "manual":
        return t.createdByKind === "user";
      case "mine":
        return t.ownerId === userId && t.status !== "completed";
      case "team":
        return t.ownerId !== userId && t.status !== "completed";
      case "completed":
        return t.status === "completed";
      default:
        return true;
    }
  };

  return tasks.filter(filter).sort((a, b) => {
    const aOverdue = +new Date(a.dueAt) < now && a.status !== "completed";
    const bOverdue = +new Date(b.dueAt) < now && b.status !== "completed";
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    return +new Date(a.dueAt) - +new Date(b.dueAt);
  });
}

/* ---------------------------------- forms --------------------------------- */

export interface FormWithStats {
  form: AppState["forms"][number];
  started: number;
  partial: number;
  completed: number;
  abandoned: number;
  submissions: FormSubmission[];
  totalValue: number;
}

export function formStats(state: AppState, businessId: string): FormWithStats[] {
  const forms = scoped(state.forms, businessId);
  const submissions = scoped(state.submissions, businessId);
  return forms.map((form) => {
    const subs = submissions.filter((s) => s.formId === form.id);
    return {
      form,
      started: subs.filter((s) => s.status === "started").length,
      partial: subs.filter((s) => s.status === "partial").length,
      completed: subs.filter((s) => s.status === "completed").length,
      abandoned: subs.filter((s) => s.status === "abandoned").length,
      submissions: subs.sort((a, b) => +new Date(b.lastActivityAt) - +new Date(a.lastActivityAt)),
      totalValue: subs.reduce((sum, s) => sum + s.valueEstimate, 0),
    };
  });
}

/* -------------------------------- calendar -------------------------------- */

export interface CalendarEvent {
  id: string;
  kind: "appointment" | "task" | "follow_up";
  title: string;
  startAt: string;
  endAt?: string;
  prospectId?: string;
  ownerId: string;
  status: string;
  detail?: string;
  aiScheduled?: boolean;
}

export function calendarEvents(
  state: AppState,
  businessId: string,
  now = Date.now(),
): CalendarEvent[] {
  const appts: CalendarEvent[] = scoped(state.appointments, businessId).map((a) => ({
    id: a.id,
    kind: "appointment",
    title: a.title,
    startAt: a.startAt,
    endAt: a.endAt,
    prospectId: a.prospectId,
    ownerId: a.ownerId,
    status: a.status,
    detail: a.aiPrep,
    aiScheduled: a.scheduledByKind === "ai",
  }));
  const tasks: CalendarEvent[] = scoped(state.tasks, businessId)
    .filter((t) => t.status !== "completed" && t.status !== "cancelled")
    .map((t) => ({
      id: t.id,
      kind: t.type === "call" ? "appointment" : "task",
      title: t.title,
      startAt: t.dueAt,
      prospectId: t.prospectId,
      ownerId: t.ownerId,
      status: +new Date(t.dueAt) < now ? "overdue" : "open",
      detail: t.reason,
      aiScheduled: t.createdByKind === "ai" || t.createdByKind === "automation",
    }));
  return [...appts, ...tasks].sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
}

/* ---------------------------------- team ---------------------------------- */

export interface MemberStats {
  userId: string;
  name: string;
  email: string;
  title: string;
  isAi: boolean;
  role: string;
  avatarColor: string;
  activeProspects: number;
  hotProspects: number;
  overdueTasks: number;
  openTasks: number;
  responsesToday: number;
  wonValue: number;
  lastActiveAt: string;
  permissions: number;
}

/* -------------------------------- analytics ------------------------------- */

export interface AnalyticsBundle {
  funnel: { label: string; count: number; value: number; conversion?: number }[];
  sources: { source: string; count: number; wonValue: number; conversion: number }[];
  activityByDay: {
    day: string;
    leads: number;
    responses: number;
    appointments: number;
    won: number;
  }[];
  responseTimes: { bucket: string; count: number }[];
  team: MemberStats[];
  aiPerformance: {
    proposed: number;
    executed: number;
    approved: number;
    rejected: number;
    reverted: number;
    approvalRate: number;
    revertRate: number;
    byType: { type: string; count: number }[];
  };
  stalePipeline: { prospect: Prospect; daysQuiet: number }[];
  lostReasons: { reason: string; count: number; value: number }[];
}

export function buildAnalytics(
  state: AppState,
  businessId: string,
  now = Date.now(),
): AnalyticsBundle {
  const prospects = scoped(state.prospects, businessId);
  const pipeline = buildPipelineSnapshot(state, businessId);
  const comms = scoped(state.communications, businessId);
  const tasks = scoped(state.tasks, businessId);
  const deals = scoped(state.deals, businessId);
  const actions = scoped(state.actions, businessId);

  const funnel = pipeline.map((stage, index, arr) => {
    const previous =
      index > 0 ? arr.slice(0, index).reduce((sum, s) => sum + s.count, 0) : undefined;
    return {
      label: stage.label,
      count: stage.count,
      value: stage.value,
      conversion: previous ? Number((stage.count / Math.max(1, previous)).toFixed(2)) : undefined,
    };
  });

  // Lead sources with conversion
  const sourceMap = new Map<string, { count: number; wonValue: number; won: number }>();
  for (const p of prospects) {
    const entry = sourceMap.get(p.source) ?? { count: 0, wonValue: 0, won: 0 };
    entry.count += 1;
    if (p.state === "won" || p.state === "customer") {
      entry.won += 1;
      entry.wonValue += p.value;
    }
    sourceMap.set(p.source, entry);
  }
  const sources = Array.from(sourceMap.entries())
    .map(([source, v]) => ({
      source,
      count: v.count,
      wonValue: v.wonValue,
      conversion: v.count ? Number(((v.won / v.count) * 100).toFixed(0)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // 14-day activity trend from the event log (not a hardcoded chart)
  const activityByDay: AnalyticsBundle["activityByDay"] = [];
  for (let i = 13; i >= 0; i--) {
    const dayStart = new Date(now - i * 86_400_000);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = +dayStart + 86_400_000;
    const label = dayStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    activityByDay.push({
      day: label,
      leads: scoped(state.events, businessId).filter(
        (e) =>
          (e.type === "LEAD_CREATED" || e.type === "LEAD_IMPORTED") &&
          +new Date(e.occurredAt) >= +dayStart &&
          +new Date(e.occurredAt) < dayEnd,
      ).length,
      responses: comms.filter(
        (c) =>
          c.direction === "inbound" &&
          +new Date(c.occurredAt) >= +dayStart &&
          +new Date(c.occurredAt) < dayEnd,
      ).length,
      appointments: scoped(state.events, businessId).filter(
        (e) =>
          e.type === "APPOINTMENT_CREATED" &&
          +new Date(e.occurredAt) >= +dayStart &&
          +new Date(e.occurredAt) < dayEnd,
      ).length,
      won: deals.filter(
        (d) =>
          d.won &&
          d.closedAt &&
          +new Date(d.closedAt) >= +dayStart &&
          +new Date(d.closedAt) < dayEnd,
      ).length,
    });
  }

  const buckets = [
    { bucket: "<15 min", test: (m: number) => m < 15 },
    { bucket: "15–60 min", test: (m: number) => m >= 15 && m < 60 },
    { bucket: "1–4 h", test: (m: number) => m >= 60 && m < 240 },
    { bucket: "4–24 h", test: (m: number) => m >= 240 && m < 1_440 },
    { bucket: ">24 h", test: (m: number) => m >= 1_440 },
  ];
  const responseTimes = buckets.map((b) => ({
    bucket: b.bucket,
    count: comms.filter((c) => c.responseTimeMinutes !== undefined && b.test(c.responseTimeMinutes))
      .length,
  }));

  const memberRows: MemberStats[] = scopedMemberRows(state, businessId, now, tasks, comms, deals);

  const aiActions = actions;
  const byType = new Map<string, number>();
  for (const a of aiActions) byType.set(a.type, (byType.get(a.type) ?? 0) + 1);

  return {
    funnel,
    sources,
    activityByDay,
    responseTimes,
    team: memberRows,
    aiPerformance: {
      proposed: aiActions.length,
      executed: aiActions.filter((a) => a.status === "executed").length,
      approved: aiActions.filter(
        (a) => a.approvedBy && (a.status === "executed" || a.status === "approved"),
      ).length,
      rejected: aiActions.filter((a) => a.status === "rejected").length,
      reverted: aiActions.filter((a) => a.status === "reverted").length,
      approvalRate: aiActions.length
        ? Number(
            (aiActions.filter((a) => a.status === "executed").length / aiActions.length).toFixed(2),
          )
        : 0,
      revertRate: aiActions.length
        ? Number(
            (aiActions.filter((a) => a.status === "reverted").length / aiActions.length).toFixed(2),
          )
        : 0,
      byType: Array.from(byType.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
    },
    stalePipeline: prospects
      .filter((p) => p.state !== "won" && p.state !== "lost" && p.state !== "customer")
      .map((p) => ({
        prospect: p,
        daysQuiet: Math.round((now - +new Date(p.lastActivityAt)) / 86_400_000),
      }))
      .filter((x) => x.daysQuiet >= 5)
      .sort((a, b) => b.prospect.value - a.prospect.value)
      .slice(0, 8),
    lostReasons: (() => {
      const map = new Map<string, { count: number; value: number }>();
      for (const d of deals.filter((x) => x.won === false)) {
        const reason = d.lostReason ?? "Reason not recorded";
        const entry = map.get(reason) ?? { count: 0, value: 0 };
        entry.count += 1;
        entry.value += d.value;
        map.set(reason, entry);
      }
      return Array.from(map.entries()).map(([reason, v]) => ({ reason, ...v }));
    })(),
  };
}

function scopedMemberRows(
  state: AppState,
  businessId: string,
  now: number,
  tasks: Task[],
  comms: Communication[],
  deals: AppState["deals"],
): MemberStats[] {
  const memberships = state.memberships.filter(
    (m) => m.businessId === businessId && m.status === "active",
  );
  return memberships.map((m) => {
    const user = state.users.find((u) => u.id === m.userId);
    const owned = state.prospects.filter(
      (p) => p.businessId === businessId && p.ownerId === m.userId,
    );
    const ownedIds = new Set(owned.map((p) => p.id));
    return {
      userId: m.userId,
      name: user?.name ?? m.userId,
      email: user?.email ?? "",
      title: user?.title ?? "",
      isAi: user?.isAi ?? false,
      role: m.roleKey,
      avatarColor: user?.avatarColor ?? "oklch(0.6 0.15 250)",
      activeProspects: owned.filter(
        (p) => p.state !== "won" && p.state !== "lost" && p.state !== "customer",
      ).length,
      hotProspects: owned.filter((p) => p.score >= 70).length,
      overdueTasks: tasks.filter(
        (t) => t.ownerId === m.userId && t.status !== "completed" && +new Date(t.dueAt) < now,
      ).length,
      openTasks: tasks.filter((t) => t.ownerId === m.userId && t.status !== "completed").length,
      responsesToday: comms.filter(
        (c) =>
          c.direction === "inbound" &&
          ownedIds.has(c.prospectId) &&
          +new Date(c.occurredAt) > now - 86_400_000,
      ).length,
      wonValue: deals
        .filter((d) => d.ownerId === m.userId && d.won)
        .reduce((s, d) => s + d.value, 0),
      lastActiveAt: user?.lastActiveAt ?? new Date(now).toISOString(),
      permissions: effectivePermissions(m).size,
    };
  });
}
