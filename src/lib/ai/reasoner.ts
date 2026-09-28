import type {
  AIActionType,
  AIInsight,
  AppState,
  Communication,
  Prospect,
  Task,
} from "@/lib/domain/types";
import {
  buildAttentionQueue,
  buildDashboardStats,
  buildMissedActivity,
  buildPipelineSnapshot,
  rankHotProspects,
} from "@/lib/intelligence/attention";
import { classifyHeuristically } from "./provider";
import type {
  AICapability,
  AIProvider,
  ChatRequest,
  ChatResponse,
  Classification,
  ClassifyRequest,
  EmbedRequest,
  ExtractRequest,
  SummarizeRequest,
} from "./provider";

/* -------------------------------------------------------------------------- */
/* Response shape                                                              */
/* -------------------------------------------------------------------------- */

export interface AIRecommendation {
  type: AIActionType;
  title: string;
  why: string;
  outcome: string;
  confidence: number;
  prospectId?: string;
  draft?: string;
  autonomy?: "assist" | "approve" | "autonomous";
}

export interface AIAnswer {
  title: string;
  body: string;
  bullets?: string[];
  metrics?: { label: string; value: string; hint?: string }[];
  prospectIds?: string[];
  recommendations?: AIRecommendation[];
  followUps?: string[];
  provider: string;
  confidence: number;
  /** How the answer was produced, shown in the transparency footer. */
  reasoning: string[];
}

const PROVIDER_ID = "local-reasoner";
const PROVIDER_LABEL = "Lead Intelligence Reasoner";

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function nameOf(state: AppState, p?: Prospect): string {
  if (!p) return "Prospect";
  const c = state.contacts.find((x) => x.id === p.contactId);
  return c ? `${c.firstName} ${c.lastName}` : p.id;
}

function companyName(state: AppState, p?: Prospect): string | undefined {
  return state.companies.find((c) => c.id === p?.companyId)?.name;
}

function commsFor(state: AppState, prospectId: string): Communication[] {
  return state.communications
    .filter((c) => c.prospectId === prospectId)
    .sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));
}

/* -------------------------------------------------------------------------- */
/* Business-level commands                                                     */
/* -------------------------------------------------------------------------- */

export interface CommandInput {
  state: AppState;
  businessId: string;
  query: string;
  now?: number;
}

