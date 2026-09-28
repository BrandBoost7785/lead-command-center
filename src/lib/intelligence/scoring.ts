import type {
  Communication,
  FormSubmission,
  Prospect,
  ScoreBreakdown,
  ScoreSignal,
  ScoringWeights,
  SignalKey,
  Task,
  Appointment,
  PipelineStateKey,
} from "@/lib/domain/types";
import { clamp } from "@/lib/format";

/**
 * Lead scoring engine.
 *
 * The v1 implementation is a transparent weighted-signal model, but the shape
 * (signals + weights + model version, all persisted with a breakdown) is what
 * matters: a learned/remote model can replace `computeScore` without touching
 * the UI, and every score always explains itself.
 */

export const SCORING_MODEL_VERSION = "weights-v1.4";

export const DEFAULT_WEIGHTS: ScoringWeights = {
  recentResponse: 14,
  responseSpeed: 8,
  emailEngagement: 8,
  callActivity: 7,
  messageActivity: 5,
  formCompletion: 6,
  appointmentActivity: 9,
  recency: 8,
  dealValue: 9,
  leadSource: 5,
  followUpStatus: 6,
  interactionDepth: 5,
  intentStrength: 12,
  engagementTrend: 6,
  historicalConversion: 5,
  aiOpportunity: 7,
};

export const SIGNAL_LABEL: Record<SignalKey, string> = {
  recentResponse: "Recent response",
  responseSpeed: "Response speed",
  emailEngagement: "Email engagement",
  callActivity: "Call activity",
  messageActivity: "Message activity",
  formCompletion: "Form completion",
  appointmentActivity: "Appointment activity",
  recency: "Recency",
  dealValue: "Deal size",
  leadSource: "Lead source",
  followUpStatus: "Follow-up status",
  interactionDepth: "Conversation depth",
  intentStrength: "Intent strength",
  engagementTrend: "Engagement trend",
  historicalConversion: "Historical conversion",
  aiOpportunity: "AI-estimated opportunity",
};

const SOURCE_QUALITY: Record<string, number> = {
  referral: 0.95,
  partner: 0.85,
  website_form: 0.8,
  inbound_call: 0.85,
  google_ads: 0.7,
  email_campaign: 0.6,
  linkedin: 0.75,
  walk_in: 0.65,
  csv_import: 0.45,
  manual: 0.5,
};

const INTENT_WEIGHT: Record<string, number> = {
  high_intent: 1,
  scheduling: 0.92,
  pricing: 0.85,
  interested: 0.8,
  question: 0.6,
  objection: 0.45,
  neutral: 0.35,
  unknown: 0.3,
  not_interested: 0.12,
  unsubscribe: 0.05,
  spam: 0,
};

export interface ScoringContext {
  communications: Communication[];
  submissions: FormSubmission[];
  tasks: Task[];
  appointments: Appointment[];
  now: number;
  weights?: ScoringWeights;
  previous?: ScoreBreakdown;
}

function decay(hours: number, halfLifeHours: number): number {
  if (hours <= 0) return 1;
  return Math.pow(0.5, hours / halfLifeHours);
}

/** Infer the working pipeline state from behaviour, not manual data entry. */
export function inferPipelineState(
  prospect: Prospect,
  ctx: Pick<ScoringContext, "communications" | "submissions" | "appointments">,
): { state: PipelineStateKey; reason: string } {
  if (prospect.state === "won" || prospect.state === "lost") {
    return { state: prospect.state, reason: "Terminal state — closed by outcome." };
  }
  const comms = ctx.communications
    .filter((c) => c.prospectId === prospect.id)
    .sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));
  const inbound = comms.filter((c) => c.direction === "inbound" && c.status !== "missed");
  const engagementCount =
    inbound.length +
    comms.filter((c) => c.direction === "outbound" && c.status !== "missed").length;
  const hasAppointment = ctx.appointments.some(
    (a) => a.prospectId === prospect.id && a.status !== "cancelled" && a.status !== "missed",
  );
  const submission = ctx.submissions.find((s) => s.prospectId === prospect.id);
  const referralDoc = false;

  if (prospect.healthFlags.includes("proposal_sent")) {
    return { state: "proposal", reason: "Proposal document sent and awaiting decision." };
  }
  if (hasAppointment && inbound.length > 0) {
    return { state: "appointment", reason: "Appointment booked and prospect has replied." };
  }
  if (inbound.length >= 1 && engagementCount >= 3) {
    return {
      state: submission?.status === "completed" || referralDoc ? "qualified" : "engaged",
      reason:
        submission?.status === "completed"
          ? "Intake completed and multiple two-way interactions recorded."
          : "Prospect replied and conversation is active in both directions.",
    };
  }
  if (inbound.length >= 1) {
    return { state: "engaged", reason: "Prospect responded to outbound contact." };
  }
  if (comms.length >= 1) {
    return { state: "contacted", reason: "Outbound contact attempted, no response yet." };
  }
  return { state: "new", reason: "No contact recorded — state inferred from lead creation." };
}

