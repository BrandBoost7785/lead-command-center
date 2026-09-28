import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, Pause, Play, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { useBusiness } from "@/hooks/use-app-store";
import { actions } from "@/lib/data/store";
import { cn } from "@/lib/utils";
import { ACTION_STATUS_LABEL, ACTION_TYPE_LABEL, EVENT_LABEL } from "@/components/app/labels";
import {
  Avatar,
  EmptyState,
  Panel,
  Pill,
  RelativeTime,
  StatCard,
} from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DomainEvent } from "@/lib/domain/types";

export const Route = createFileRoute("/_app/ai-activity")({
  component: AIActivityScreen,
});

function AIActivityScreen() {
  const { state, businessId, index, aiPaused } = useBusiness();
  const [filter, setFilter] = useState<"all" | "ai" | "automation" | "actions" | "audit">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const events = state.events.filter((e) => e.businessId === businessId);
  const aiEvents = events.filter((e) => e.actorKind === "ai" || e.type.startsWith("AI_"));
  const automationEvents = events.filter(
    (e) => e.actorKind === "automation" || e.type.startsWith("AUTOMATION"),
  );
  const actions_ = state.actions.filter((a) => a.businessId === businessId);
  const audit = state.audit.filter((a) => a.businessId === businessId);

  const list: DomainEvent[] =
    filter === "ai" ? aiEvents : filter === "automation" ? automationEvents : events;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI activity & decision log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Full transparency: what happened, why, how confident the AI was, what it did, and
            whether it can be undone.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={aiPaused ? "medium" : "positive"} icon={<ShieldCheck className="h-3 w-3" />}>
            {aiPaused ? "Autonomous execution paused" : "Autonomous execution enabled"}
          </Pill>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => actions.toggleAiPause(businessId)}
          >
            {aiPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {aiPaused ? "Resume AI" : "Pause AI"}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="AI events"
          value={aiEvents.length}
          tone="info"
          icon={<Sparkles className="h-3.5 w-3.5" />}
        />
        <StatCard label="Automation runs" value={automationEvents.length} tone="medium" />
        <StatCard
          label="AI actions"
          value={actions_.length}
          hint={`${actions_.filter((a) => a.status === "executed").length} executed`}
        />
        <StatCard
          label="Reverted"
          value={actions_.filter((a) => a.status === "reverted").length}
          tone={actions_.some((a) => a.status === "reverted") ? "critical" : "positive"}
          hint="undo remains available"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Panel dense>
          <div className="border-b border-border/70 p-3">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList className="h-8">
                <TabsTrigger value="all" className="text-xs">
                  Chronological
                </TabsTrigger>
                <TabsTrigger value="ai" className="text-xs">
                  AI decisions
                </TabsTrigger>
                <TabsTrigger value="automation" className="text-xs">
                  Automations
                </TabsTrigger>
                <TabsTrigger value="audit" className="text-xs">
                  Audit trail
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {filter === "audit" ? (
            <div className="divide-y divide-border/70">
              {audit.slice(0, 60).map((a) => (
                <div key={a.id} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={a.actorKind === "ai" ? "ai" : "neutral"}>{a.actorKind}</Pill>
                    <span className="text-xs font-medium">{a.actorName}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {a.action} → {a.targetType} “{a.targetLabel}”
                    </span>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      <RelativeTime iso={a.occurredAt} />
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{a.reason}</p>
                  {a.previousState || a.newState ? (
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {a.previousState ? JSON.stringify(a.previousState) : "—"} →{" "}
                      {a.newState ? JSON.stringify(a.newState) : "—"}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border/70">
              {list.slice(0, 80).map((e) => {
                const prospect = e.prospectId
                  ? state.prospects.find((p) => p.id === e.prospectId)
                  : undefined;
                const contact = prospect ? index.contactOf(prospect) : undefined;
                const actor = state.users.find((u) => u.id === e.actorId);
                const isOpen = expanded === e.id;
                return (
                  <button
                    key={e.id}
                    onClick={() => setExpanded(isOpen ? null : e.id)}
                    className="block w-full px-4 py-2.5 text-left hover:bg-accent/40"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-14 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {new Date(e.occurredAt).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          e.actorKind === "ai"
                            ? "bg-violet-500"
                            : e.actorKind === "automation"
                              ? "bg-amber-500"
                              : e.actorKind === "user"
                                ? "bg-sky-500"
                                : "bg-slate-400",
                        )}
                      />
                      <span className="text-xs font-medium">{e.summary}</span>
                      <Pill tone="neutral">{EVENT_LABEL[e.type] ?? e.type}</Pill>
                      {contact ? (
                        <Link
                          to="/prospects/$id"
                          params={{ id: e.prospectId! }}
                          className="text-[11px] text-muted-foreground hover:underline"
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          {contact.firstName} {contact.lastName}
                        </Link>
                      ) : null}
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        <RelativeTime iso={e.occurredAt} />
                      </span>
                    </div>
                    {e.detail ? (
                      <p className="mt-1 pl-[68px] text-[11px] text-muted-foreground">{e.detail}</p>
                    ) : null}
                    {e.effects?.length ? (
                      <div className="mt-1 flex flex-wrap gap-1 pl-[68px]">
                        {e.effects.map((x, i) => (
                          <Pill key={i} tone="ai">
                            {x.label}
                            {x.delta ? ` (${x.delta > 0 ? "+" : ""}${x.delta})` : ""}
                          </Pill>
                        ))}
                      </div>
                    ) : null}
                    {isOpen ? (
                      <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-background/70 p-2.5 pl-3">
                        <p className="text-[11px]">
                          <span className="font-medium">Actor:</span>{" "}
                          {actor ? `${actor.name} (${e.actorKind})` : e.actorKind} · channel{" "}
                          {e.channel ?? "—"}
                        </p>
                        <p className="text-[11px]">
                          <span className="font-medium">Processed by:</span>{" "}
                          {(e.processedBy ?? []).join(" → ") || "—"}
                        </p>
                        {e.payload ? (
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {JSON.stringify(e.payload)}
                          </p>
                        ) : null}
                        <p className="text-[10px] text-muted-foreground">
                          Event {e.id} · automation eligible:{" "}
                          {String(Boolean(e.automationEligible))}
                        </p>
                      </div>
                    ) : null}
                  </button>
                );
              })}
              {list.length === 0 ? (
                <EmptyState
                  icon={<Activity className="h-5 w-5" />}
                  title="No events in this filter"
                />
              ) : null}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel
            title="AI actions & undo"
            subtitle="Every action keeps its rationale and an undo path."
            dense
          >
            <div className="divide-y divide-border/70">
              {actions_.slice(0, 10).map((a) => {
                const prospect = a.prospectId
                  ? state.prospects.find((p) => p.id === a.prospectId)
                  : undefined;
                const agent = index.userOf(a.agentId);
                return (
                  <div key={a.id} className="space-y-1.5 px-4 py-3">
                    <div className="flex items-start gap-2">
                      {agent ? (
                        <Avatar name={agent.name} color={agent.avatarColor} size={24} isAi />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">{a.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {ACTION_TYPE_LABEL[a.type]} ·{" "}
                          <Pill
                            tone={
                              a.status === "executed"
                                ? "positive"
                                : a.status === "rejected"
                                  ? "critical"
                                  : a.status === "reverted"
                                    ? "medium"
                                    : "ai"
                            }
                          >
                            {ACTION_STATUS_LABEL[a.status]}
                          </Pill>{" "}
                          · {(a.confidence * 100).toFixed(0)}% ·{" "}
                          <RelativeTime iso={a.executedAt ?? a.createdAt} />
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] italic text-muted-foreground">Why: {a.rationale}</p>
                    {a.result ? (
                      <p className="text-[11px] text-muted-foreground">Result: {a.result}</p>
                    ) : null}
                    {prospect ? (
                      <Link
                        to="/prospects/$id"
                        params={{ id: prospect.id }}
                        className="text-[11px] underline"
                      >
                        {index.nameOf(prospect)}
                      </Link>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5">
                      {a.status === "awaiting_approval" || a.status === "proposed" ? (
                        <>
                          <Button
                            size="xs"
                            onClick={() => {
                              actions.approveAction(a.id);
                              actions.executeAction(a.id);
                            }}
                          >
                            Approve & execute
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => actions.rejectAction(a.id)}
                          >
                            Reject
                          </Button>
                        </>
                      ) : null}
                      {a.status === "executed" && a.revertible ? (
                        <Button
                          size="xs"
                          variant="outline"
                          className="gap-1"
                          onClick={() => actions.revertAction(a.id)}
                        >
                          <RotateCcw className="h-3 w-3" /> Undo
                        </Button>
                      ) : null}
                      {a.status === "executed" ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            actions.proposeAction({
                              type: "notify_manager",
                              title: `Change rule for ${ACTION_TYPE_LABEL[a.type].toLowerCase()}`,
                              rationale:
                                "User requested a rule change after reviewing this decision.",
                              expectedOutcome: "Future decisions of this type follow the new rule.",
                              confidence: 0.9,
                              prospectId: a.prospectId,
                            })
                          }
                        >
                          Change rule
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Transparency summary" dense>
            <div className="space-y-2 p-4 text-[11px] text-muted-foreground">
              <p>
                {aiEvents.length} AI-attributed events, {automationEvents.length} automation runs,{" "}
                {state.audit.filter((a) => a.businessId === businessId).length} audit entries for
                this business.
              </p>
              <p>
                Every action records: actor, before/after state, reason, confidence and
                reversibility — nothing the AI does is invisible.
              </p>
              <p className="rounded-md border border-border bg-background/60 p-2">
                Model: lead-intel/reasoner-1 · providers pluggable (OpenAI / Anthropic / local) ·
                per-business autonomy and per-agent scopes enforced before execution.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