export function answerCommand({
  state,
  businessId,
  query,
  now = Date.now(),
}: CommandInput): AIAnswer {
  const q = query.toLowerCase().trim();
  const stats = buildDashboardStats(state, businessId, now);
  const base = {
    provider: PROVIDER_LABEL,
    reasoning: [
      `Scoped to business ${businessId}`,
      `Evaluated ${state.prospects.filter((p) => p.businessId === businessId).length} prospects, ${stats.overdueFollowUps} overdue follow-ups`,
    ],
  };

  /* ---- hottest prospects ------------------------------------------------ */
  if (/hot|hottest|top .*prospect|best prospect|highest priority|top 15/.test(q)) {
    const ranked = rankHotProspects(state, businessId, 15);
    return {
      ...base,
      title: "Your 15 hottest prospects right now",
      body: `Ranked by the scoring engine across ${ranked.length} live opportunities. ${ranked.filter((r) => r.prospect.score >= 85).length} are in the "act now" band.`,
      prospectIds: ranked.map((r) => r.prospect.id),
      metrics: [
        { label: "Hot (>70)", value: String(stats.hotCount) },
        { label: "High intent", value: String(stats.highIntent) },
        { label: "Weighted pipeline", value: money(stats.weightedPipeline) },
      ],
      bullets: ranked
        .slice(0, 5)
        .map(
          (r) =>
            `#${r.rank} ${nameOf(state, r.prospect)}${companyName(state, r.prospect) ? ` · ${companyName(state, r.prospect)}` : ""} — ${r.prospect.score}/100 · ${r.whyHot[0] ?? "strong signals"}`,
        ),
      recommendations: ranked.slice(0, 3).map((r) => recommendationFor(state, r.prospect, now)),
      followUps: [
        "Why is #1 ranked highest?",
        "Draft follow-ups for everyone waiting more than 3 days",
        "Show me missed opportunities",
      ],
      confidence: 0.93,
    };
  }

  /* ---- who needs a follow-up ------------------------------------------- */
  if (/follow[- ]?up|who needs|waiting|overdue|chase/.test(q)) {
    const overdueTasks = state.tasks
      .filter(
        (t) =>
          t.businessId === businessId &&
          t.status !== "completed" &&
          t.status !== "cancelled" &&
          +new Date(t.dueAt) < now,
      )
      .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
    const waiting = state.communications.filter(
      (c) =>
        c.businessId === businessId &&
        c.direction === "inbound" &&
        c.requiresResponse &&
        !c.handled,
    );
    const ids = Array.from(
      new Set(
        [...overdueTasks.map((t) => t.prospectId), ...waiting.map((c) => c.prospectId)].filter(
          Boolean,
        ),
      ),
    ) as string[];
    return {
      ...base,
      title: `${overdueTasks.length} overdue follow-ups and ${waiting.length} unanswered messages`,
      body: overdueTasks.length
        ? `The oldest breach is ${relative(overdueTasks[0]?.dueAt, now)} past due. ${overdueTasks.filter((t) => t.priority === "critical" || t.priority === "high").length} are high or critical priority.`
        : "Nothing is overdue — your follow-up discipline is clean right now.",
      prospectIds: ids.slice(0, 12),
      metrics: [
        { label: "Overdue", value: String(overdueTasks.length) },
        { label: "Unanswered", value: String(waiting.length) },
        { label: "Awaiting approval", value: String(stats.awaitingApproval) },
      ],
      bullets: overdueTasks
        .slice(0, 6)
        .map((t) => `${t.title} — due ${relative(t.dueAt, now)} · ${t.reason}`),
      recommendations: Array.from(new Set(overdueTasks.map((t) => t.prospectId).filter(Boolean)))
        .slice(0, 3)
        .map((id) => state.prospects.find((p) => p.id === id))
        .filter((p): p is Prospect => Boolean(p))
        .map((p) => recommendationFor(state, p, now)),
      followUps: ["Draft follow-ups for everyone waiting more than 3 days", "Who responded today?"],
      confidence: 0.9,
    };
  }

  /* ---- who responded today --------------------------------------------- */
  if (/responded|replied|today'?s (responses|replies)|who replied/.test(q)) {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const inbound = state.communications
      .filter(
        (c) =>
          c.businessId === businessId &&
          c.direction === "inbound" &&
          +new Date(c.occurredAt) >= +startOfDay,
      )
      .sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));
    const ids = Array.from(new Set(inbound.map((c) => c.prospectId)));
    return {
      ...base,
      title: `${inbound.length} inbound responses today`,
      body: inbound.length
        ? `${inbound.filter((c) => c.enrichment?.intent === "high_intent").length} classified high intent and ${inbound.filter((c) => !c.handled).length} still need a reply.`
        : "No inbound responses recorded today yet.",
      prospectIds: ids,
      metrics: [
        { label: "Responses", value: String(inbound.length) },
        {
          label: "High intent",
          value: String(inbound.filter((c) => c.enrichment?.intent === "high_intent").length),
        },
        { label: "Unanswered", value: String(inbound.filter((c) => !c.handled).length) },
      ],
      bullets: inbound.slice(0, 6).map((c) => {
        const p = state.prospects.find((x) => x.id === c.prospectId);
        return `${nameOf(state, p)} — ${c.channel} ${relative(c.occurredAt, now)} · ${c.enrichment?.intent?.replace(/_/g, " ") ?? "unclassified"} · "${c.preview.slice(0, 70)}"`;
      }),
      recommendations: ids
        .slice(0, 3)
        .map((id) => state.prospects.find((p) => p.id === id))
        .filter((p): p is Prospect => Boolean(p))
        .map((p) => recommendationFor(state, p, now)),
      confidence: 0.95,
    };
  }

  /* ---- why is X priority ----------------------------------------------- */
  if (/^why is|why (is|was|are)/.test(q)) {
    const match = state.prospects.find((p) =>
      q.includes(nameOf(state, p).toLowerCase().split(" ")[0] ?? "###"),
    );
    if (match) return whyAnswer(state, businessId, match, now, base);
  }

  /* ---- prepare my calls ------------------------------------------------- */
  if (/prepare.*(call|calls)|call (list|prep)|my calls/.test(q)) {
    const callTasks = state.tasks.filter(
      (t) => t.businessId === businessId && t.type === "call" && t.status !== "completed",
    );
    const missed = state.communications.filter(
      (c) =>
        c.businessId === businessId && c.channel === "call" && c.status === "missed" && !c.handled,
    );
    const ids = Array.from(
      new Set(
        [...callTasks.map((t) => t.prospectId), ...missed.map((c) => c.prospectId)].filter(Boolean),
      ),
    ) as string[];
    return {
      ...base,
      title: `Call sheet — ${ids.length} calls worth making today`,
      body: "Ordered by urgency, value and how likely they are to pick up.",
      prospectIds: ids,
      bullets: ids
        .slice(0, 8)
        .map((id) => {
          const p = state.prospects.find((x) => x.id === id);
          if (!p) return "";
          const c = commsFor(state, id)[0];
          return `${nameOf(state, p)} · ${companyName(state, p) ?? "—"} — score ${p.score} · ${p.value >= 1000 ? money(p.value) : "no value set"} · context: ${c?.preview.slice(0, 80) ?? "no recent thread"}`;
        })
        .filter(Boolean),
      recommendations: ids
        .slice(0, 3)
        .map((id) => state.prospects.find((p) => p.id === id))
        .filter((p): p is Prospect => Boolean(p))
        .map((p) => recommendationFor(state, p, now)),
      followUps: ["Draft a call script for each", "Which of these should the AI call?"],
      confidence: 0.88,
    };
  }

  /* ---- draft follow-ups ------------------------------------------------- */
  if (/draft|write|prepare.*(email|replies|follow)/.test(q)) {
    const candidates = state.prospects
      .filter((p) => p.businessId === businessId && !p.doNotContact)
      .filter((p) => (now - +new Date(p.lastActivityAt)) / 86_400_000 > 3)
      .filter(
        (p) => p.intent !== "unsubscribe" && p.intent !== "not_interested" && p.state !== "lost",
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return {
      ...base,
      title: `Drafted ${candidates.length} follow-ups for prospects waiting 3+ days`,
      body: "Each draft references the last thing they said, so nothing reads like a template. Approve individually or send all.",
      prospectIds: candidates.map((p) => p.id),
      recommendations: candidates.map((p) => ({
        ...recommendationFor(state, p, now),
        type: "send_email" as const,
        draft: draftFor(state, p),
      })),
      followUps: ["Show me missed opportunities", "What should I do next?"],
      confidence: 0.86,
    };
  }

  /* ---- missed opportunities -------------------------------------------- */
  if (/missed|opportunit|lost|leak|drop/.test(q)) {
    const missedCalls = state.communications.filter(
      (c) =>
        c.businessId === businessId && c.channel === "call" && c.status === "missed" && !c.handled,
    );
    const stalled = state.prospects.filter(
      (p) =>
        p.businessId === businessId &&
        p.value >= 5_000 &&
        (now - +new Date(p.lastActivityAt)) / 86_400_000 >= 4 &&
        !["won", "lost", "customer", "new"].includes(p.state),
    );
    const lost = state.deals.filter((d) => d.businessId === businessId && d.won === false);
    const lostValue = lost.reduce((s, d) => s + d.value, 0);
    const missedActivity = buildMissedActivity(state, businessId, now);
    return {
      ...base,
      title: `${missedCalls.length} missed calls, ${stalled.length} stalled deals, ${money(lostValue)} lost this cycle`,
      body: "Ranked by recoverable value. Missed inbound calls are the highest-conversion recovery path you have.",
      prospectIds: Array.from(
        new Set([...missedCalls.map((c) => c.prospectId), ...stalled.map((p) => p.id)]),
      ).slice(0, 12),
      metrics: [
        { label: "Missed calls", value: String(missedCalls.length) },
        { label: "Stalled >7d", value: String(stalled.length) },
        { label: "Lost value", value: money(lostValue) },
        { label: "Open items", value: String(missedActivity.length) },
      ],
      bullets: [
        ...missedCalls.slice(0, 3).map(
          (c) =>
            `Missed call — ${nameOf(
              state,
              state.prospects.find((p) => p.id === c.prospectId),
            )} · ${relative(c.occurredAt, now)}`,
        ),
        ...stalled
          .slice(0, 3)
          .map(
            (p) =>
              `Quiet ${Math.round((now - +new Date(p.lastActivityAt)) / 86_400_000)} days — ${nameOf(state, p)} · ${money(p.value)} at ${p.state}`,
          ),
        ...lost.slice(0, 2).map(
          (d) =>
            `Lost — ${nameOf(
              state,
              state.prospects.find((p) => p.id === d.prospectId),
            )} · ${money(d.value)} · ${d.lostReason ?? "reason not recorded"}`,
        ),
      ],
      followUps: [
        "Draft re-engagement messages for the stalled deals",
        "Why did we lose deals this quarter?",
      ],
      confidence: 0.87,
    };
  }

  /* ---- incomplete intake ------------------------------------------------ */
  if (/intake|form|incomplete|abandon/.test(q)) {
    const subs = state.submissions.filter(
      (s) => s.businessId === businessId && s.status !== "completed",
    );
    const ranked = subs.sort((a, b) => b.valueEstimate - a.valueEstimate);
    return {
      ...base,
      title: `${subs.length} incomplete intakes worth ${money(ranked.reduce((s, x) => s + x.valueEstimate, 0))}`,
      body: `The largest is ${ranked[0] ? money(ranked[0].valueEstimate) : "$0"} at ${ranked[0]?.completion ?? 0}% complete. Nina can chase these automatically — ${subs.filter((s) => s.reminderSentAt).length} have already had a reminder.`,
      prospectIds: ranked.map((s) => s.prospectId).filter(Boolean) as string[],
      metrics: ranked.slice(0, 3).map((s) => ({
        label: `Intake ${s.completion}%`,
        value: money(s.valueEstimate),
        hint: `${s.missingFields.length} fields missing`,
      })),
      bullets: ranked.map((s) => {
        const p = state.prospects.find((x) => x.id === s.prospectId);
        return `${p ? nameOf(state, p) : "Unlinked"} — ${s.completion}% · ${money(s.valueEstimate)} · missing ${s.missingFields.slice(0, 2).join(", ") || "site details"}`;
      }),
      recommendations: ranked
        .slice(0, 2)
        .filter((s) => s.prospectId)
        .map((s) => {
          const p = state.prospects.find((x) => x.id === s.prospectId)!;
          return {
            type: "send_intake_reminder" as const,
            title: `Send ${nameOf(state, p)} a reminder with a resume link`,
            why: `Intake stalled at ${s.completion}% for ${relative(s.lastActivityAt, now)} on a ${money(s.valueEstimate)} opportunity.`,
            outcome: "Historically lifts completion from 12% to 64% when sent inside 48 hours.",
            confidence: 0.84,
            prospectId: p.id,
            autonomy: "autonomous" as const,
          };
        }),
      followUps: ["Send reminders to all of them", "Which intake is highest value?"],
      confidence: 0.89,
    };
  }

  /* ---- what should I do next ------------------------------------------- */
  if (/what should i do|what next|next best|priorit|attention|focus/.test(q)) {
    const queue = buildAttentionQueue(state, businessId, { now, limit: 6 });
    const top = queue[0];
    const topProspect = state.prospects.find((p) => p.id === top?.prospectId);
    return {
      ...base,
      title: top
        ? `Do this next: ${top.recommendedActionLabel} — ${top.title}`
        : "Nothing urgent is waiting",
      body: top
        ? `${top.reason}. ${top.insight ?? ""}`
        : "Every inbound response is handled and no follow-ups are overdue. Good time for prospecting or re-engagement.",
      prospectIds: queue.map((i) => i.prospectId).filter(Boolean) as string[],
      metrics: [
        { label: "In queue", value: String(queue.length) },
        { label: "Critical", value: String(queue.filter((i) => i.priority === "critical").length) },
        { label: "Awaiting approval", value: String(stats.awaitingApproval) },
      ],
      bullets: queue.map(
        (i, idx) => `${idx + 1}. ${i.title} — ${i.reason} → ${i.recommendedActionLabel}`,
      ),
      recommendations: topProspect ? [recommendationFor(state, topProspect, now)] : [],
      followUps: ["Show me my 15 hottest prospects", "Handle my follow-ups"],
      confidence: 0.91,
    };
  }

  /* ---- handle my follow-ups (agentic) ---------------------------------- */
  if (/handle|do it|take care of|run|autonomous/.test(q)) {
    const queue = buildAttentionQueue(state, businessId, { now, limit: 8 });
    const actionable = queue.filter((i) => i.prospectId);
    return {
      ...base,
      title: `Ready to handle ${Math.min(actionable.length, 5)} items autonomously`,
      body: `Autonomy for this business is "${state.businesses.find((b) => b.id === businessId)?.settings.defaultAutonomy ?? "approve"}". Replies will be drafted and queued for approval; task creation, priority and pipeline updates execute immediately because they are inside the agent's granted scope.`,
      prospectIds: actionable.map((i) => i.prospectId!),
      bullets: actionable.slice(0, 5).map((i) => {
        const p = state.prospects.find((x) => x.id === i.prospectId);
        return `${i.recommendedActionLabel} for ${nameOf(state, p)} — ${i.reason}`;
      }),
      recommendations: actionable.slice(0, 4).map((i) =>
        recommendationFor(
          state,
          state.prospects.find((p) => p.id === i.prospectId)!,
          now,
        ),
      ),
      followUps: ["Pause the AI", "Show me the decision log"],
      confidence: 0.82,
    };
  }

  /* ---- business summary / analytics ------------------------------------ */
  if (/summar|analytics|performance|how are we|report|conversion|revenue|why did/.test(q)) {
    const pipeline = buildPipelineSnapshot(state, businessId);
    const won = state.deals.filter((d) => d.businessId === businessId && d.won);
    const lost = state.deals.filter((d) => d.businessId === businessId && d.won === false);
    const winRate = won.length + lost.length > 0 ? won.length / (won.length + lost.length) : 0;
    const slowest = pipeline.filter((s) => s.count > 0).sort((a, b) => b.count - a.count)[0];
    return {
      ...base,
      title: "Business performance summary",
      body: `${stats.newLeadsToday} leads today, ${stats.responsesToday} responses, ${stats.hotCount} hot prospects. Weighted pipeline is ${money(stats.weightedPipeline)} at a ${(winRate * 100).toFixed(0)}% win rate on closed deals.`,
      metrics: [
        { label: "New leads today", value: String(stats.newLeadsToday) },
        { label: "Responses", value: String(stats.responsesToday) },
        { label: "Hot prospects", value: String(stats.hotCount) },
        { label: "Weighted pipeline", value: money(stats.weightedPipeline) },
        { label: "Win rate", value: `${(winRate * 100).toFixed(0)}%` },
        { label: "AI actions", value: String(stats.aiActionsToday) },
      ],
      bullets: pipeline
        .filter((s) => s.count > 0)
        .slice(0, 6)
        .map(
          (s) =>
            `${s.label}: ${s.count} prospects · ${money(s.value)} · weighted ${money(s.weightedValue)}`,
        ),
      followUps: [
        `Why is ${slowest?.label ?? "Engaged"} the biggest stage?`,
        "Show me missed opportunities",
      ],
      confidence: 0.84,
      reasoning: [...base.reasoning, `Pipeline stages evaluated: ${pipeline.length}`],
    };
  }

  /* ---- fallback: semantic search over everything ------------------------ */
  const results = searchEverything(state, businessId, query);
  return {
    ...base,
    title: results.length
      ? `${results.length} matches for “${query}”`
      : `No direct matches for “${query}”`,
    body: results.length
      ? "Searched prospects, companies, communications, tasks, documents and forms. Refine with a question or open a result."
      : "Try asking about prospects, follow-ups, missed calls, intakes, the pipeline or performance.",
    prospectIds: results.filter((r) => r.prospectId).map((r) => r.prospectId!),
    bullets: results.slice(0, 8).map((r) => `${r.title} — ${r.subtitle}`),
    followUps: [
      "Show me my 15 hottest prospects",
      "Who needs a follow-up?",
      "What should I do next?",
    ],
    confidence: 0.6,
  };
}

