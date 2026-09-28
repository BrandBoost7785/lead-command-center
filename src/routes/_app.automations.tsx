import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Play, Plus, Sparkles, Workflow, Zap } from "lucide-react";
import { useBusiness } from "@/hooks/use-app-store";
import { actions } from "@/lib/data/store";
import { ACTION_TYPE_LABEL, EVENT_LABEL } from "@/components/app/labels";
import { cn } from "@/lib/utils";
import { EmptyState, Panel, Pill, RelativeTime, StatCard } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type {
  AutomationCondition,
  AutomationConditionField,
  AutomationOperator,
  EventType,
} from "@/lib/domain/types";

export const Route = createFileRoute("/_app/automations")({
  component: AutomationsScreen,
});

const TRIGGERS: EventType[] = [
  "EMAIL_RECEIVED",
  "CALL_MISSED",
  "SMS_RECEIVED",
  "WHATSAPP_RECEIVED",
  "FORM_ABANDONED",
  "FORM_COMPLETED",
  "TASK_OVERDUE",
  "APPOINTMENT_MISSED",
  "LEAD_CREATED",
  "PROPOSAL_VIEWED",
];

const FIELDS: AutomationConditionField[] = [
  "intent",
  "priority",
  "score",
  "state",
  "source",
  "channel",
  "value",
  "formStatus",
  "tag",
  "timeSinceLastContactHours",
  "companyTier",
];

const OPERATORS: AutomationOperator[] = [
  "equals",
  "not_equals",
  "contains",
  "greater_than",
  "less_than",
  "in",
  "not_in",
  "is_true",
];

const ACTION_TYPES = [
  "create_task",
  "send_email",
  "send_sms",
  "send_intake_reminder",
  "notify_manager",
  "update_priority",
  "update_pipeline_state",
  "schedule_follow_up",
  "escalate",
  "create_notification",
] as const;