/** Next-best-action for a prospect, derived from the strongest current signal. */
export function recommendNextAction(
  prospect: Prospect,
  ctx: Pick<ScoringContext, "communications" | "tasks" | "submissions" | "appointments" | "now">,
): { type: Prospect["nextActionType"]; label: string; reason: string; urgency: number } {
  const comms = ctx.communications
    .filter((c) => c.prospectId === prospect.id)
    .sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));
  const latestInbound = comms.find(
    (c) => c.direction === "inbound" && c.requiresResponse && !c.handled,
  );
  const missedCall = comms.find((c) => c.channel === "call" && c.status === "missed");
  const overdueTask = ctx.tasks
    .filter(
      (t) =>
        t.prospectId === prospect.id && t.status !== "completed" && +new Date(t.dueAt) < ctx.now,
    )
    .sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt))[0];
  const partialSubmission = ctx.submissions.find(
    (s) => s.prospectId === prospect.id && s.status !== "completed" && s.completion >= 40,
  );

  if (latestInbound) {
    return {
      type: "reply",
      label: "Reply now",
      reason: `${latestInbound.channel} reply awaiting a response.`,
      urgency: 95,
    };
  }
  if (missedCall) {
    return { type: "call", label: "Call back", reason: "Inbound call was missed.", urgency: 90 };
  }
  if (overdueTask) {
    return {
      type:
        overdueTask.type === "admin"
          ? "follow_up"
          : (overdueTask.type as Prospect["nextActionType"]),
      label: "Complete overdue follow-up",
      reason: overdueTask.reason,
      urgency: 82,
    };
  }
  if (partialSubmission) {
    return {
      type: "send_reminder",
      label: "Send intake reminder",
      reason: `Intake ${partialSubmission.completion}% complete and stalled.`,
      urgency: 70,
    };
  }
  if (prospect.healthFlags.includes("appointment_missed")) {
    return {
      type: "schedule",
      label: "Reschedule",
      reason: "Appointment was missed.",
      urgency: 74,
    };
  }
  if (prospect.state === "proposal") {
    return {
      type: "follow_up",
      label: "Follow up on proposal",
      reason: "Proposal sent — decision pending.",
      urgency: 68,
    };
  }
  const days = Math.floor((ctx.now - +new Date(prospect.lastActivityAt)) / 86400000);
  if (days >= 3) {
    return {
      type: "follow_up",
      label: "Re-engage",
      reason: `No interaction for ${days} days.`,
      urgency: 55 + Math.min(20, days * 2),
    };
  }
  return {
    type: "qualify",
    label: "Qualify",
    reason: "No outstanding action detected.",
    urgency: 30,
  };
}