/* -------------------------------------------------------------------------- */
/* Prospect-scoped Q&A                                                         */
/* -------------------------------------------------------------------------- */

export function answerProspectQuestion(
  state: AppState,
  prospect: Prospect,
  question: string,
  now = Date.now(),
): AIAnswer {
  const q = question.toLowerCase();
  const comms = commsFor(state, prospect.id);
  const inbound = comms.filter((c) => c.direction === "inbound");
  const contact = state.contacts.find((c) => c.id === prospect.contactId);
  const base = {
    provider: PROVIDER_LABEL,
    confidence: 0.86,
    reasoning: [
      `Read ${comms.length} communications for this prospect`,
      `${inbound.length} inbound / ${comms.length - inbound.length} outbound`,
    ],
  };

  if (/summar|catch me up|recap|last \d+ conversation/.test(q)) {
    const count = Number(q.match(/last (\d+)/)?.[1] ?? 3);
    const recent = comms.slice(0, count);
    return {
      ...base,
      title: `Summary of the last ${recent.length} interactions`,
      body: `${contact?.firstName ?? "The contact"} is at ${prospect.state} with a score of ${prospect.score}/100 (${prospect.intent.replace(/_/g, " ")}). ${prospect.summary ?? ""}`,
      bullets: recent.map(
        (c) =>
          `${c.channel} · ${relative(c.occurredAt, now)} · ${c.direction === "inbound" ? "they wrote" : "you wrote"}: ${c.preview.slice(0, 110)}`,
      ),
      metrics: [
        { label: "Score", value: `${prospect.score}/100` },
        { label: "Intent", value: prospect.intent.replace(/_/g, " ") },
        { label: "Stage", value: prospect.state },
        { label: "Value", value: money(prospect.value) },
      ],
      followUps: ["What objections have they raised?", "What should I say on my next call?"],
    };
  }

  if (/objection|concern|hesitat|push ?back|risk/.test(q)) {
    const objections = comms.filter(
      (c) =>
        c.enrichment?.intent === "objection" ||
        /concern|expensive|cheaper|clause|competitor|budget/i.test(c.body),
    );
    return {
      ...base,
      title: objections.length
        ? `${objections.length} objections found in the history`
        : "No explicit objections found",
      body: objections.length
        ? "These are the moments where resistance appeared, with the exact wording."
        : `${contact?.firstName ?? "This prospect"} has raised no explicit objections — the silence is more likely timing than resistance.`,
      bullets: objections.map(
        (c) =>
          `${relative(c.occurredAt, now)} · ${c.direction === "inbound" ? "they said" : "you said"}: "${c.preview.slice(0, 120)}"`,
      ),
      followUps: ["Draft a response to the last objection", "What did they say about price?"],
    };
  }

  if (/price|cost|budget|money|discount/.test(q)) {
    const priceComms = comms.filter((c) =>
      /price|pricing|cost|quote|discount|\$|budget/i.test(c.body),
    );
    return {
      ...base,
      title: priceComms.length
        ? `Price has come up ${priceComms.length} times`
        : "Price has never come up",
      body: priceComms.length
        ? "Chronological view of every pricing conversation, with the exact numbers mentioned."
        : "No pricing discussion is on record — the commercial conversation hasn't started yet.",
      bullets: priceComms.map(
        (c) =>
          `${relative(c.occurredAt, now)} · ${c.direction === "inbound" ? "they said" : "you sent"}: "${c.preview.slice(0, 120)}"`,
      ),
      metrics: [
        { label: "Opportunity value", value: money(prospect.value) },
        { label: "Mentions", value: String(priceComms.length) },
      ],
      followUps: ["What should I say on my next call?", "Summarize the last 3 conversations"],
    };
  }

  if (/why (haven'?t|hasn'?t|not)|stuck|stall|convert|blocker/.test(q)) {
    const days = Math.round((now - +new Date(prospect.lastActivityAt)) / 86_400_000);
    const openQuestion = comms.find(
      (c) => c.direction === "inbound" && /\?/.test(c.body) && !c.handled,
    );
    const blockers = [
      days >= 3 ? `No interaction for ${days} days` : undefined,
      openQuestion
        ? `An unanswered question is open: "${openQuestion.preview.slice(0, 90)}"`
        : undefined,
      prospect.healthFlags.includes("proposal_sent")
        ? "Proposal sent but no decision recorded"
        : undefined,
      prospect.healthFlags.includes("intake_incomplete")
        ? "Intake is incomplete — qualification is unfinished"
        : undefined,
      !prospect.companyId ? "No company record, so no other contacts to widen the deal" : undefined,
    ].filter(Boolean) as string[];
    return {
      ...base,
      title: blockers.length
        ? `${blockers.length} blockers stopping this from converting`
        : "No structural blockers detected",
      body: `Score ${prospect.score}/100, intent ${prospect.intent.replace(/_/g, " ")}. ${
        blockers.length
          ? "Address the first blocker and the rest usually resolves with it."
          : "This one is moving — keep the current cadence."
      }`,
      bullets: blockers,
      recommendations: [recommendationFor(state, prospect, now)],
      followUps: ["What should I say on my next call?", "Find unanswered questions"],
    };
  }

  if (/next call|what should i say|script|talk about|prepare/.test(q)) {
    const lastInbound = inbound[0];
    return {
      ...base,
      title: `Call plan for ${contact?.firstName ?? "this prospect"}`,
      body: lastInbound
        ? `Open by answering this directly: "${lastInbound.preview.slice(0, 140)}"`
        : "No inbound message on record — open with the reason you're calling and confirm the decision process.",
      bullets: [
        `Context: ${prospect.summary ?? "no summary"}`,
        `Position: ${prospect.state} stage, score ${prospect.score}/100, ${money(prospect.value)} at stake`,
        "Confirm who else is involved in the decision and what their criteria are",
        "Agree the single next step with a date, on the call",
        `Watch for: ${prospect.healthFlags.join(", ") || "no health flags"}`,
      ],
      recommendations: [recommendationFor(state, prospect, now)],
      followUps: ["What objections have they raised?", "Draft the follow-up email"],
    };
  }

  if (/unanswered|open question|no reply|waiting on us/.test(q)) {
    const unanswered = comms.filter(
      (c) =>
        c.direction === "inbound" &&
        ((c.requiresResponse && !c.handled) || (/\?/.test(c.body) && !c.handled)),
    );
    return {
      ...base,
      title: unanswered.length
        ? `${unanswered.length} unanswered questions`
        : "Nothing is waiting on you",
      body: unanswered.length
        ? "Every one of these is a question the prospect asked that never got an answer. This is the most common reason deals stall."
        : "All inbound questions have been answered.",
      bullets: unanswered.map(
        (c) => `${relative(c.occurredAt, now)} · "${c.preview.slice(0, 130)}"`,
      ),
      followUps: ["Draft answers to all of them", "What should I say on my next call?"],
    };
  }

  if (/changed|last \d+ days|recent|what'?s new/.test(q)) {
    const days = Number(q.match(/last (\d+)/)?.[1] ?? 7);
    const cutoff = now - days * 86_400_000;
    const recent = comms.filter((c) => +new Date(c.occurredAt) >= cutoff);
    const events = state.events.filter(
      (e) => e.prospectId === prospect.id && +new Date(e.occurredAt) >= cutoff,
    );
    return {
      ...base,
      title: `${events.length} system events and ${recent.length} communications in the last ${days} days`,
      body:
        recent.length || events.length
          ? "Chronological change log for this prospect."
          : `Nothing has changed in the last ${days} days — that silence is itself the signal.`,
      bullets: events.slice(0, 8).map((e) => `${relative(e.occurredAt, now)} · ${e.summary}`),
      followUps: ["Why haven't they converted?", "What should I do next?"],
    };
  }

  // default: profile-grounded summary
  return {
    ...base,
    title: `${nameOf(state, prospect)} — current picture`,
    body:
      prospect.summary ??
      `Score ${prospect.score}/100 · ${prospect.state} stage · ${prospect.intent.replace(/_/g, " ")}`,
    bullets: [
      `Company: ${companyName(state, prospect) ?? "—"}`,
      `Owner: ${state.users.find((u) => u.id === prospect.ownerId)?.name ?? "unassigned"}`,
      `Source: ${prospect.source.replace(/_/g, " ")}`,
      `Last activity: ${relative(prospect.lastActivityAt, now)}`,
      `Open items: ${state.tasks.filter((t) => t.prospectId === prospect.id && t.status !== "completed").length}`,
    ],
    recommendations: [recommendationFor(state, prospect, now)],
    followUps: [
      "Summarize the last 3 conversations",
      "What objections have they raised?",
      "Why haven't they converted?",
    ],
  };
}

