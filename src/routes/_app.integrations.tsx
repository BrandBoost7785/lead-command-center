import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Cable, CircleAlert, Plug, RefreshCw, Webhook } from "lucide-react";
import { useBusiness } from "@/hooks/use-app-store";
import { actions } from "@/lib/data/store";
import { cn } from "@/lib/utils";
import { INTEGRATION_STATUS_TONE } from "@/components/app/labels";
import { EmptyState, Panel, Pill, RelativeTime, StatCard } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Integration } from "@/lib/domain/types";

export const Route = createFileRoute("/_app/integrations")({
  component: IntegrationsScreen,
});

const CATEGORY_LABEL: Record<Integration["category"], string> = {
  email: "Email",
  calendar: "Calendar",
  telephony: "Telephony & SMS",
  messaging: "Messaging",
  crm: "CRM",
  data: "Data & imports",
  ai: "AI providers",
  notifications: "Notifications",
  social: "Social",
};

function IntegrationsScreen() {
  const { state, businessId } = useBusiness();
  const integrations = state.integrations.filter((i) => i.businessId === businessId);
  const [filter, setFilter] = useState<"all" | "connected" | "available" | "issues">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const shown = useMemo(
    () =>
      integrations.filter((i) =>
        filter === "all"
          ? true
          : filter === "connected"
            ? i.status === "connected"
            : filter === "available"
              ? i.status === "available"
              : i.status === "error",
      ),
    [integrations, filter],
  );

  const byCategory = useMemo(() => {
    const groups = new Map<Integration["category"], Integration[]>();
    for (const i of shown) groups.set(i.category, [...(groups.get(i.category) ?? []), i]);
    return Array.from(groups.entries());
  }, [shown]);

  const eventsHandled = integrations.reduce((s, i) => s + (i.eventsHandled ?? 0), 0);
  const issues = integrations.filter((i) => i.status === "error").length;

  const connect = (i: Integration) => {
    setBusy(i.id);
    window.setTimeout(() => {
      actions.connectIntegration(i.id);
      setBusy(null);
    }, 650);
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every channel enters through an adapter, so no screen or AI capability is tied to one
            provider — swap Gmail for Outlook, Twilio for Vonage, OpenAI for Anthropic.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone="neutral">
            {
              state.integrations.filter(
                (i) => i.businessId === businessId && i.status === "connected",
              ).length
            }{" "}
            connected
          </Pill>
          <span className="text-[11px] text-muted-foreground">
            business: {state.businesses.find((b) => b.id === businessId)?.name}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Connected"
          value={integrations.filter((i) => i.status === "connected").length}
          tone="positive"
          icon={<Plug className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Events handled"
          value={eventsHandled.toLocaleString()}
          tone="info"
          hint="all-time through adapters"
        />
        <StatCard
          label="Needs attention"
          value={issues}
          tone={issues ? "critical" : "positive"}
          icon={<CircleAlert className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Available to add"
          value={integrations.filter((i) => i.status === "available").length}
        />
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList className="h-8">
          <TabsTrigger value="all" className="text-xs">
            All ({integrations.length})
          </TabsTrigger>
          <TabsTrigger value="connected" className="text-xs">
            Connected
          </TabsTrigger>
          <TabsTrigger value="available" className="text-xs">
            Available
          </TabsTrigger>
          <TabsTrigger value="issues" className="text-xs">
            Issues ({issues})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {byCategory.map(([category, items]) => (
        <section key={category} className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {CATEGORY_LABEL[category]}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((i) => (
              <Panel
                key={i.id}
                className={cn("flex flex-col", i.status === "error" && "border-rose-500/40")}
                title={i.name}
                subtitle={i.description}
                action={
                  <Pill tone={INTEGRATION_STATUS_TONE[i.status] ?? "neutral"}>{i.status}</Pill>
                }
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {i.capabilities.map((c) => (
                      <Pill key={c} tone="neutral">
                        {c.replace(/_/g, " ")}
                      </Pill>
                    ))}
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground">{i.adapter}</p>
                  {i.lastError ? (
                    <p className="rounded-md border border-rose-500/30 bg-rose-500/[0.06] px-2 py-1.5 text-[11px] text-rose-600 dark:text-rose-400">
                      {i.lastError}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    {i.connectedAt ? (
                      <>
                        connected <RelativeTime iso={i.connectedAt} /> · last sync{" "}
                        <RelativeTime iso={i.lastSyncAt} />
                      </>
                    ) : (
                      "Not connected"
                    )}
                    {i.eventsHandled ? ` · ${i.eventsHandled.toLocaleString()} events` : ""}
                  </p>
                  <div className="flex gap-1.5 pt-1">
                    {i.status === "available" ? (
                      <Button
                        size="xs"
                        className="gap-1"
                        disabled={busy === i.id}
                        onClick={() => connect(i)}
                      >
                        <Plug className="h-3 w-3" /> {busy === i.id ? "Connecting…" : "Connect"}
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="xs"
                          variant="outline"
                          className="gap-1"
                          onClick={() => actions.connectIntegration(i.id)}
                        >
                          <RefreshCw className="h-3 w-3" /> Re-sync
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => actions.disconnectIntegration(i.id)}
                        >
                          Disconnect
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        </section>
      ))}

      {shown.length === 0 ? (
        <Panel>
          <EmptyState icon={<Cable className="h-5 w-5" />} title="Nothing in this filter" />
        </Panel>
      ) : null}

      <Panel
        title="Custom events & API"
        subtitle="Extend the same event catalog your automations and AI already read."
        icon={<Webhook className="h-4 w-4" />}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 text-[12px] text-muted-foreground">
            <p>
              Inbound webhooks translate provider payloads into canonical events (EMAIL_RECEIVED,
              CALL_MISSED, FORM_ABANDONED…) before anything else in the system sees them. Every
              adapter emits the same shape, which is why switching providers never changes a screen
              or an automation.
            </p>
            <p>
              Outbound: automations can call{" "}
              <span className="font-mono text-[11px]">send_to_webhook</span> with an arbitrary
              payload, and every domain event is available on the audit stream.
            </p>
          </div>
          <div className="space-y-2">
            {[
              {
                label: "Inbound webhook",
                value: "https://api.lead-intelligence.test/v1/events/{businessId}",
              },
              { label: "Signed with", value: "HMAC-SHA256 · X-Lead-Signature" },
              {
                label: "Event catalog",
                value: "24 canonical types across lead, comms, tasks, pipeline, AI and automation",
              },
              {
                label: "Retry policy",
                value: "Exponential backoff, 6 attempts, dead-letter after 24h",
              },
            ].map((row) => (
              <div
                key={row.label}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2"
              >
                <span className="text-[11px] font-medium">{row.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}
