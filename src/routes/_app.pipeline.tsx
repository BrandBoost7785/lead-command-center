import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Kanban, List, Sparkles } from "lucide-react";
import { useBusiness } from "@/hooks/use-app-store";
import { actions } from "@/lib/data/store";
import { buildPipelineSnapshot } from "@/lib/intelligence/attention";
import { currency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Avatar,
  HotFlame,
  Panel,
  Pill,
  RelativeTime,
  ScoreRing,
} from "@/components/app/primitives";
import { QuickAction } from "@/components/app/prospect-actions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PipelineStateKey } from "@/lib/domain/types";

export const Route = createFileRoute("/_app/pipeline")({
  component: PipelineScreen,
});

function PipelineScreen() {
  const { state, businessId, index } = useBusiness();
  const pipeline =
    state.pipelines.find((p) => p.businessId === businessId && p.isDefault) ?? state.pipelines[0];
  const snapshot = useMemo(() => buildPipelineSnapshot(state, businessId), [state, businessId]);
  const [view, setView] = useState<"kanban" | "list" | "analytics">("kanban");

  const prospectsByState = (key: PipelineStateKey) =>
    index.prospects.filter((p) => p.state === key).sort((a, b) => b.score - a.score);

  const autoMoved = state.prospects.filter(
    (p) => p.businessId === businessId && p.stateInferred,
  ).length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {autoMoved} of {index.prospects.length} records are positioned automatically from
            behaviour. Manual override is always available.
          </p>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
          <TabsList className="h-8">
            <TabsTrigger value="kanban" className="gap-1 text-xs">
              <Kanban className="h-3 w-3" /> Kanban
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-1 text-xs">
              <List className="h-3 w-3" /> List
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1 text-xs">
              Analytics
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {view === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {pipeline.states.map((stage) => {
            const items = prospectsByState(stage.key);
            const value = items.reduce((s, p) => s + p.value, 0);
            return (
              <div key={stage.key} className="w-[248px] shrink-0">
                <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-card px-2.5 py-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <span className="h-2 w-2 rounded-full" style={{ background: stage.color }} />
                    {stage.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {items.length} · {currency(value)}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((p) => {
                    const contact = index.contactOf(p);
                    const company = index.companyOf(p);
                    return (
                      <div key={p.id} className="rounded-lg border border-border bg-card p-2.5">
                        <div className="flex items-start gap-2">
                          {contact ? (
                            <Avatar
                              name={`${contact.firstName} ${contact.lastName}`}
                              color={contact.avatarColor}
                              size={24}
                            />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <Link
                              to="/prospects/$id"
                              params={{ id: p.id }}
                              className="flex items-center gap-1 truncate text-xs font-medium hover:underline"
                            >
                              {index.nameOf(p)} <HotFlame score={p.score} />
                            </Link>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {company?.name ?? "—"}
                            </p>
                          </div>
                          <ScoreRing score={p.score} size={26} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          <Pill tone="neutral">{currency(p.value)}</Pill>
                          <Pill tone={p.priority}>{p.priority}</Pill>
                          {p.stateInferred ? (
                            <Pill tone="ai">auto</Pill>
                          ) : (
                            <Pill tone="medium">manual</Pill>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">
                            <RelativeTime iso={p.lastActivityAt} />
                          </span>
                          <div className="flex gap-1">
                            <QuickAction
                              prospectId={p.id}
                              action={p.nextActionType === "call" ? "call" : "reply"}
                              label=""
                              variant="outline"
                              size="xs"
                            />
                            <Select
                              value={p.state}
                              onValueChange={(v) =>
                                actions.updateProspect(
                                  p.id,
                                  { state: v as PipelineStateKey, stateInferred: false },
                                  "Manual pipeline override.",
                                )
                              }
                            >
                              <SelectTrigger className="h-6 w-6 border-0 p-0 shadow-none [&>svg]:opacity-60">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {pipeline.states.map((s) => (
                                  <SelectItem key={s.key} value={s.key}>
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-2 py-4 text-center text-[11px] text-muted-foreground">
                      Empty
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {view === "list" ? (
        <Panel dense>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Prospect</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">Value</th>
                <th className="px-3 py-2">Probability</th>
                <th className="px-3 py-2">Weighted</th>
                <th className="px-3 py-2">Movement reason</th>
                <th className="px-3 py-2">Last activity</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.flatMap((stage) =>
                prospectsByState(stage.key as PipelineStateKey).map((p) => (
                  <tr key={p.id} className="border-b border-border/60 hover:bg-accent/40">
                    <td className="px-3 py-2">
                      <Link
                        to="/prospects/$id"
                        params={{ id: p.id }}
                        className="font-medium hover:underline"
                      >
                        {index.nameOf(p)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Pill tone="neutral">{stage.label}</Pill>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{currency(p.value)}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {(stage.probability * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {currency(p.value * stage.probability)}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">
                      {p.stateInferred ? "Inferred from behaviour" : "Manually overridden"}
                    </td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">
                      <RelativeTime iso={p.lastActivityAt} />
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </Panel>
      ) : null}

      {view === "analytics" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel
            title="Stage conversion"
            subtitle="Counts, value and how the stage is defined — no manual maintenance required."
            dense
          >
            <div className="divide-y divide-border/70">
              {pipeline.states.map((stage) => {
                const snap = snapshot.find((s) => s.key === stage.key);
                return (
                  <div key={stage.key} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-xs font-medium">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: stage.color }}
                        />
                        {stage.label}
                        {stage.autoManaged ? (
                          <Pill tone="ai">auto</Pill>
                        ) : (
                          <Pill tone="medium">manual</Pill>
                        )}
                      </span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {snap?.count ?? 0} · {currency(snap?.value ?? 0)} · weighted{" "}
                        {currency(snap?.weightedValue ?? 0)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Entry: {stage.entryCriteria.join(" · ")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Conversion target:{" "}
                      {(
                        ((pipeline.conversionTargets[stage.key] as number) ?? stage.probability) *
                        100
                      ).toFixed(0)}
                      %
                    </p>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Pipeline health" dense>
            <div className="space-y-3 p-4">
              {snapshot
                .filter((s) => s.count > 0)
                .map((s) => {
                  const max = Math.max(...snapshot.map((x) => x.value), 1);
                  return (
                    <div key={s.key}>
                      <div className="flex items-center justify-between text-xs">
                        <span>{s.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {currency(s.value)}
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full"
                          style={{ width: `${(s.value / max) * 100}%`, background: s.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.06] p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium">
                  <Sparkles className="h-3.5 w-3.5 text-violet-500" /> AI observation
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {(() => {
                    const quiet = index.prospects
                      .filter(
                        (p) => p.state !== "won" && p.state !== "lost" && p.state !== "customer",
                      )
                      .sort((a, b) => +new Date(a.lastActivityAt) - +new Date(b.lastActivityAt))[0];
                    if (!quiet) return "Pipeline is healthy.";
                    return `${index.nameOf(quiet)} has been quiet the longest (${Math.round((Date.now() - +new Date(quiet.lastActivityAt)) / 86_400_000)} days) while sitting in ${quiet.state} at ${currency(quiet.value)}. A re-engagement touch is recommended before the stage probability decays further.`;
                  })()}
                </p>
                <Button
                  size="xs"
                  variant="outline"
                  className="mt-2"
                  onClick={() => actions.recomputeIntelligence()}
                >
                  Re-run intelligence sweep
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