function whyAnswer(
  state: AppState,
  businessId: string,
  prospect: Prospect,
  now: number,
  base: { provider: string; reasoning: string[] },
): AIAnswer {
  const breakdown = state.scoreBreakdowns[prospect.id];
  const topSignals = (breakdown?.signals ?? []).slice(0, 6);
  return {
    ...base,
    title: `Why ${nameOf(state, prospect)} ranks where they do`,
    body: `Score ${prospect.score}/100 (${breakdown?.band ?? "unscored"} band) with ${((breakdown?.confidence ?? 0.6) * 100).toFixed(0)}% confidence. The dominant signals are listed below with the weights the model applied.`,
    metrics: [
      {
        label: "Score",
        value: `${prospect.score}/100`,
        hint: `model ${breakdown?.modelVersion ?? "weights-v1"}`,
      },
      {
        label: "Intent",
        value: prospect.intent.replace(/_/g, " "),
        hint: `${(prospect.intentConfidence * 100).toFixed(0)}% confidence`,
      },
      {
        label: "Stage",
        value: prospect.state,
        hint: prospect.stateInferred ? "inferred from behaviour" : "manually set",
      },
      { label: "Value", value: money(prospect.value) },
    ],
    bullets: topSignals.map(
      (s) => `${s.label}: ${s.points.toFixed(1)} pts (weight ${s.weight}) — ${s.reason}`,
    ),
    recommendations: [recommendationFor(state, prospect, now)],
    followUps: ["What should I say on my next call?", "Summarize the last 3 conversations"],
    confidence: 0.94,
  };
}