function AutomationsScreen() {
  const { state, businessId, index } = useBusiness();
  const automations = state.automations.filter((a) => a.businessId === businessId);
  const runs = state.automationRuns.filter((r) => r.businessId === businessId).slice(0, 8);

  const [building, setBuilding] = useState(false);
  const [trigger, setTrigger] = useState<EventType>("EMAIL_RECEIVED");
  const [condition, setCondition] = useState<AutomationCondition>({
    id: "c1",
    field: "intent",
    operator: "equals",
    value: "high_intent",
    logic: "AND",
  });
  const [actionType, setActionType] = useState<(typeof ACTION_TYPES)[number]>("notify_manager");
  const [name, setName] = useState("");

  const suggestion = state.insights.find(
    (i) => i.businessId === businessId && i.kind === "automation_suggestion" && !i.dismissed,
  );

  const stats = useMemo(
    () => ({
      active: automations.filter((a) => a.status === "active").length,
      runs: automations.reduce((s, a) => s + a.runCount, 0),
      failures: automations.reduce((s, a) => s + a.failureCount, 0),
      savedHours: Math.round(automations.reduce((s, a) => s + a.successCount, 0) * 0.08),
    }),
    [automations],
  );

  const create = () => {
    actions.acceptAutomationSuggestion({
      tenantId: state.session.tenantId,
      businessId,
      name:
        name ||
        `${EVENT_LABEL[trigger] ?? trigger} → ${ACTION_TYPE_LABEL[actionType as keyof typeof ACTION_TYPE_LABEL] ?? actionType}`,
      description: `Created in the builder: WHEN ${EVENT_LABEL[trigger] ?? trigger} IF ${condition.field} ${condition.operator} ${String(condition.value)} THEN ${actionType.replace(/_/g, " ")}.`,
      status: "active",
      trigger,
      conditions: [condition],
      actions: [
        {
          id: "a1",
          type: actionType as never,
          label: actionType.replace(/_/g, " "),
          params: {},
          requiresApproval: actionType !== "create_task" && actionType !== "update_priority",
        },
      ],
      runCount: 0,
      successCount: 0,
      failureCount: 0,
      createdBy: state.session.userId,
      createdByKind: "user",
    });
    setBuilding(false);
    setName("");
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Automations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            WHEN an event → IF the conditions hold → THEN take action. The AI also proposes
            automations from repeated behaviour.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setBuilding((v) => !v)}>
          <Plus className="h-3.5 w-3.5" /> New automation
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active rules"
          value={stats.active}
          tone="positive"
          icon={<Workflow className="h-3.5 w-3.5" />}
        />
        <StatCard label="Runs" value={stats.runs} />
        <StatCard
          label="Failures"
          value={stats.failures}
          tone={stats.failures ? "critical" : "positive"}
        />
        <StatCard label="Estimated hours saved" value={stats.savedHours} tone="info" />
      </div>

      {suggestion ? (
        <Panel
          className="border-violet-500/30 bg-violet-500/[0.04]"
          title="AI-suggested automation"
          icon={<Sparkles className="h-4 w-4 text-violet-500" />}
        >
          <p className="text-xs font-medium">{suggestion.title}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{suggestion.body}</p>
          {suggestion.bullets?.length ? (
            <ul className="mt-2 space-y-1">
              {suggestion.bullets.map((b) => (
                <li key={b} className="text-[11px] text-muted-foreground">
                  · {b}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() =>
                actions.acceptAutomationSuggestion({
                  tenantId: state.session.tenantId,
                  businessId,
                  name: "Unassigned website leads",
                  description:
                    "WHEN FORM_COMPLETED IF source = website_form THEN notify owner and create a 15-minute call task.",
                  status: "active",
                  trigger: "FORM_COMPLETED",
                  conditions: [
                    {
                      id: "c1",
                      field: "source",
                      operator: "equals",
                      value: "website_form",
                      logic: "AND",
                    },
                  ],
                  actions: [
                    {
                      id: "a1",
                      type: "notify_manager",
                      label: "Notify owner",
                      params: {},
                      requiresApproval: false,
                    },
                    {
                      id: "a2",
                      type: "create_task",
                      label: "Create 15-minute call task",
                      params: { minutes: 15 },
                      requiresApproval: false,
                    },
                  ],
                  runCount: 0,
                  successCount: 0,
                  failureCount: 0,
                  createdBy: "agent_ava",
                  createdByKind: "ai",
                  aiSuggested: true,
                })
              }
            >
              <Zap className="h-3.5 w-3.5" /> Create this automation
            </Button>
            <Button size="sm" variant="ghost" onClick={() => actions.dismissInsight(suggestion.id)}>
              Dismiss
            </Button>
          </div>
        </Panel>
      ) : null}

      {building ? (
        <Panel title="Automation builder" subtitle="Event → condition → action. No code required.">
          <div className="space-y-3">
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  When
                </p>
                <Select value={trigger} onValueChange={(v) => setTrigger(v as EventType)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGERS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {EVENT_LABEL[t] ?? t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 lg:col-span-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  If
                </p>
                <div className="flex gap-2">
                  <Select
                    value={condition.field}
                    onValueChange={(v) =>
                      setCondition((c) => ({ ...c, field: v as AutomationConditionField }))
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELDS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={condition.operator}
                    onValueChange={(v) =>
                      setCondition((c) => ({ ...c, operator: v as AutomationOperator }))
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={String(condition.value)}
                    onChange={(e) => setCondition((c) => ({ ...c, value: e.target.value }))}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Then
                </p>
                <Select
                  value={actionType}
                  onValueChange={(v) => setActionType(v as typeof actionType)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((a) => (
                      <SelectItem key={a} value={a}>
                        {ACTION_TYPE_LABEL[a as keyof typeof ACTION_TYPE_LABEL] ??
                          a.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Name
                </p>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Hot intent response sprint"
                  className="h-9 text-xs"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button size="sm" onClick={create}>
                  Create automation
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setBuilding(false)}>
                  Cancel
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Conditions evaluate against the event payload and the prospect record. Actions marked
              “requires approval” queue in the AI Activity screen instead of executing immediately.
            </p>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Panel dense>
          <div className="divide-y divide-border/70">
            {automations.map((a) => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{a.name}</span>
                  <Pill
                    tone={
                      a.status === "active"
                        ? "positive"
                        : a.status === "paused"
                          ? "medium"
                          : "neutral"
                    }
                  >
                    {a.status}
                  </Pill>
                  {a.aiSuggested ? <Pill tone="ai">AI suggested</Pill> : null}
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {a.runCount} runs · {a.successCount} ok · {a.failureCount} failed · last{" "}
                    <RelativeTime iso={a.lastRunAt} />
                  </span>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => actions.toggleAutomation(a.id)}
                  >
                    {a.status === "active" ? "Pause" : "Activate"}
                  </Button>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{a.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <Pill tone="info">WHEN {EVENT_LABEL[a.trigger] ?? a.trigger}</Pill>
                  {a.conditions.map((c) => (
                    <Pill key={c.id} tone="neutral">
                      IF {c.field} {c.operator.replace(/_/g, " ")} {String(c.value)}
                    </Pill>
                  ))}
                  {a.actions.map((act) => (
                    <Pill key={act.id} tone={act.requiresApproval ? "medium" : "positive"}>
                      THEN {act.label}
                      {act.requiresApproval ? " (approval)" : ""}
                    </Pill>
                  ))}
                </div>
              </div>
            ))}
            {automations.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<Workflow className="h-5 w-5" />}
                  title="No automations yet"
                  body="Create one above, or accept an AI suggestion."
                />
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel title="Recent runs" dense>
          <div className="divide-y divide-border/70">
            {runs.map((r) => {
              const automation = state.automations.find((a) => a.id === r.automationId);
              const prospect = state.prospects.find((p) => p.id === r.prospectId);
              return (
                <div key={r.id} className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        r.status === "success"
                          ? "bg-emerald-500"
                          : r.status === "failed"
                            ? "bg-rose-500"
                            : r.status === "pending_approval"
                              ? "bg-amber-500"
                              : "bg-slate-400",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">
                      {automation?.name}
                    </span>
                    <Pill
                      tone={
                        r.status === "success"
                          ? "positive"
                          : r.status === "failed"
                            ? "critical"
                            : "neutral"
                      }
                    >
                      {r.status}
                    </Pill>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{r.detail}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {prospect ? `${index.nameOf(prospect)} · ` : ""}
                    <RelativeTime iso={r.startedAt} />
                  </p>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