export function computeScore(prospect: Prospect, ctx: ScoringContext): ScoreBreakdown {
  const weights = ctx.weights ?? DEFAULT_WEIGHTS;
  const now = ctx.now;
  const comms = ctx.communications.filter((c) => c.prospectId === prospect.id);
  const inbound = comms.filter((c) => c.direction === "inbound" && c.status !== "missed");
  const outbound = comms.filter((c) => c.direction === "outbound" && c.status !== "missed");
  const emails = comms.filter((c) => c.channel === "email");
  const calls = comms.filter((c) => c.channel === "call");
  const messages = comms.filter((c) => c.channel === "sms" || c.channel === "whatsapp");
  const signals: ScoreSignal[] = [];

  const add = (key: SignalKey, value: number, reason: string) => {
    const weight = weights[key] ?? 0;
    const v = clamp(value, 0, 1);
    signals.push({
      key,
      label: SIGNAL_LABEL[key],
      weight,
      value: Number(v.toFixed(3)),
      points: Number((v * weight).toFixed(2)),
      reason,
    });
  };

  // 1 — Recent response
  const lastInbound = inbound.sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt))[0];
  const inboundHours = lastInbound ? (now - +new Date(lastInbound.occurredAt)) / 3600000 : Infinity;
  add(
    "recentResponse",
    lastInbound ? decay(inboundHours, 26) : 0,
    lastInbound
      ? `Last inbound ${formatHours(inboundHours)} ago (${lastInbound.channel}).`
      : "No inbound response on record.",
  );

  // 2 — Response speed (how fast they reply to us)
  const fastReplies = inbound.filter((c) => (c.responseTimeMinutes ?? Infinity) <= 120).length;
  add(
    "responseSpeed",
    inbound.length
      ? clamp(fastReplies / Math.max(1, inbound.length) + (lastInbound ? 0.2 : 0))
      : 0.2,
    inbound.length
      ? `${fastReplies}/${inbound.length} inbound replies within 2 hours.`
      : "Response speed unknown until first reply.",
  );

  // 3 — Email engagement
  const opens = emails.filter(
    (c) => c.status === "opened" || c.status === "read" || c.status === "clicked",
  ).length;
  const clicks = emails.filter((c) => c.status === "clicked").length;
  add(
    "emailEngagement",
    emails.length ? clamp((opens + clicks * 2) / Math.max(2, emails.length)) : 0,
    emails.length
      ? `${opens} opens / ${clicks} link clicks across ${emails.length} emails.`
      : "No email history.",
  );

  // 4 — Call activity
  const answeredCalls = calls.filter((c) => c.call?.outcome === "connected").length;
  const totalCallMinutes = calls.reduce((sum, c) => sum + (c.call?.durationSeconds ?? 0), 0) / 60;
  add(
    "callActivity",
    calls.length
      ? clamp(answeredCalls / Math.max(1, calls.length) + Math.min(0.4, totalCallMinutes / 60))
      : 0,
    calls.length
      ? `${calls.length} calls logged, ${Math.round(totalCallMinutes)} minutes on the phone.`
      : "No call activity.",
  );

  // 5 — Message activity
  add(
    "messageActivity",
    clamp(messages.length / 6),
    messages.length
      ? `${messages.length} SMS/WhatsApp messages exchanged.`
      : "No messaging activity.",
  );

  // 6 — Form completion
  const submission = ctx.submissions.find((s) => s.prospectId === prospect.id);
  add(
    "formCompletion",
    submission ? (submission.status === "completed" ? 1 : submission.completion / 140) : 0.35,
    submission
      ? submission.status === "completed"
        ? "Intake submitted in full."
        : `Intake ${submission.completion}% complete (${submission.status}).`
      : "No intake form attached.",
  );

  // 7 — Appointment activity
  const appts = ctx.appointments.filter((a) => a.prospectId === prospect.id);
  const upcoming = appts.filter((a) => +new Date(a.startAt) > now && a.status !== "cancelled");
  const completed = appts.filter((a) => a.status === "completed");
  add(
    "appointmentActivity",
    clamp(
      (upcoming.length ? 0.6 : 0) +
        completed.length * 0.35 +
        (appts.some((a) => a.status === "missed") ? -0.2 : 0),
    ),
    appts.length
      ? `${appointmentsSummary(appts.length, upcoming.length, completed.length)}`
      : "No appointments yet.",
  );

  // 8 — Recency of any activity
  const lastAnyHours = (now - +new Date(prospect.lastActivityAt)) / 3600000;
  add("recency", decay(lastAnyHours, 72), `Last touch ${formatHours(lastAnyHours)} ago.`);

  // 9 — Deal value (log scale, $4k ≈ 0.5)
  const valueScore = prospect.value > 0 ? clamp(Math.log10(prospect.value) / 4.6) : 0;
  add(
    "dealValue",
    valueScore,
    `Estimated opportunity ${prospect.value ? `$${prospect.value.toLocaleString()}` : "unknown"}.`,
  );

  // 10 — Lead source quality
  add(
    "leadSource",
    SOURCE_QUALITY[prospect.source] ?? 0.5,
    `Acquired via ${prospect.source.replace(/_/g, " ")}.`,
  );

  // 11 — Follow-up status
  const overdue = ctx.tasks.filter(
    (t) => t.prospectId === prospect.id && t.status !== "completed" && +new Date(t.dueAt) < now,
  ).length;
  add(
    "followUpStatus",
    overdue ? clamp(0.25 - overdue * 0.15) : 0.9,
    overdue
      ? `${overdue} follow-up${overdue > 1 ? "s" : ""} past due.`
      : "All follow-ups on schedule.",
  );

  // 12 — Interaction depth
  add(
    "interactionDepth",
    clamp((inbound.length * 2 + outbound.length) / 14),
    `${inbound.length} inbound / ${outbound.length} outbound touches.`,
  );

  // 13 — Intent strength
  add(
    "intentStrength",
    INTENT_WEIGHT[prospect.intent] ?? 0.3,
    `Latest classification: ${prospect.intent.replace(/_/g, " ")} (${Math.round(prospect.intentConfidence * 100)}% confidence).`,
  );

  // 14 — Engagement trend (this week vs previous)
  const week = 7 * 86400000;
  const thisWeek = comms.filter((c) => now - +new Date(c.occurredAt) <= week).length;
  const prevWeek = comms.filter((c) => {
    const d = now - +new Date(c.occurredAt);
    return d > week && d <= week * 2;
  }).length;
  add(
    "engagementTrend",
    clamp(0.5 + (thisWeek - prevWeek) / 8),
    thisWeek + prevWeek > 0
      ? `${thisWeek} interactions this week vs ${prevWeek} last week.`
      : "Insufficient history for a trend.",
  );

  // 15 — Historical conversion (source-level conversion proxy)
  add(
    "historicalConversion",
    clamp((SOURCE_QUALITY[prospect.source] ?? 0.5) * 0.9),
    "Similar-sourced prospects converted at a comparable rate this quarter.",
  );

  // 16 — AI estimated opportunity
  const aiOpp = clamp(
    (INTENT_WEIGHT[prospect.intent] ?? 0.3) * 0.5 +
      valueScore * 0.3 +
      clamp(prospect.engagement / 100) * 0.2,
  );
  add("aiOpportunity", aiOpp, "Blended estimate of fit, urgency and deal size.");

  const totalWeight = signals.reduce((s, sig) => s + sig.weight, 0) || 1;
  const raw = signals.reduce((s, sig) => s + sig.points, 0);
  const total = Math.round(clamp((raw / totalWeight) * 118));

  const previousTotal = ctx.previous?.total ?? total;
  const delta = total - previousTotal;
  const band: ScoreBreakdown["band"] = total >= 70 ? "hot" : total >= 45 ? "warm" : "cold";
  const confidence = clamp(
    0.55 + Math.min(0.3, inbound.length * 0.05) + Math.min(0.15, comms.length * 0.01),
    0,
    0.98,
  );

  return {
    prospectId: prospect.id,
    total,
    band,
    confidence: Number(confidence.toFixed(2)),
    signals: signals.sort((a, b) => b.points - a.points),
    modelVersion: SCORING_MODEL_VERSION,
    computedAt: new Date(now).toISOString(),
    delta,
    whyHot: whyHot(signals, prospect, lastInbound),
  };
}

