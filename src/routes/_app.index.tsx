import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Clock,
  Flame,
  Mail,
  Phone,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useBusiness } from "@/hooks/use-app-store";
import { actions } from "@/lib/data/store";
import { buildDailySummary } from "@/lib/ai/reasoner";
import { cn } from "@/lib/utils";
import { ATTENTION_LABEL, INTENT_LABEL, channelTone, currency, greeting } from "@/lib/format";
import { buildPipelineSnapshot } from "@/lib/intelligence/attention";
import {
  Avatar,
  EmptyState,
  HotFlame,
  Panel,
  Pill,
  RelativeTime,
  ScoreDelta,
  ScoreRing,
  Sparkline,
  StatCard,
} from "@/components/app/primitives";
import { QuickAction } from "@/components/app/prospect-actions";
import { SimulateEventButton } from "@/components/app/simulate";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AttentionItem, Communication } from "@/lib/domain/types";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function Dashboard() {
  const { state, businessId, business, index, attention, hot, stats, feed, missed, currentUser } =
    useBusiness();
  const now = Date.now();
  const pipeline = useMemo(() => buildPipelineSnapshot(state, businessId), [state, businessId]);
  const summary = useMemo(
    () => buildDailySummary(state, businessId, now),
    [state, businessId, now],
  );
  const incompleteIntakes = state.submissions
    .filter((s) => s.businessId === businessId && s.status !== "completed")
    .sort((a, b) => b.valueEstimate - a.valueEstimate);

  const trend = useMemo(() => {
    const days: number[] = [];
    for (let i = 13; i >= 0; i--) {
      const start = new Date(now - i * 86_400_000);
      start.setHours(0, 0, 0, 0);
      const end = +start + 86_400_000;
      days.push(
        state.communications.filter(
          (c) =>
            c.businessId === businessId &&
            +new Date(c.occurredAt) >= +start &&
            +new Date(c.occurredAt) < end,
        ).length,
      );
    }
    return days;
  }, [state, businessId, now]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {business?.name} ·{" "}
            {new Date(now).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight lg:text-[28px]">
            {greeting(new Date(now))}, {currentUser?.name.split(" ")[0] ?? "there"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Here's what needs your attention.</p>
        </div>
        <div className="flex items-center gap-2">
          <SimulateEventButton />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => actions.recomputeIntelligence()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Run intelligence
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-gradient-to-br from-violet-600 to-indigo-600"
            asChild
          >
            <Link to="/ai">
              <Sparkles className="h-3.5 w-3.5" />
              AI Command Center
            </Link>
          </Button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="New leads today"
          value={stats.newLeadsToday}
          hint="from all sources"
          icon={<Zap className="h-3.5 w-3.5" />}
          onClick={() => undefined}
        />
        <StatCard
          label="Responses"
          value={stats.responsesToday}
          hint={`${stats.highIntent} high intent`}
          tone="info"
          icon={<Mail className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Hot prospects"
          value={stats.hotCount}
          hint="score 70+"
          tone="critical"
          icon={<Flame className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Overdue follow-ups"
          value={stats.overdueFollowUps}
          hint={stats.overdueFollowUps ? "needs action today" : "all clear"}
          tone={stats.overdueFollowUps ? "medium" : "positive"}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Missed calls"
          value={stats.missedCalls}
          hint="unreturned"
          tone={stats.missedCalls ? "critical" : "positive"}
          icon={<Phone className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Weighted pipeline"
          value={currency(stats.weightedPipeline)}
          hint={`${currency(stats.wonThisMonth)} won this month`}
          tone="positive"
          icon={<TrendingUp className="h-3.5 w-3.5" />}
        />
      </div>

      {/* Attention queue */}
      <Panel
        title="What needs your attention"
        subtitle="Ranked by urgency, value and how long it has been waiting — generated from live events."
        icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}
        action={
          <Pill tone="neutral" icon={<BarChart3 className="h-3 w-3" />}>
            {attention.length} open items
          </Pill>
        }
        dense
      >
        <div className="divide-y divide-border/70">
          {attention.slice(0, 7).map((item) => (
            <AttentionRow key={item.id} item={item} />
          ))}
          {attention.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Nothing is waiting on you"
                body="Every inbound response is handled and no follow-ups are overdue. Good time to prospect."
              />
            </div>
          ) : null}
        </div>
        {attention.length > 7 ? (
          <div className="border-t border-border/70 px-4 py-2 text-center">
            <Link
              to="/tasks"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              + {attention.length - 7} more items in the queue
            </Link>
          </div>
        ) : null}
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <IncomingActivity state={state} businessId={businessId} feed={feed} index={index} />
        <Panel
          title="Missed activity"
          subtitle="What slipped — calls, messages, follow-ups, intakes and appointments."
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          dense
        >
          <div className="max-h-[420px] divide-y divide-border/70 overflow-y-auto">
            {missed.slice(0, 9).map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    m.priority === "critical"
                      ? "bg-rose-500"
                      : m.priority === "high"
                        ? "bg-orange-500"
                        : "bg-amber-400",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{m.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{m.detail}</p>
                </div>
                {m.prospectId ? (
                  <QuickAction
                    prospectId={m.prospectId}
                    action={
                      m.kind === "missed_call"
                        ? "call"
                        : m.kind === "incomplete_intake"
                          ? "task"
                          : "reply"
                    }
                    label={m.actionLabel}
                    variant="outline"
                    size="xs"
                  />
                ) : (
                  <Button size="xs" variant="outline" asChild>
                    <Link to="/forms">Open</Link>
                  </Button>
                )}
              </div>
            ))}
            {missed.length === 0 ? (
              <EmptyState
                title="Nothing missed"
                body="No missed calls, unanswered messages or overdue follow-ups."
              />
            ) : null}
          </div>
        </Panel>
      </div>

      {/* Hot prospects */}
      <Panel
        title="🔥 Top 15 prospects"
        subtitle="Ranked automatically by the scoring engine — no manual prioritisation."
        action={
          <Button variant="ghost" size="sm" className="gap-1" asChild>
            <Link to="/prospects">
              All prospects <ArrowUpRight className="h-3 w-3" />
            </Link>
          </Button>
        }
        dense
      >
        <div className="grid gap-0 divide-y divide-border/70">
          {hot.slice(0, 8).map((row) => {
            const contact = index.contactOf(row.prospect);
            const company = index.companyOf(row.prospect);
            return (
              <div key={row.prospect.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-6 text-center text-sm font-semibold text-muted-foreground tabular-nums">
                  #{row.rank}
                </span>
                <ScoreRing score={row.prospect.score} size={40} />
                <div className="min-w-[160px] flex-1">
                  <Link
                    to="/prospects/$id"
                    params={{ id: row.prospect.id }}
                    className="flex items-center gap-1.5 text-sm font-medium hover:underline"
                  >
                    {contact ? `${contact.firstName} ${contact.lastName}` : row.prospect.id}
                    <HotFlame score={row.prospect.score} />
                    <ScoreDelta delta={row.prospect.scoreDelta} />
                  </Link>
                  <p className="text-[11px] text-muted-foreground">
                    {company?.name ?? "No company"} · {currency(row.prospect.value)} · last activity{" "}
                    <RelativeTime iso={row.prospect.lastActivityAt} />
                  </p>
                </div>
                <div className="hidden min-w-[220px] flex-[1.4] lg:block">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Why hot
                  </p>
                  <p className="truncate text-xs">
                    {row.whyHot[0] ?? "Strong multi-signal engagement"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill
                    tone={
                      row.prospect.intent === "high_intent"
                        ? "positive"
                        : row.prospect.intent === "objection"
                          ? "medium"
                          : "info"
                    }
                  >
                    {INTENT_LABEL[row.prospect.intent]}
                  </Pill>
                  <QuickAction
                    prospectId={row.prospect.id}
                    action={row.nextAction === "call" ? "call" : "reply"}
                    label={row.nextActionLabel}
                    variant="default"
                    size="xs"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Incomplete intakes */}
        <Panel
          title="Incomplete intakes"
          subtitle="High-value forms that stalled — the recoverable revenue list."
          dense
        >
          <div className="divide-y divide-border/70">
            {incompleteIntakes.slice(0, 5).map((s) => {
              const prospect = state.prospects.find((p) => p.id === s.prospectId);
              const contact = prospect ? index.contactOf(prospect) : undefined;
              const form = state.forms.find((f) => f.id === s.formId);
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="relative h-9 w-9 shrink-0">
                    <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
                      <circle
                        cx="18"
                        cy="18"
                        r="15"
                        className="stroke-muted"
                        strokeWidth="3"
                        fill="none"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="15"
                        className={
                          s.valueEstimate >= 20_000 ? "stroke-rose-500" : "stroke-amber-500"
                        }
                        strokeWidth="3"
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={`${(s.completion / 100) * 94.2} 94.2`}
                      />
                    </svg>
                    <span className="absolute inset-0 grid place-items-center text-[10px] font-semibold">
                      {s.completion}%
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {contact ? `${contact.firstName} ${contact.lastName}` : "Unlinked lead"}
                      {s.valueEstimate >= 20_000 ? (
                        <Pill tone="critical" className="ml-2">
                          High value
                        </Pill>
                      ) : null}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {form?.name} · {currency(s.valueEstimate)} · waiting{" "}
                      <RelativeTime iso={s.lastActivityAt} />
                    </p>
                  </div>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => actions.sendIntakeReminder(s.id)}
                  >
                    Send reminder
                  </Button>
                </div>
              );
            })}
            {incompleteIntakes.length === 0 ? <EmptyState title="No incomplete intakes" /> : null}
          </div>
          <div className="border-t border-border/70 px-4 py-2">
            <Link
              to="/forms"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Manage forms & intake →
            </Link>
          </div>
        </Panel>

        {/* Pipeline snapshot */}
        <Panel
          title="Pipeline snapshot"
          subtitle="Maintained automatically from behaviour — never dragged by hand."
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/pipeline">Open pipeline</Link>
            </Button>
          }
        >
          <div className="space-y-2.5">
            {pipeline
              .filter((s) => s.count > 0)
              .map((stage) => {
                const max = Math.max(...pipeline.map((p) => p.count), 1);
                return (
                  <div key={stage.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: stage.color }}
                        />
                        {stage.label}
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {stage.count} · {currency(stage.value)} · weighted{" "}
                        {currency(stage.weightedValue)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(stage.count / max) * 100}%`, background: stage.color }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/70 pt-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Momentum (14 days)
              </p>
              <Sparkline data={trend} tone="primary" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                AI actions today
              </p>
              <p className="text-lg font-semibold tabular-nums">{stats.aiActionsToday}</p>
              <p className="text-[11px] text-muted-foreground">
                {stats.awaitingApproval} awaiting approval
              </p>
            </div>
          </div>
        </Panel>
      </div>

      {/* AI summary */}
      <section className="rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-500/[0.07] to-indigo-500/[0.04] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-300">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">AI business summary</h3>
              <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
                {summary.body}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <Link to="/ai" search={{ q: "What should I do next?" } as never}>
                <Sparkles className="h-3.5 w-3.5" />
                Ask AI
              </Link>
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() =>
                actions.proposeAction({
                  type: "create_task",
                  title: "Act on the top attention item",
                  rationale:
                    "Generated from the daily summary — the highest-urgency item in the queue.",
                  expectedOutcome: "Clears the oldest open item before it breaches SLA.",
                  confidence: 0.8,
                })
              }
            >
              Create follow-up
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const { state, index } = useBusiness();
  const prospect = item.prospectId
    ? state.prospects.find((p) => p.id === item.prospectId)
    : undefined;
  const contact = prospect ? index.contactOf(prospect) : undefined;
  const action: "reply" | "call" | "task" =
    item.recommendedAction === "call"
      ? "call"
      : item.recommendedAction === "send_reminder" || item.recommendedAction === "follow_up"
        ? "task"
        : "reply";

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span
        className={cn(
          "w-1 self-stretch rounded-full",
          item.priority === "critical"
            ? "bg-rose-500"
            : item.priority === "high"
              ? "bg-orange-500"
              : "bg-amber-400",
        )}
      />
      {contact ? (
        <Avatar
          name={`${contact.firstName} ${contact.lastName}`}
          color={contact.avatarColor}
          size={32}
        />
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-[200px] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-medium">{item.title}</p>
          <Pill tone={item.priority}>{ATTENTION_LABEL[item.kind]}</Pill>
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{item.reason}</p>
        {item.insight ? (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground/90 italic">
            {item.insight}
          </p>
        ) : null}
      </div>
      <div className="hidden w-24 shrink-0 text-right text-[11px] text-muted-foreground xl:block">
        <RelativeTime iso={item.occurredAt} />
        {item.scoreImpact ? <p className="tabular-nums">score {item.scoreImpact}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        {prospect ? (
          <QuickAction
            prospectId={prospect.id}
            action={action}
            label={item.recommendedActionLabel}
            variant="default"
            size="xs"
          />
        ) : null}
        <Button size="xs" variant="outline" asChild>
          <Link to="/prospects/$id" params={{ id: item.prospectId ?? "" }}>
            Open
          </Link>
        </Button>
      </div>
    </div>
  );
}

function IncomingActivity({
  state,
  businessId,
  feed,
  index,
}: {
  state: ReturnType<typeof useBusiness>["state"];
  businessId: string;
  feed: ReturnType<typeof useBusiness>["feed"];
  index: ReturnType<typeof useBusiness>["index"];
}) {
  const tabs = [
    {
      key: "all",
      label: "All",
      items: feed.communications.filter((c) => c.direction === "inbound"),
    },
    { key: "email", label: "Emails", items: feed.byChannel["email"] ?? [] },
    { key: "call", label: "Calls", items: feed.communications.filter((c) => c.channel === "call") },
    { key: "sms", label: "SMS", items: feed.byChannel["sms"] ?? [] },
    { key: "whatsapp", label: "WhatsApp", items: feed.byChannel["whatsapp"] ?? [] },
    { key: "form", label: "Forms", items: feed.byChannel["form"] ?? [] },
  ];
  const [active, setActive] = useState("all");
  const items = tabs.find((t) => t.key === active)?.items ?? [];

  return (
    <Panel
      title="New responses"
      subtitle="Everything that arrived in the last 36 hours, classified the moment it landed."
      action={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/communications">All communications</Link>
        </Button>
      }
      dense
    >
      <div className="px-4 pt-3">
        <Tabs value={active} onValueChange={setActive}>
          <TabsList className="h-8">
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="text-xs">
                {t.label}
                {t.items.length ? (
                  <span className="ml-1 text-[10px] text-muted-foreground">{t.items.length}</span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={active} className="mt-3">
            <div className="-mx-4 max-h-[400px] divide-y divide-border/70 overflow-y-auto border-t border-border/70">
              {items.slice(0, 8).map((c) => (
                <FeedRow key={c.id} comm={c} state={state} index={index} />
              ))}
              {items.length === 0 ? (
                <EmptyState title="No activity in this channel" />
              ) : (
                <div className="h-2" />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Panel>
  );
}

function FeedRow({
  comm,
  state,
  index,
}: {
  comm: Communication;
  state: ReturnType<typeof useBusiness>["state"];
  index: ReturnType<typeof useBusiness>["index"];
}) {
  const prospect = state.prospects.find((p) => p.id === comm.prospectId);
  const contact = prospect ? index.contactOf(prospect) : undefined;
  const company = prospect ? index.companyOf(prospect) : undefined;
  const intent = comm.enrichment?.intent;

  return (
    <div className="flex gap-3 px-4 py-3">
      {contact ? (
        <Avatar
          name={`${contact.firstName} ${contact.lastName}`}
          color={contact.avatarColor}
          size={32}
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/prospects/$id"
            params={{ id: comm.prospectId }}
            className="text-[13px] font-medium hover:underline"
          >
            {contact ? `${contact.firstName} ${contact.lastName}` : "Unknown"}
          </Link>
          {company ? (
            <span className="text-[11px] text-muted-foreground">{company.name}</span>
          ) : null}
          <Pill tone="neutral" className={channelTone(comm.channel)}>
            {comm.channel}
          </Pill>
          <span className="text-[11px] text-muted-foreground">
            <RelativeTime iso={comm.occurredAt} />
          </span>
          {intent ? (
            <Pill
              tone={
                intent === "high_intent" ? "positive" : intent === "objection" ? "medium" : "info"
              }
            >
              {INTENT_LABEL[intent]}
            </Pill>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">“{comm.preview}”</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {comm.enrichment
              ? `AI · ${((comm.enrichment.intentConfidence ?? 0.7) * 100).toFixed(0)}% confidence`
              : "unclassified"}
          </span>
          {comm.handled ? (
            <Pill tone="positive">Handled</Pill>
          ) : (
            <QuickAction
              prospectId={comm.prospectId}
              action={comm.channel === "call" ? "call" : "reply"}
              label="Reply"
              variant="default"
              size="xs"
            />
          )}
        </div>
      </div>
    </div>
  );
}