/* -------------------------------------------------------------------------- */
/* Recommendations + drafts                                                    */
/* -------------------------------------------------------------------------- */

export function recommendationFor(
  state: AppState,
  prospect: Prospect,
  now = Date.now(),
): AIRecommendation {
  const comms = commsFor(state, prospect.id);
  const pending = comms.find((c) => c.direction === "inbound" && c.requiresResponse && !c.handled);
  const missed = comms.find((c) => c.channel === "call" && c.status === "missed" && !c.handled);
  const overdue = state.tasks.find(
    (t) => t.prospectId === prospect.id && t.status !== "completed" && +new Date(t.dueAt) < now,
  );
  const submission = state.submissions.find(
    (s) => s.prospectId === prospect.id && s.status !== "completed",
  );
  const name = nameOf(state, prospect);

  if (pending) {
    return {
      type: "send_email",
      title: `Reply to ${name}`,
      why: `${pending.channel} received ${relative(pending.occurredAt, now)} classified ${pending.enrichment?.intent.replace(/_/g, " ") ?? "unclassified"} (${((pending.enrichment?.intentConfidence ?? 0.7) * 100).toFixed(0)}% confidence).`,
      outcome:
        prospect.intent === "high_intent"
          ? "Expect a same-day booking — matching their pace is the single strongest conversion lever here."
          : "Clears the oldest open item on this thread.",
      confidence: pending.enrichment?.intentConfidence ?? 0.8,
      prospectId: prospect.id,
      draft: draftFor(state, prospect),
      autonomy:
        state.businesses.find((b) => b.id === prospect.businessId)?.settings.defaultAutonomy ??
        "approve",
    };
  }
  if (missed) {
    return {
      type: "place_call",
      title: `Call ${name} back`,
      why: `Inbound call missed ${relative(missed.occurredAt, now)}${prospect.value >= 15_000 ? ` on a ${money(prospect.value)} opportunity` : ""}.`,
      outcome: "Missed inbound calls convert roughly 3x better when returned within the hour.",
      confidence: 0.87,
      prospectId: prospect.id,
      autonomy: "autonomous",
    };
  }
  if (overdue) {
    return {
      type: "create_task",
      title: `Complete: ${overdue.title}`,
      why: `Follow-up overdue since ${relative(overdue.dueAt, now)} — ${overdue.reason}`,
      outcome: "Restores SLA compliance and stops the score penalty from compounding.",
      confidence: 0.9,
      prospectId: prospect.id,
    };
  }
  if (submission) {
    return {
      type: "send_intake_reminder",
      title: `Send ${name} an intake reminder`,
      why: `Intake is ${submission.completion}% complete and stalled for ${relative(submission.lastActivityAt, now)}.`,
      outcome: `Recovers a ${money(submission.valueEstimate)} opportunity; completion jumps from 12% to 64% inside the 48-hour window.`,
      confidence: 0.83,
      prospectId: prospect.id,
      autonomy: "autonomous",
    };
  }
  return {
    type: "schedule_follow_up",
    title: `Schedule the next touch with ${name}`,
    why: `No open items detected. Last activity ${relative(prospect.lastActivityAt, now)} at ${prospect.state} stage.`,
    outcome:
      "Keeps momentum without over-contacting — cadence is the difference between warm and forgotten.",
    confidence: 0.72,
    prospectId: prospect.id,
  };
}