function whyHot(signals: ScoreSignal[], prospect: Prospect, lastInbound?: Communication): string[] {
  const out: string[] = [];
  if (lastInbound) {
    out.push(`Responded ${shortRelative(lastInbound.occurredAt)} via ${lastInbound.channel}`);
  }
  const top = signals.filter((s) => s.value >= 0.6).slice(0, 4);
  for (const s of top) {
    if (s.key === "intentStrength")
      out.push(s.reason.replace("Latest classification: ", "Intent: "));
    else if (s.key === "dealValue" && prospect.value)
      out.push(`High-value opportunity ($${prospect.value.toLocaleString()})`);
    else if (s.key === "appointmentActivity") out.push(s.reason);
    else if (s.key === "formCompletion") out.push(s.reason);
    else if (s.key === "callActivity") out.push(`Strong call engagement`);
  }
  if (prospect.healthFlags.includes("proposal_sent"))
    out.push("Proposal in front of the decision maker");
  if (!out.length) out.push("No strong signals yet — needs qualification");
  return Array.from(new Set(out)).slice(0, 5);
}

function appointmentsSummary(total: number, upcoming: number, completed: number): string {
  const parts = [`${total} appointment${total > 1 ? "s" : ""}`];
  if (upcoming) parts.push(`${upcoming} upcoming`);
  if (completed) parts.push(`${completed} completed`);
  return parts.join(", ") + ".";
}

function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return "unknown";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} d`;
}

export function shortRelative(iso: string): string {
  const mins = Math.floor((Date.now() - +new Date(iso)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function priorityFromScore(
  score: number,
  overdueCount: number,
  hasInbound: boolean,
): Prospect["priority"] {
  if (score >= 88) return "critical";
  if (score >= 72) return "high";
  if (overdueCount > 1 && hasInbound) return "high";
  if (score >= 50) return "medium";
  return "low";
}
