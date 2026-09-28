import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Bot,
  Building2,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  Clock,
  Flame,
  Mail,
  MessageCircle,
  Phone,
  Sparkles,
  TrendingDown,
  TrendingUp,
  User,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Channel, Priority, Prospect } from "@/lib/domain/types";
import { CHANNEL_LABEL, INTENT_LABEL, PRIORITY_LABEL, relativeTime, scoreTone } from "@/lib/format";

/* -------------------------------------------------------------------------- */
/* Live relative time                                                          */
/* -------------------------------------------------------------------------- */

export function RelativeTime({ iso, className }: { iso?: string; className?: string }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!iso) return <span className={className}>never</span>;
  return <span className={className}>{relativeTime(iso)}</span>;
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                      */
/* -------------------------------------------------------------------------- */

export function Pill({
  children,
  tone = "neutral",
  className,
  icon,
}: {
  children: ReactNode;
  tone?: "neutral" | "critical" | "high" | "medium" | "low" | "positive" | "info" | "ai";
  className?: string;
  icon?: ReactNode;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-surface-muted text-muted-foreground ring-border",
    critical: "bg-rose-500/12 text-rose-600 ring-rose-500/25 dark:text-rose-400",
    high: "bg-orange-500/12 text-orange-600 ring-orange-500/25 dark:text-orange-400",
    medium: "bg-amber-400/15 text-amber-700 ring-amber-400/30 dark:text-amber-300",
    low: "bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300",
    positive: "bg-emerald-500/12 text-emerald-700 ring-emerald-500/25 dark:text-emerald-400",
    info: "bg-sky-500/12 text-sky-600 ring-sky-500/25 dark:text-sky-400",
    ai: "bg-violet-500/12 text-violet-600 ring-violet-500/25 dark:text-violet-400",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function priorityToneOf(p: Priority): "critical" | "high" | "medium" | "low" {
  return p;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Pill tone={priorityToneOf(priority)} className="uppercase tracking-wide">
      {PRIORITY_LABEL[priority]}
    </Pill>
  );
}

export function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  const map: Record<Channel, ReactNode> = {
    email: <Mail className={className} />,
    call: <Phone className={className} />,
    sms: <MessageCircle className={className} />,
    whatsapp: <MessageCircle className={className} />,
    form: <ClipboardList className={className} />,
    webchat: <MessageCircle className={className} />,
    linkedin: <User className={className} />,
    meeting: <CalendarClock className={className} />,
  };
  return <>{map[channel] ?? <Mail className={className} />}</>;
}

export function ChannelBadge({ channel }: { channel: Channel }) {
  const tone =
    channel === "call"
      ? "info"
      : channel === "email"
        ? "neutral"
        : channel === "form"
          ? "medium"
          : "positive";
  return (
    <Pill
      tone={tone as "neutral" | "info" | "medium" | "positive"}
      icon={<ChannelIcon channel={channel} className="h-3 w-3" />}
    >
      {CHANNEL_LABEL[channel]}
    </Pill>
  );
}

export function IntentBadge({ intent }: { intent: Prospect["intent"] }) {
  const tone =
    intent === "high_intent" || intent === "interested"
      ? "positive"
      : intent === "objection" || intent === "not_interested"
        ? "medium"
        : intent === "unsubscribe" || intent === "spam"
          ? "critical"
          : intent === "scheduling" || intent === "pricing"
            ? "info"
            : "neutral";
  return (
    <Pill tone={tone as "positive" | "medium" | "critical" | "info" | "neutral"}>
      {INTENT_LABEL[intent]}
    </Pill>
  );
}

export function StateBadge({ state }: { state: Prospect["state"] }) {
  const map: Record<string, string> = {
    new: "neutral",
    contacted: "neutral",
    engaged: "info",
    qualified: "info",
    appointment: "positive",
    proposal: "positive",
    negotiation: "medium",
    won: "positive",
    lost: "critical",
    customer: "ai",
  };
  return (
    <Pill
      tone={
        (map[state] ?? "neutral") as "neutral" | "info" | "positive" | "medium" | "critical" | "ai"
      }
      className="capitalize"
    >
      {state.replace(/_/g, " ")}
    </Pill>
  );
}

/* -------------------------------------------------------------------------- */
/* Score                                                                       */
/* -------------------------------------------------------------------------- */