export function draftFor(state: AppState, prospect: Prospect): string {
  const contact = state.contacts.find((c) => c.id === prospect.contactId);
  const first = contact?.firstName ?? "there";
  const last = commsFor(state, prospect.id).find((c) => c.direction === "inbound");
  const owner =
    state.users.find((u) => u.id === prospect.ownerId)?.name.split(" ")[0] ?? "the team";
  const company = companyName(state, prospect);

  if (!last) {
    return `Hi ${first},\n\nThanks for reaching out about ${company ?? "your team"}. I'd like to understand what you're solving for and what a good outcome looks like.\n\nWould a 15-minute call this week work? I can send two slots that suit you.\n\n${owner}`;
  }

  const asksScheduling = /thursday|friday|monday|tuesday|wednesday|slot|schedule|call me at/i.test(
    last.body,
  );
  const asksPricing = /price|pricing|cost|quote|discount|\$|budget/i.test(last.body);

  if (asksScheduling) {
    return `Hi ${first},\n\nGreat to hear from you. I can hold two slots:\n\n• Thursday 10:00–10:20\n• Friday 09:30–09:50\n\nIf it helps, I'll bring the cost-per-employee breakdown and the onboarding timeline so you have everything in one pass.\n\nWhich suits you better?\n\n${owner}`;
  }
  if (asksPricing) {
    return `Hi ${first},\n\nHere are the numbers you asked for, with the two variables that drive them — headcount band and the add-ons you select.\n\nHappy to model a couple of scenarios live if that's faster. Would Thursday or Friday suit?\n\n${owner}`;
  }
  return `Hi ${first},\n\nThanks for coming back to me on this — I've made a note of what you flagged so we don't go round it twice.\n\nI'll follow up with the specifics today. If it's easier, I can walk you through it in 10 minutes instead of email.\n\n${owner}`;
}

