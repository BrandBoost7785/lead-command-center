import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Building2, Database, KeyRound, Lock, Sparkles } from "lucide-react";
import { useBusiness } from "@/hooks/use-app-store";
import { actions } from "@/lib/data/store";
import { DEFAULT_WEIGHTS, SCORING_MODEL_VERSION, SIGNAL_LABEL } from "@/lib/intelligence/scoring";
import { PERMISSION_GROUPS, ROLES, ROLE_LIST } from "@/lib/domain/permissions";
import { CHANNEL_LABEL, SOURCE_LABEL, STATE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AUTONOMY_LABEL, AUTONOMY_SHORT, INTEGRATION_STATUS_TONE } from "@/components/app/labels";
import { Avatar, Panel, Pill } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AutonomyMode, SignalKey } from "@/lib/domain/types";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsScreen,
});

const SECTIONS = [
  "profile",
  "ai",
  "automation",
  "notifications",
  "communications",
  "scoring",
  "pipeline",
  "forms",
  "integrations",
  "permissions",
  "security",
  "data",
  "billing",
  "api",
] as const;

type Section = (typeof SECTIONS)[number];

function SettingsScreen() {
  const { state, businessId, business, currentUser, membership, aiPaused } = useBusiness();
  const [section, setSection] = useState<Section>("ai");
  const [name, setName] = useState(currentUser?.name ?? "");

  if (!business) return null;
  const settings = business.settings;
  const permissions = membership ? (ROLES[membership.roleKey]?.permissions ?? []) : [];
  const integrationCount = state.integrations.filter((i) => i.businessId === businessId);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {business.name} · settings are scoped to this business, so two businesses under one tenant
          can behave completely differently.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <nav className="space-y-0.5">
          {SECTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={cn(
                "w-full rounded-md px-3 py-1.5 text-left text-xs capitalize text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                section === s && "bg-accent font-medium text-foreground",
              )}
            >
              {s === "ai" ? "AI behavior" : s === "api" ? "API & webhooks" : s}
            </button>
          ))}
        </nav>

        <div className="space-y-4">
          {section === "profile" ? (
            <Panel title="Your profile" subtitle="How you appear across the workspace.">
              <div className="flex items-start gap-4">
                <Avatar
                  name={currentUser?.name ?? "You"}
                  color={currentUser?.avatarColor ?? "#6366f1"}
                  size={48}
                />
                <div className="flex-1 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium">Name</p>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium">Email</p>
                      <Input value={currentUser?.email ?? ""} readOnly className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium">Title</p>
                      <Input value={currentUser?.title ?? ""} readOnly className="h-9 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium">Role in this business</p>
                      <Input
                        value={ROLES[membership?.roleKey ?? "salesperson"]?.name ?? ""}
                        readOnly
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {membership
                      ? `${permissions.length} permissions effective from the ${ROLES[membership.roleKey]?.name} role.`
                      : "No membership in this business."}
                  </p>
                </div>
              </div>
            </Panel>
          ) : null}

          {section === "ai" ? (
            <>
              <Panel
                title="AI behavior"
                subtitle="Autonomy is configurable per business, user, agent, action type and workflow — never all-or-nothing."
              >
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {(["assist", "approve", "autonomous"] as AutonomyMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => actions.setAutonomy(businessId, mode)}
                        className={cn(
                          "rounded-lg border border-border px-3 py-2.5 text-left",
                          settings.defaultAutonomy === mode
                            ? "border-violet-500/60 bg-violet-500/[0.06]"
                            : "hover:bg-accent/50",
                        )}
                      >
                        <p className="text-xs font-semibold">{AUTONOMY_LABEL[mode]}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {mode === "assist"
                            ? "AI suggests only. Humans do everything."
                            : mode === "approve"
                              ? "AI drafts and queues work; a human approves before it executes."
                              : "AI acts within its scopes and reports what it did."}
                        </p>
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background/60 px-3 py-2 text-[11px]">
                    <Pill tone={aiPaused ? "medium" : "positive"}>
                      {aiPaused ? "Global AI paused" : "Global AI running"}
                    </Pill>
                    <span className="text-muted-foreground">
                      Kill switch pauses every agent instantly while keeping recommendations
                      visible.
                    </span>
                    <Button
                      size="xs"
                      variant="outline"
                      className="ml-auto"
                      onClick={() => actions.toggleAiPause(businessId)}
                    >
                      {aiPaused ? "Resume all AI" : "Pause all AI"}
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-border p-3 text-[11px]">
                      <p className="text-xs font-medium">Quiet hours</p>
                      <p className="mt-1 text-muted-foreground">
                        {settings.quietHours.start}–{settings.quietHours.end} — autonomous sends
                        pause, intelligence keeps running.
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-3 text-[11px]">
                      <p className="text-xs font-medium">Follow-up SLA</p>
                      <p className="mt-1 text-muted-foreground">
                        {settings.followUpSlaHours} hours before a follow-up is considered overdue.
                      </p>
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel
                title="AI agents"
                subtitle="Each agent has a purpose, scopes, autonomy and escalation path."
                dense
              >
                <div className="divide-y divide-border/70">
                  {state.agents
                    .filter((a) => a.businessId === businessId)
                    .map((a) => (
                      <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                        <Avatar name={a.name} color="#8b5cf6" size={28} isAi />
                        <div className="min-w-[200px] flex-1">
                          <p className="text-xs font-medium">
                            {a.name}{" "}
                            <span className="font-normal text-muted-foreground">· {a.model}</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground">{a.purpose}</p>
                        </div>
                        <Pill tone={a.autonomy === "autonomous" ? "ai" : "neutral"}>
                          {AUTONOMY_SHORT[a.autonomy]}
                        </Pill>
                        <Pill tone="neutral">floor {(a.confidenceFloor * 100).toFixed(0)}%</Pill>
                        <Pill tone={a.status === "active" ? "positive" : "medium"}>{a.status}</Pill>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() =>
                            actions.setAgentStatus(
                              a.id,
                              a.status === "paused" ? "active" : "paused",
                            )
                          }
                        >
                          {a.status === "paused" ? "Resume" : "Pause"}
                        </Button>
                      </div>
                    ))}
                </div>
              </Panel>
            </>
          ) : null}

          {section === "automation" ? (
            <Panel
              title="Automation rules"
              subtitle="Automation behaviour lives here, but rules are built on the Automations screen."
              dense
            >
              <div className="space-y-2 p-4 text-[12px] text-muted-foreground">
                <p>
                  {state.automations.filter((a) => a.businessId === businessId).length} rules
                  configured ·{" "}
                  {
                    state.automations.filter(
                      (a) => a.businessId === businessId && a.status === "active",
                    ).length
                  }{" "}
                  active ·{" "}
                  {
                    state.automationRuns.filter(
                      (r) => r.businessId === businessId && r.status === "failed",
                    ).length
                  }{" "}
                  failures in the current window.
                </p>
                <p>
                  Actions marked{" "}
                  <span className="font-medium text-foreground">requires approval</span> queue for a
                  human even under autonomous mode, unless the acting agent's scopes explicitly
                  include the action type.
                </p>
                <div className="flex gap-2">
                  <Button size="xs" onClick={() => (window.location.hash = "/automations")}>
                    Open automation builder
                  </Button>
                </div>
              </div>
            </Panel>
          ) : null}

          {section === "notifications" ? (
            <Panel title="Notifications" subtitle="Per-event, per-channel preferences." dense>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/70 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2 text-left">Event</th>
                    <th className="px-3 py-2">In-app</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Push</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.notifications.map((n) => (
                    <tr key={n.key} className="border-b border-border/60">
                      <td className="px-4 py-2 capitalize">{n.key.replace(/_/g, " ")}</td>
                      <td className="px-3 py-2 text-center">
                        <Switch checked={n.inApp} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Switch checked={n.email} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Switch checked={n.push} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-4 py-3 text-[11px] text-muted-foreground">
                Preferences are demo-only in V1 — the delivery adapters (Slack, email, push) are
                wired through the integrations layer.
              </p>
            </Panel>
          ) : null}

          {section === "communications" ? (
            <Panel
              title="Communication preferences"
              subtitle="Channels the business runs on and how the AI may use them."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(CHANNEL_LABEL) as (keyof typeof CHANNEL_LABEL)[])
                  .slice(0, 6)
                  .map((c) => (
                    <div
                      key={c}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                    >
                      <div>
                        <p className="text-xs font-medium">{CHANNEL_LABEL[c]}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Allowed for AI drafts and sends within autonomy rules
                        </p>
                      </div>
                      <Switch checked />
                    </div>
                  ))}
              </div>
            </Panel>
          ) : null}

          {section === "scoring" ? (
            <Panel
              title="Lead scoring model"
              subtitle={`Model ${SCORING_MODEL_VERSION} · weights are per-business data, not hardcoded, and every recomputation stores its own breakdown.`}
              dense
            >
              <div className="space-y-1.5 p-4">
                {(Object.keys(DEFAULT_WEIGHTS) as SignalKey[]).map((key) => {
                  const weight = settings.scoringWeights?.[key] ?? DEFAULT_WEIGHTS[key];
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-40 text-[11px]">{SIGNAL_LABEL[key] ?? key}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-violet-500/70"
                          style={{ width: `${Math.min(100, weight * 2.5)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-[11px] tabular-nums text-muted-foreground">
                        {weight.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 border-t border-border/70 px-4 py-3">
                <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                <p className="text-[11px] text-muted-foreground">
                  Signals cover recency, response speed, engagement, calls/messages, form
                  completion, appointments, deal value, source, follow-up status, history, intent
                  and AI-opportunity likelihood.
                </p>
                <Button
                  size="xs"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => actions.recomputeIntelligence()}
                >
                  Recompute all scores
                </Button>
              </div>
            </Panel>
          ) : null}

          {section === "pipeline" ? (
            <Panel
              title="Pipeline stages"
              subtitle="Stages can be renamed and reordered per business; inference maps signals onto them."
              dense
            >
              <div className="space-y-2 p-4">
                {state.pipelines
                  .filter((p) => p.businessId === businessId)[0]
                  ?.states.map((s, i) => (
                    <div
                      key={s.key}
                      className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-xs"
                    >
                      <span className="w-5 text-[11px] text-muted-foreground">{i + 1}</span>
                      <span className="font-medium">{s.label ?? STATE_LABEL[s.key] ?? s.key}</span>
                      <Pill tone={s.autoManaged ? "ai" : "neutral"}>
                        {s.autoManaged ? "AI managed" : "manual"}
                      </Pill>
                      <Pill tone="neutral">{Math.round(s.probability * 100)}% likely</Pill>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {
                          state.prospects.filter(
                            (p) => p.businessId === businessId && p.state === s.key,
                          ).length
                        }{" "}
                        prospects
                      </span>
                    </div>
                  ))}
              </div>
            </Panel>
          ) : null}

          {section === "forms" ? (
            <Panel title="Forms & intake" subtitle="Abandonment follow-up defaults." dense>
              <div className="space-y-2 p-4 text-[12px] text-muted-foreground">
                <p>
                  {state.forms.filter((f) => f.businessId === businessId).length} forms ·{" "}
                  {
                    state.submissions.filter(
                      (s) => s.businessId === businessId && s.status !== "completed",
                    ).length
                  }{" "}
                  open submissions ·{" "}
                  {
                    state.submissions.filter(
                      (s) => s.businessId === businessId && s.status === "abandoned",
                    ).length
                  }{" "}
                  abandoned.
                </p>
                <p>
                  Reminders go out {settings.intakeReminderHours} hours after a partial submission
                  unless the rule says otherwise.
                </p>
                <p>
                  Working hours: {settings.workingHours.start}–{settings.workingHours.end} on{" "}
                  {settings.workingHours.days
                    .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
                    .join(", ")}
                  .
                </p>
              </div>
            </Panel>
          ) : null}

          {section === "integrations" ? (
            <Panel
              title="Integrations"
              subtitle="Credentials and provider choices are managed per business."
              dense
            >
              <div className="divide-y divide-border/70">
                {integrationCount.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                    <span className="min-w-0 flex-1 truncate font-medium">{i.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{i.adapter}</span>
                    <Pill tone={INTEGRATION_STATUS_TONE[i.status] ?? "neutral"}>{i.status}</Pill>
                    {i.status === "available" ? (
                      <Button size="xs" onClick={() => actions.connectIntegration(i.id)}>
                        Connect
                      </Button>
                    ) : i.status === "error" ? (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => actions.connectIntegration(i.id)}
                      >
                        Reconnect
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          {section === "permissions" ? (
            <Panel
              title="Roles & permissions"
              subtitle="Granular permissions across leads, comms, forms, pipeline, automations, AI, integrations, reports and admin."
              dense
            >
              <div className="space-y-3 p-4">
                <div className="flex flex-wrap gap-1.5">
                  {ROLE_LIST.map((r) => (
                    <Pill key={r.key} tone="neutral">
                      {r.name} · {r.permissions.length}
                    </Pill>
                  ))}
                </div>
                <div className="grid gap-1.5 sm:grid-cols-3">
                  {PERMISSION_GROUPS.map((g) => (
                    <div key={g} className="rounded-md border border-border px-3 py-2">
                      <p className="text-[11px] font-medium">{g}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {ROLES[membership?.roleKey ?? "salesperson"]?.permissions.filter((p) =>
                          p.startsWith(g.toLowerCase().slice(0, 4)),
                        ).length ?? 0}{" "}
                        granted to your role
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Enforced in the service layer as well as the UI: a hidden button is never the only
                  protection.
                </p>
              </div>
            </Panel>
          ) : null}

          {section === "security" ? (
            <Panel
              title="Security"
              subtitle="Tenant isolation, session and data-protection posture."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    icon: Lock,
                    title: "Tenant isolation",
                    body: "Every query is scoped by tenant and business in the service layer — cross-tenant reads are impossible by construction.",
                  },
                  {
                    icon: KeyRound,
                    title: "Sessions",
                    body: "Single sign-on ready, role-scoped session, AI actions attributed to the acting user or agent.",
                  },
                  {
                    icon: Database,
                    title: "Data handling",
                    body: "Field-level audit trail, reversible AI actions, export controlled by the data.export permission.",
                  },
                  {
                    icon: Building2,
                    title: "Business boundaries",
                    body: "Memberships are per business, so the same person can be a manager in one and a salesperson in another.",
                  },
                ].map(({ icon: Icon, title, body }) => (
                  <div key={title} className="rounded-lg border border-border p-3">
                    <p className="flex items-center gap-2 text-xs font-medium">
                      <Icon className="h-3.5 w-3.5" /> {title}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{body}</p>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          {section === "data" ? (
            <Panel title="Data" subtitle="Import, export and demo reset." dense>
              <div className="space-y-2 p-4 text-[12px] text-muted-foreground">
                <p>
                  {state.prospects.length} prospects · {state.communications.length} communications
                  · {state.events.length} domain events · {state.audit.length} audit entries.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="xs" variant="outline">
                    Import CSV
                  </Button>
                  <Button size="xs" variant="outline">
                    Export business data
                  </Button>
                  <Button
                    size="xs"
                    variant="destructive"
                    onClick={() => actions.recomputeIntelligence()}
                  >
                    Rebuild intelligence from event log
                  </Button>
                </div>
                <p className="text-[11px]">
                  Demo state is stored locally and re-anchored to the current time on reload;
                  resetting rebuilds the seed with fresh timestamps.
                </p>
              </div>
            </Panel>
          ) : null}

          {section === "billing" ? (
            <Panel
              title="Billing"
              subtitle="Placeholder for V1 — plans, seats and invoices live here later."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    name: "Growth",
                    price: "$0 in demo",
                    note: "Seats, businesses and AI actions are unlimited in the demo tenant.",
                  },
                  {
                    name: "Usage this month",
                    price: "—",
                    note: "AI actions, messages sent and calls logged roll up per business.",
                  },
                  {
                    name: "Seats",
                    price: `${state.users.filter((u) => !u.isAi).length}`,
                    note: `${state.memberships.filter((m) => m.status === "invited").length} invites pending.`,
                  },
                ].map((c) => (
                  <div key={c.name} className="rounded-lg border border-border p-3">
                    <p className="text-xs font-medium">{c.name}</p>
                    <p className="mt-1 text-sm font-semibold">{c.price}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{c.note}</p>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          {section === "api" ? (
            <Panel
              title="API & webhooks"
              subtitle="The same canonical events power automations, analytics and the AI."
            >
              <div className="space-y-2 text-[12px] text-muted-foreground">
                <div className="rounded-lg border border-border bg-background/60 p-3 font-mono text-[11px]">
                  POST https://api.lead-intelligence.test/v1/events
                  <br />
                  Authorization: Bearer •demo-key-{businessId.slice(-6)}•
                </div>
                <p>
                  Outbound webhooks fire on every domain event with the actor, reason and metadata
                  attached — the same payload the AI Activity screen renders.
                </p>
                <p>
                  Event types: lead lifecycle, communications, calls, forms/intake, tasks,
                  appointments, pipeline, deals, AI actions and automation runs (
                  <span className="text-foreground">
                    {(Object.keys(SOURCE_LABEL).length + 24).toString()}
                  </span>{" "}
                  canonical event names in the catalog).
                </p>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