export function ScoreRing({
  score,
  size = 44,
  label,
}: {
  score: number;
  size?: number;
  label?: boolean;
}) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.min(100, Math.max(0, score)) / 100) * circumference;
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-muted"
          strokeWidth={4}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={cn(
            score >= 85
              ? "stroke-rose-500"
              : score >= 70
                ? "stroke-orange-500"
                : score >= 45
                  ? "stroke-amber-500"
                  : "stroke-slate-400",
          )}
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <span className={cn("absolute text-[13px] font-semibold tabular-nums", scoreTone(score))}>
        {score}
      </span>
      {label ? <span className="sr-only">Lead score {score} of 100</span> : null}
    </div>
  );
}

export function ScoreDelta({ delta }: { delta: number }) {
  if (!delta) return null;
  const up = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-medium",
        up ? "text-emerald-600" : "text-rose-600",
      )}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}
      {delta}
    </span>
  );
}

export function Sparkline({
  data,
  className,
  tone = "primary",
}: {
  data: number[];
  className?: string;
  tone?: "primary" | "positive" | "danger";
}) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const points = data
    .map((v, i) => `${(i / Math.max(1, data.length - 1)) * 100},${28 - (v / max) * 26}`)
    .join(" ");
  const stroke =
    tone === "positive"
      ? "stroke-emerald-500"
      : tone === "danger"
        ? "stroke-rose-500"
        : "stroke-primary";
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className={cn("h-7 w-full", className)}>
      <polyline
        points={points}
        fill="none"
        strokeWidth={2}
        className={stroke}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                      */
/* -------------------------------------------------------------------------- */

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  dense,
  icon,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  dense?: boolean;
  icon?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              {icon}
              {title}
            </h3>
            {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      )}
      <div className={dense ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "neutral" | "critical" | "positive" | "info" | "medium";
  onClick?: () => void;
}) {
  const toneRing: Record<string, string> = {
    neutral: "text-foreground",
    critical: "text-rose-600 dark:text-rose-400",
    positive: "text-emerald-600 dark:text-emerald-400",
    info: "text-sky-600 dark:text-sky-400",
    medium: "text-amber-600 dark:text-amber-400",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group flex w-full flex-col gap-1 rounded-xl border border-border bg-card p-3.5 text-left transition",
        onClick && "hover:border-primary/40 hover:shadow-[0_2px_10px_rgba(15,23,42,0.06)]",
      )}
    >
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <span className="text-[11px] font-medium uppercase tracking-wider">{label}</span>
        <span className={cn("opacity-80", toneRing[tone])}>{icon}</span>
      </div>
      <span className={cn("text-2xl font-semibold tabular-nums tracking-tight", toneRing[tone])}>
        {value}
      </span>
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </button>
  );
}

export function Avatar({
  name,
  color,
  size = 32,
  isAi,
  className,
}: {
  name: string;
  color?: string;
  size?: number;
  isAi?: boolean;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: color ?? "oklch(0.55 0.14 260)",
        fontSize: size * 0.36,
      }}
      title={name}
    >
      {isAi ? <Bot style={{ width: size * 0.5, height: size * 0.5 }} /> : initials}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <span className="text-muted-foreground">{icon ?? <Sparkles className="h-5 w-5" />}</span>
      <p className="text-sm font-medium">{title}</p>
      {body ? <p className="max-w-sm text-xs text-muted-foreground">{body}</p> : null}
      {action}
    </div>
  );
}

export function IconLabel({
  icon,
  children,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}
    >
      {icon}
      {children}
    </span>
  );
}

export function HotFlame({ score }: { score: number }) {
  if (score < 70) return null;
  return <Flame className={cn("h-3.5 w-3.5", score >= 85 ? "text-rose-500" : "text-orange-500")} />;
}

export function AiBadge({
  children = "AI",
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-violet-500/12 px-2 py-0.5 text-[11px] font-medium text-violet-600 ring-1 ring-violet-500/25 dark:text-violet-300",
        className,
      )}
    >
      <Sparkles className="h-3 w-3" />
      {children}
    </span>
  );
}

export function VerifiedBadge() {
  return <BadgeCheck className="h-3.5 w-3.5 text-sky-500" />;
}

export const ICONS = {
  zap: Zap,
  money: CircleDollarSign,
  building: Building2,
  clock: Clock,
  calendar: CalendarClock,
};

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}