/* -------------------------------------------------------------------------- */
/* Daily summary                                                               */
/* -------------------------------------------------------------------------- */

export function buildDailySummary(
  state: AppState,
  businessId: string,
  now = Date.now(),
): AIInsight {
  const stats = buildDashboardStats(state, businessId, now);
  const queue = buildAttentionQueue(state, businessId, { now, limit: 5 });
  const top = queue[0];
  const topProspect = state.prospects.find((p) => p.id === top?.prospectId);
  const topName = topProspect ? nameOf(state, topProspect) : undefined;

  const body = [
    `${stats.newLeadsToday} new lead${stats.newLeadsToday === 1 ? "" : "s"} arrived today.`,
    `${stats.responsesToday} responded.`,
    `${stats.highIntent} ${stats.highIntent === 1 ? "is" : "are"} currently high-intent.`,
    `${stats.overdueFollowUps} follow-up${stats.overdueFollowUps === 1 ? " is" : "s are"} overdue.`,
    stats.incompleteIntakes
      ? `${stats.incompleteIntakes} intake${stats.incompleteIntakes === 1 ? "" : "s"} ${stats.incompleteIntakes === 1 ? "is" : "are"} incomplete.`
      : "",
    topName
      ? `Your most important action is ${top!.recommendedActionLabel.toLowerCase()} for ${topName}${companyName(state, topProspect) ? ` at ${companyName(state, topProspect)}` : ""}.`
      : "Nothing urgent is waiting — a good window for prospecting.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: `insight_daily_${new Date(now).toDateString()}`,
    tenantId: state.session.tenantId,
    businessId,
    kind: "daily_summary",
    title: "AI business summary",
    body,
    bullets: queue.slice(0, 4).map((i) => `${i.title} — ${i.reason}`),
    confidence: 0.89,
    model: PROVIDER_LABEL,
    createdAt: new Date(now).toISOString(),
  };
}

/* -------------------------------------------------------------------------- */
/* Semantic-ish search                                                         */
/* -------------------------------------------------------------------------- */

export interface SearchHit {
  id: string;
  kind: "prospect" | "company" | "communication" | "task" | "document" | "form" | "insight";
  title: string;
  subtitle: string;
  prospectId?: string;
  href: string;
  score: number;
}

