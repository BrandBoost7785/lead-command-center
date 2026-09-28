import type {
  AttentionKind,
  Channel,
  Intent,
  LeadSource,
  NextActionType,
  PipelineStateKey,
  Priority,
} from "@/lib/domain/types";

export const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  call: "Call",
  sms: "SMS",
  whatsapp: "WhatsApp",
  form: "Form",
  webchat: "Web chat",
  linkedin: "LinkedIn",
  meeting: "Meeting",
};

export const INTENT_LABEL: Record<Intent, string> = {
  high_intent: "High intent",
  interested: "Interested",
  scheduling: "Scheduling",
  pricing: "Pricing",
  question: "Question",
  objection: "Objection",
  not_interested: "Not interested",
  unsubscribe: "Unsubscribe",
  neutral: "Neutral",
  spam: "Spam",
  unknown: "Unclassified",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const STATE_LABEL: Record<PipelineStateKey, string> = {
  new: "New",
  contacted: "Contacted",
  engaged: "Engaged",
  qualified: "Qualified",
  appointment: "Appointment",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  customer: "Customer",
};

export const SOURCE_LABEL: Record<LeadSource, string> = {
  website_form: "Website form",
  google_ads: "Google Ads",
  referral: "Referral",
  inbound_call: "Inbound call",
  email_campaign: "Email campaign",
  linkedin: "LinkedIn",
  partner: "Partner",
  walk_in: "Walk-in",
  csv_import: "CSV import",
  manual: "Manual",
  webchat: "Web chat",
  sms: "SMS",
  whatsapp: "WhatsApp",
  event: "Event",
};

export const NEXT_ACTION_LABEL: Record<NextActionType, string> = {
  reply: "Reply",
  call: "Call back",
  sms: "Text",
  whatsapp: "WhatsApp",
  follow_up: "Follow up",
  schedule: "Schedule",
  send_reminder: "Send reminder",
  send_proposal: "Send proposal",
  research: "Research",
  review: "Review",
  open: "Open",
  qualify: "Qualify",
};

export const ATTENTION_LABEL: Record<AttentionKind, string> = {
  email_response: "Email response",
  missed_call: "Missed call",
  hot_prospect: "Hot prospect",
  overdue_follow_up: "Overdue follow-up",
  incomplete_intake: "Incomplete intake",
  missed_appointment: "Missed appointment",
  task_overdue: "Overdue task",
  unanswered_message: "Unanswered message",
  stalled_deal: "Stalled deal",
  unanswered_email: "Unanswered email",
};

/* -------------------------------------------------------------------------- */

export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function ageMinutes(iso: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

export function shortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function dateTime(iso: string): string {
  return `${shortDate(iso)} · ${shortTime(iso)}`;
}

export function countdown(iso: string, now: number = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const overdue = diff < 0;
  const mins = Math.floor(Math.abs(diff) / 60000);
  let label: string;
  if (mins < 60) label = `${mins}m`;
  else if (mins < 60 * 24) label = `${Math.floor(mins / 60)}h`;
  else label = `${Math.floor(mins / (60 * 24))}d`;
  return overdue ? `${label} overdue` : `in ${label}`;
}

export function currency(value: number, code = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
  }).format(value);
}

export function compactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function displayName(contact?: { firstName: string; lastName: string } | null): string {
  if (!contact) return "Unknown";
  return `${contact.firstName} ${contact.lastName}`.trim();
}

export function lastNameInitials(contact?: { firstName: string; lastName: string } | null): string {
  if (!contact) return "Un";
  return `${contact.firstName} ${contact.lastName?.[0] ?? ""}.`;
}

export function firstNameOf(contact?: { firstName: string } | null): string {
  return contact?.firstName ?? "Unknown";
}

/** Tailwind classes for priority pills, kept in one place for consistency. */
export function priorityTone(priority: Priority): string {
  switch (priority) {
    case "critical":
      return "bg-rose-500/12 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/25";
    case "high":
      return "bg-orange-500/12 text-orange-600 dark:text-orange-400 ring-1 ring-orange-500/25";
    case "medium":
      return "bg-amber-400/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400/30";
    case "low":
      return "bg-slate-500/10 text-slate-600 dark:text-slate-300 ring-1 ring-slate-500/20";
  }
}

export function intentTone(intent: Intent): string {
  switch (intent) {
    case "high_intent":
    case "interested":
      return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/25";
    case "scheduling":
    case "pricing":
      return "bg-indigo-500/12 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/25";
    case "question":
      return "bg-sky-500/12 text-sky-600 dark:text-sky-400 ring-1 ring-sky-500/25";
    case "objection":
    case "not_interested":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/25";
    case "unsubscribe":
    case "spam":
      return "bg-rose-500/12 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/25";
    default:
      return "bg-slate-500/10 text-slate-600 dark:text-slate-300 ring-1 ring-slate-500/20";
  }
}

export function scoreTone(score: number): string {
  if (score >= 85) return "text-rose-600 dark:text-rose-400";
  if (score >= 70) return "text-orange-600 dark:text-orange-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-slate-500 dark:text-slate-400";
}

export function scoreBand(score: number): "hot" | "warm" | "cold" {
  if (score >= 70) return "hot";
  if (score >= 45) return "warm";
  return "cold";
}

export function scoreRing(score: number): string {
  if (score >= 85) return "stroke-rose-500";
  if (score >= 70) return "stroke-orange-500";
  if (score >= 45) return "stroke-amber-500";
  return "stroke-slate-400";
}

export function channelTone(channel: Channel): string {
  switch (channel) {
    case "email":
      return "bg-sky-500/12 text-sky-600 dark:text-sky-400 ring-1 ring-sky-500/25";
    case "call":
      return "bg-violet-500/12 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/25";
    case "sms":
      return "bg-teal-500/12 text-teal-600 dark:text-teal-400 ring-1 ring-teal-500/25";
    case "whatsapp":
      return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/25";
    case "form":
      return "bg-amber-500/12 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/25";
    default:
      return "bg-slate-500/10 text-slate-600 dark:text-slate-300 ring-1 ring-slate-500/20";
  }
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

export function percent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}
