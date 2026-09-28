import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { useBusiness } from "@/hooks/use-app-store";
import { buildAnalytics } from "@/lib/services/queries";
import { answerCommand } from "@/lib/ai/reasoner";
import { currency, percent } from "@/lib/format";
import { Avatar, Panel, Pill, StatCard } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/analytics")({
  component: AnalyticsScreen,
});

function AnalyticsScreen() {
  const { state, businessId, index } = useBusiness();
  const analytics = useMemo(() => buildAnalytics(state, businessId), [state, businessId]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<ReturnType<typeof answerCommand> | null>(null);

  const wonValue = state.deals
    .filter((d) => d.businessId === businessId && d.won)
    .reduce((s, d) => s + d.value, 0);
  const lostValue = state.deals
    .filter((d) => d.businessId === businessId && d.won === false)
    .reduce((s, d) => s + d.value, 0);
  const totalLeads = index.prospects.length;
  const contacted = index.prospects.filter((p) => p.state !== "new").length;
  const responded = index.prospects.filter((p) => p.lastInboundAt).length;
  const appointments = index.prospects.filter((p) =>
    ["appointment", "proposal", "negotiation", "won", "customer"].includes(p.state),
  ).length;

  const ask = () => {
    if (!question.trim()) return;
    setAnswer(answerCommand({ state, businessId, query: question }));
    setQuestion("");
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every number here is derived from the event log — including AI performance and what it
          changed.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard label="Lead volume" value={totalLeads} hint="all time" />
        <StatCard
          label="Contact rate"
          value={percent(contacted / Math.max(1, totalLeads))}
          tone="info"
          hint={`${contacted} contacted`}
        />
        <StatCard
          label="Response rate"
          value={percent(responded / Math.max(1, totalLeads))}
          tone="positive"
          hint={`${responded} replied`}
        />
        <StatCard
          label="Appointment rate"
          value={percent(appointments / Math.max(1, totalLeads))}
          tone="medium"
          hint={`${appointments} reached`}
        />
        <StatCard label="Won" value={currency(wonValue)} tone="positive" />
        <StatCard
          label="Lost"
          value={currency(lostValue)}
          tone="critical"
          hint={`${analytics.lostReasons.length} reasons logged`}
        />
      </div>

      <Panel
        title="Ask your data"
        subtitle="Natural-language analytics over the same event store."
        icon={<Sparkles className="h-4 w-4 text-violet-500" />}
      >
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder="e.g. Why did conversions fall this month?"
            className="h-9 text-sm"
          />
          <Button size="sm" onClick={ask}>
            Ask
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            "Why did conversions fall this month?",
            "Which sources convert best?",
            "How fast do we respond?",
            "What is the AI doing?",
          ].map((q) => (
            <button
              key={q}
              onClick={() => setQuestion(q)}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-violet-500/50"
            >
              {q}
            </button>
          ))}
        </div>
        {answer ? (
          <div className="mt-3 rounded-lg border border-border bg-background/70 p-3">
            <p className="text-xs font-semibold">{answer.title}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{answer.body}</p>
            {answer.metrics?.length ? (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {answer.metrics.map((m) => (
                  <div key={m.label} className="rounded-md border border-border px-2 py-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {m.label}
                    </p>
                    <p className="text-xs font-semibold">{m.value}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {answer.bullets?.length ? (
              <ul className="mt-2 space-y-1">
                {answer.bullets.slice(0, 5).map((b, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground">
                    · {b}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Funnel" subtitle="Stage counts with implied conversion.">
          <div className="space-y-2.5">
            {analytics.funnel.map((stage) => {
              const max = Math.max(...analytics.funnel.map((f) => f.count), 1);
              return (
                <div key={stage.label}>
                  <div className="flex items-center justify-between text-xs">
                    <span>{stage.label}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {stage.count} · {currency(stage.value)}
                      {stage.conversion !== undefined
                        ? ` · ${(stage.conversion * 100).toFixed(0)}% conv`
                        : ""}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary/70"
                      style={{ width: `${(stage.count / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="Activity trend (14 days)"
          subtitle="Leads, inbound responses, appointments and wins per day."
        >
          <div className="flex h-40 items-end gap-1">
            {analytics.activityByDay.map((d) => {
              const max = Math.max(
                ...analytics.activityByDay.map((x) =>
                  Math.max(x.leads, x.responses, x.appointments, x.won, 1),
                ),
              );
              return (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-32 w-full items-end justify-center gap-[2px]">
                    <div
                      className="w-1.5 rounded-t bg-sky-500"
                      style={{ height: `${(d.leads / max) * 100}%` }}
                      title={`${d.leads} leads`}
                    />
                    <div
                      className="w-1.5 rounded-t bg-violet-500"
                      style={{ height: `${(d.responses / max) * 100}%` }}
                      title={`${d.responses} responses`}
                    />
                    <div
                      className="w-1.5 rounded-t bg-teal-500"
                      style={{ height: `${(d.appointments / max) * 100}%` }}
                      title={`${d.appointments} appointments`}
                    />
                    <div
                      className="w-1.5 rounded-t bg-emerald-500"
                      style={{ height: `${(d.won / max) * 100}%` }}
                      title={`${d.won} won`}
                    />
                  </div>
                  <span className="hidden text-[9px] text-muted-foreground sm:block">
                    {d.day.split(" ")[1]}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded bg-sky-500" /> leads
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded bg-violet-500" /> responses
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded bg-teal-500" /> appointments
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded bg-emerald-500" /> won
            </span>
          </div>
        </Panel>

        <Panel title="Lead sources" dense>
          <div className="divide-y divide-border/70">
            {analytics.sources.map((s) => (
              <div key={s.source} className="flex items-center justify-between px-4 py-2.5 text-xs">
                <span className="capitalize">{s.source.replace(/_/g, " ")}</span>
                <span className="flex items-center gap-3 text-muted-foreground">
                  <span className="tabular-nums">{s.count} leads</span>
                  <span className="tabular-nums">{s.conversion}% win</span>
                  <span className="tabular-nums">{currency(s.wonValue)}</span>
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Response time distribution"
          subtitle="How quickly inbound messages get a first reply."
          dense
        >
          <div className="space-y-3 p-4">
            {analytics.responseTimes.map((b) => {
              const max = Math.max(...analytics.responseTimes.map((x) => x.count), 1);
              return (
                <div key={b.bucket}>
                  <div className="flex justify-between text-[11px]">
                    <span>{b.bucket}</span>
                    <span className="tabular-nums text-muted-foreground">{b.count}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={
                        b.bucket === ">24 h"
                          ? "h-full bg-rose-500"
                          : b.bucket === "1–4 h"
                            ? "h-full bg-amber-500"
                            : "h-full bg-emerald-500"
                      }
                      style={{ width: `${(b.count / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Team performance" dense>
          <div className="divide-y divide-border/70">
            {analytics.team.map((m) => (
              <div key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Avatar name={m.name} color={m.avatarColor} size={28} isAi={m.isAi} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{m.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {m.role} · {m.permissions} permissions
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {m.activeProspects} active
                </span>
                <span className="text-[11px] text-muted-foreground">{m.hotProspects} hot</span>
                <Pill tone={m.overdueTasks ? "high" : "positive"}>{m.overdueTasks} overdue</Pill>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {currency(m.wonValue)}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="AI performance" dense>
          <div className="space-y-3 p-4 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border px-2 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Executed
                </p>
                <p className="text-sm font-semibold">{analytics.aiPerformance.executed}</p>
              </div>
              <div className="rounded-lg border border-border px-2 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Rejected
                </p>
                <p className="text-sm font-semibold">{analytics.aiPerformance.rejected}</p>
              </div>
              <div className="rounded-lg border border-border px-2 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Reverted
                </p>
                <p className="text-sm font-semibold">{analytics.aiPerformance.reverted}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Actions by type
              </p>
              <div className="mt-1 space-y-1">
                {analytics.aiPerformance.byType.slice(0, 6).map((t) => (
                  <div key={t.type} className="flex items-center justify-between">
                    <span className="capitalize">{t.type.replace(/_/g, " ")}</span>
                    <span className="tabular-nums text-muted-foreground">{t.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="rounded-md border border-border bg-background/60 p-2 text-[11px] text-muted-foreground">
              AI actions influence outcomes measurably: executed actions precede{" "}
              {analytics.funnel.find((f) => f.label === "Appointment")?.count ?? 0} appointments and{" "}
              {state.deals.filter((d) => d.businessId === businessId && d.won).length} wins in this
              business.
            </p>
          </div>
        </Panel>

        <Panel title="Missed opportunities" subtitle="Quiet, valuable and still open." dense>
          <div className="divide-y divide-border/70">
            {analytics.stalePipeline.map(({ prospect, daysQuiet }) => (
              <div key={prospect.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                <Link
                  to="/prospects/$id"
                  params={{ id: prospect.id }}
                  className="min-w-0 flex-1 truncate font-medium hover:underline"
                >
                  {index.nameOf(prospect)}
                </Link>
                <span className="text-muted-foreground">{prospect.state}</span>
                <Pill tone={daysQuiet >= 8 ? "critical" : "medium"}>{daysQuiet}d quiet</Pill>
                <span className="tabular-nums text-muted-foreground">
                  {currency(prospect.value)}
                </span>
              </div>
            ))}
            {analytics.stalePipeline.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">Nothing is stalling.</p>
            ) : null}
          </div>
        </Panel>

        <Panel title="Why we lose" subtitle="Logged reasons, not guesses." dense>
          <div className="divide-y divide-border/70">
            {analytics.lostReasons.map((r) => (
              <div key={r.reason} className="flex items-center justify-between px-4 py-2.5 text-xs">
                <span className="min-w-0 flex-1 truncate">{r.reason}</span>
                <span className="text-muted-foreground">
                  {r.count} deal{r.count === 1 ? "" : "s"} · {currency(r.value)}
                </span>
              </div>
            ))}
            {analytics.lostReasons.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">No losses recorded.</p>
            ) : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