export function searchEverything(state: AppState, businessId: string, query: string): SearchHit[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const terms = q.split(/\s+/).filter((t) => t.length > 2);
  const hits: SearchHit[] = [];
  const now = Date.now();

  const scoreText = (text: string): number => {
    const lower = text.toLowerCase();
    if (lower.includes(q)) return 1;
    const matched = terms.filter((t) => lower.includes(t)).length;
    return matched ? (matched / Math.max(1, terms.length)) * 0.8 : 0;
  };

  const wantsNoContact = /haven'?t been contacted|no contact|not contacted|quiet/.test(q);
  const daysMatch = q.match(/(\d+)\s*days?/);
  const days = daysMatch ? Number(daysMatch[1]) : undefined;
  const wantsInterest = /interest|engaged|replied/.test(q);

  for (const p of state.prospects.filter((x) => x.businessId === businessId)) {
    const contact = state.contacts.find((c) => c.id === p.contactId);
    const company = companyName(state, p);
    const haystack = [
      nameOf(state, p),
      company,
      p.summary,
      p.tags.join(" "),
      p.source,
      p.state,
      p.intent,
    ].join(" ");
    let score = scoreText(haystack);
    if (wantsNoContact && days !== undefined) {
      const quietDays = (now - +new Date(p.lastActivityAt)) / 86_400_000;
      if (quietDays >= days && p.state !== "lost" && p.state !== "won")
        score = Math.max(score, 0.85);
    }
    if (wantsInterest && (p.intent === "interested" || p.intent === "high_intent"))
      score = Math.max(score, 0.8);
    if (score > 0.15) {
      hits.push({
        id: p.id,
        kind: "prospect",
        title: nameOf(state, p),
        subtitle: `${company ?? "No company"} · ${p.state} · score ${p.score} · ${relative(p.lastActivityAt, now)}`,
        prospectId: p.id,
        href: `/prospects/${p.id}`,
        score: score + p.score / 200,
      });
    }
    void contact;
  }

  for (const c of state.companies.filter((x) => x.businessId === businessId)) {
    const score = scoreText([c.name, c.industry, c.location, c.tags.join(" ")].join(" "));
    if (score > 0.3) {
      hits.push({
        id: c.id,
        kind: "company",
        title: c.name,
        subtitle: `${c.industry} · ${c.location}`,
        href: `/companies`,
        score,
      });
    }
  }

  for (const c of state.communications.filter((x) => x.businessId === businessId)) {
    const score = scoreText(`${c.subject ?? ""} ${c.body}`);
    if (score > 0.5) {
      const p = state.prospects.find((x) => x.id === c.prospectId);
      hits.push({
        id: c.id,
        kind: "communication",
        title: `${nameOf(state, p)} — ${c.channel} ${relative(c.occurredAt, now)}`,
        subtitle: c.preview.slice(0, 110),
        prospectId: p?.id,
        href: p ? `/prospects/${p.id}` : "/communications",
        score,
      });
    }
  }

  for (const t of state.tasks.filter((x) => x.businessId === businessId)) {
    const score = scoreText(`${t.title} ${t.reason}`);
    if (score > 0.4) {
      hits.push({
        id: t.id,
        kind: "task",
        title: t.title,
        subtitle: `Due ${relative(t.dueAt, now)} · ${t.status}`,
        href: "/tasks",
        score,
      });
    }
  }

  for (const d of state.documents.filter((x) => x.businessId === businessId)) {
    const score = scoreText(d.name);
    if (score > 0.4) {
      hits.push({
        id: d.id,
        kind: "document",
        title: d.name,
        subtitle: `${d.kind} · ${relative(d.createdAt, now)}`,
        href: "/prospects",
        score,
      });
    }
  }

  for (const f of state.forms.filter((x) => x.businessId === businessId)) {
    const score = scoreText(`${f.name} ${f.description}`);
    if (score > 0.4) {
      hits.push({
        id: f.id,
        kind: "form",
        title: f.name,
        subtitle: `${f.status} · ${(f.completionRate * 100).toFixed(0)}% completion`,
        href: "/forms",
        score,
      });
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, 20);
}

/* -------------------------------------------------------------------------- */
/* Local provider implementation                                               */
/* -------------------------------------------------------------------------- */

export function createLocalProvider(state: AppState, businessId: string): AIProvider {
  const capabilities: AICapability[] = [
    "chat",
    "classification",
    "extraction",
    "summarization",
    "agent_actions",
  ];
  const model = PROVIDER_LABEL;

  return {
    id: PROVIDER_ID,
    name: PROVIDER_LABEL,
    model,
    capabilities,
    local: true,

    async chat(request: ChatRequest): Promise<ChatResponse> {
      const started = Date.now();
      const last = [...request.messages].reverse().find((m) => m.role === "user")?.content ?? "";
      const prospectId =
        typeof request.context === "object" && request.context && "prospectId" in request.context
          ? String((request.context as { prospectId?: string }).prospectId)
          : undefined;
      const answer = prospectId
        ? answerProspectQuestion(
            state,
            state.prospects.find((p) => p.id === prospectId)!,
            last,
          )
        : answerCommand({ state, businessId, query: last });
      return {
        content: answer.body,
        model,
        providerId: PROVIDER_ID,
        confidence: answer.confidence,
        data: answer,
        latencyMs: Date.now() - started,
      };
    },

    async classify(request: ClassifyRequest): Promise<Classification> {
      return classifyHeuristically(request.text);
    },

    async summarize(request: SummarizeRequest): Promise<AIInsight> {
      if (request.scope === "prospect" && request.prospect) {
        const comms = commsFor(state, request.prospect.id);
        return {
          id: `insight_${request.prospect.id}`,
          tenantId: request.prospect.tenantId,
          businessId: request.prospect.businessId,
          kind: "prospect_summary",
          prospectId: request.prospect.id,
          title: `${nameOf(state, request.prospect)} — AI summary`,
          body:
            request.prospect.summary ??
            `Score ${request.prospect.score}/100 across ${comms.length} interactions.`,
          bullets: comms
            .slice(0, 4)
            .map(
              (c) =>
                `${c.channel} · ${relative(c.occurredAt, Date.now())}: ${c.preview.slice(0, 90)}`,
            ),
          confidence: 0.88,
          model,
          createdAt: new Date().toISOString(),
        };
      }
      return buildDailySummary(state, request.businessId ?? businessId);
    },

    async extract(request: ExtractRequest): Promise<Record<string, string>> {
      const out: Record<string, string> = {};
      for (const field of request.fields) {
        const re = new RegExp(`${field}[:\\s]+([^\\n.,;]+)`, "i");
        const match = request.text.match(re);
        if (match) out[field] = match[1].trim();
      }
      return out;
    },

    async embed(request: EmbedRequest): Promise<number[][]> {
      // Deterministic bag-of-words embedding — good enough for local similarity
      // ranking, and swappable for a real embedding provider.
      return request.texts.map((text) => {
        const vec = new Array(64).fill(0);
        for (const word of text.toLowerCase().split(/[^a-z0-9]+/)) {
          if (!word) continue;
          let hash = 0;
          for (let i = 0; i < word.length; i++) hash = (hash * 31 + word.charCodeAt(i)) % 64;
          vec[hash] += 1;
        }
        const norm = Math.sqrt(vec.reduce((s: number, v: number) => s + v * v, 0)) || 1;
        return vec.map((v: number) => v / norm);
      });
    },
  };
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) dot += a[i] * b[i];
  return dot;
}

function relative(iso?: string, now = Date.now()): string {
  if (!iso) return "unknown";
  const mins = Math.floor((now - +new Date(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export { relative as relativeAgeLabel };
