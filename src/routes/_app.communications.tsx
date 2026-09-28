import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MessageSquare, Search } from "lucide-react";
import { useBusiness } from "@/hooks/use-app-store";
import { actions } from "@/lib/data/store";
import { communicationsFor } from "@/lib/services/queries";
import { CHANNEL_LABEL, INTENT_LABEL, currency } from "@/lib/format";
import {
  Avatar,
  EmptyState,
  Panel,
  Pill,
  RelativeTime,
  StatCard,
} from "@/components/app/primitives";
import { QuickAction } from "@/components/app/prospect-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Channel } from "@/lib/domain/types";

export const Route = createFileRoute("/_app/communications")({
  component: CommunicationsScreen,
});

const CHANNELS: (Channel | "all")[] = ["all", "email", "call", "sms", "whatsapp", "form"];

function CommunicationsScreen() {
  const { state, businessId, index } = useBusiness();
  const [channel, setChannel] = useState<Channel | "all">("all");
  const [direction, setDirection] = useState<"all" | "inbound" | "outbound">("all");
  const [search, setSearch] = useState("");

  const comms = useMemo(
    () => communicationsFor(state, businessId, channel === "all" ? undefined : channel),
    [state, businessId, channel],
  );

  const filtered = comms
    .filter((c) => (direction === "all" ? true : c.direction === direction))
    .filter((c) =>
      search ? `${c.subject ?? ""} ${c.body}`.toLowerCase().includes(search.toLowerCase()) : true,
    );

  const inboundToday = comms.filter(
    (c) => c.direction === "inbound" && +new Date(c.occurredAt) > Date.now() - 86_400_000,
  ).length;
  const unanswered = comms.filter((c) => c.requiresResponse && !c.handled).length;
  const avgResponse = (() => {
    const withResp = comms.filter((c) => c.responseTimeMinutes);
    if (!withResp.length) return 0;
    return Math.round(
      withResp.reduce((s, c) => s + (c.responseTimeMinutes ?? 0), 0) / withResp.length,
    );
  })();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Communications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every message across email, calls, SMS, WhatsApp and forms — connected to the prospect,
          company, business and actor that produced it.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Messages (90d)"
          value={comms.length}
          hint={`${Object.keys(Object.fromEntries(comms.map((c) => [c.channel, 1]))).length} channels`}
          icon={<MessageSquare className="h-3.5 w-3.5" />}
        />
        <StatCard label="Inbound today" value={inboundToday} tone="info" />
        <StatCard
          label="Unanswered"
          value={unanswered}
          tone={unanswered ? "critical" : "positive"}
          hint="waiting on us"
        />
        <StatCard
          label="Median first response"
          value={`${avgResponse} min`}
          tone="medium"
          hint="across classified replies"
        />
      </div>

      <Panel dense>
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search message content…"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <div className="flex overflow-hidden rounded-lg border border-border text-xs">
            {(["all", "inbound", "outbound"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={
                  direction === d ? "bg-accent px-3 py-1.5" : "px-3 py-1.5 text-muted-foreground"
                }
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <Tabs value={channel} onValueChange={(v) => setChannel(v as Channel | "all")}>
          <div className="px-3 pt-3">
            <TabsList className="h-8">
              {CHANNELS.map((c) => (
                <TabsTrigger key={c} value={c} className="text-xs capitalize">
                  {c === "all" ? "All" : CHANNEL_LABEL[c]}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {CHANNELS.map((c) => (
            <TabsContent key={c} value={c} className="mt-3">
              <div className="divide-y divide-border/70 border-t border-border/70">
                {filtered.map((comm) => {
                  const prospect = state.prospects.find((p) => p.id === comm.prospectId);
                  const contact = prospect ? index.contactOf(prospect) : undefined;
                  const company = prospect ? index.companyOf(prospect) : undefined;
                  const actor = state.users.find((u) => u.id === comm.actorId);
                  return (
                    <div key={comm.id} className="flex gap-3 px-4 py-3">
                      {contact ? (
                        <Avatar
                          name={`${contact.firstName} ${contact.lastName}`}
                          color={contact.avatarColor}
                          size={30}
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to="/prospects/$id"
                            params={{ id: comm.prospectId }}
                            className="text-xs font-medium hover:underline"
                          >
                            {contact ? `${contact.firstName} ${contact.lastName}` : "Unknown"}
                          </Link>
                          {company ? (
                            <span className="text-[11px] text-muted-foreground">
                              {company.name}
                            </span>
                          ) : null}
                          <Pill tone={comm.direction === "inbound" ? "info" : "neutral"}>
                            {comm.direction}
                          </Pill>
                          <Pill tone="neutral">{CHANNEL_LABEL[comm.channel]}</Pill>
                          <span className="text-[11px] text-muted-foreground">
                            <RelativeTime iso={comm.occurredAt} /> ·{" "}
                            {comm.actorKind === "ai"
                              ? `${actor?.name ?? "AI"} (AI)`
                              : (actor?.name ?? comm.actorKind)}
                          </span>
                          {comm.enrichment ? (
                            <Pill
                              tone={
                                comm.enrichment.intent === "high_intent"
                                  ? "positive"
                                  : comm.enrichment.intent === "objection"
                                    ? "medium"
                                    : "ai"
                              }
                            >
                              {INTENT_LABEL[comm.enrichment.intent]} ·{" "}
                              {((comm.enrichment.intentConfidence ?? 0) * 100).toFixed(0)}%
                            </Pill>
                          ) : null}
                          {comm.enrichment?.urgency ? (
                            <Pill tone={comm.enrichment.urgency}>
                              urgency {comm.enrichment.urgency}
                            </Pill>
                          ) : null}
                        </div>
                        {comm.subject ? (
                          <p className="mt-1.5 text-xs font-medium">{comm.subject}</p>
                        ) : null}
                        <p className="mt-1 line-clamp-3 text-[12px] text-muted-foreground">
                          {comm.body}
                        </p>
                        {comm.enrichment ? (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span>AI: {comm.enrichment.summary}</span>
                            {comm.enrichment.topics.map((t) => (
                              <Pill key={t} tone="neutral">
                                {t}
                              </Pill>
                            ))}
                            {comm.enrichment.sentiment ? (
                              <Pill
                                tone={
                                  String(comm.enrichment.sentiment) === "positive"
                                    ? "positive"
                                    : String(comm.enrichment.sentiment) === "negative"
                                      ? "critical"
                                      : "neutral"
                                }
                              >
                                {String(comm.enrichment.sentiment)}
                              </Pill>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="mt-1.5 flex gap-1.5">
                          <QuickAction
                            prospectId={comm.prospectId}
                            action={comm.channel === "call" ? "call" : "reply"}
                            label={comm.channel === "call" ? "Call" : "Reply"}
                            variant="outline"
                            size="xs"
                          />
                          {!comm.handled ? (
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => actions.handleCommunication(comm.id)}
                            >
                              Mark handled
                            </Button>
                          ) : (
                            <Pill tone="positive">handled</Pill>
                          )}
                        </div>
                      </div>
                      {prospect ? (
                        <div className="hidden w-28 shrink-0 text-right text-[11px] text-muted-foreground lg:block">
                          <p className="tabular-nums">{currency(prospect.value)}</p>
                          <p>score {prospect.score}</p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {filtered.length === 0 ? (
                  <EmptyState
                    title="No communications match"
                    icon={<MessageSquare className="h-5 w-5" />}
                  />
                ) : null}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </Panel>
    </div>
  );
}
