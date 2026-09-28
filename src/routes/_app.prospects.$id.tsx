import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Mail,
  MapPin,
  Phone,
  Send,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { useAppState, useBusiness } from "@/hooks/use-app-store";
import { actions } from "@/lib/data/store";
import { answerProspectQuestion, type AIAnswer } from "@/lib/ai/reasoner";
import { prospectCommunications } from "@/lib/services/queries";
import { CHANNEL_LABEL, INTENT_LABEL, SOURCE_LABEL, currency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Panel,
  Pill,
  RelativeTime,
  ScoreRing,
  StateBadge,
  IntentBadge,
  ChannelBadge,
  Avatar,
} from "@/components/app/primitives";
import { QuickAction } from "@/components/app/prospect-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ACTION_STATUS_LABEL, ACTION_TYPE_LABEL, EVENT_LABEL } from "@/components/app/labels";
import type { Communication, DomainEvent, Prospect } from "@/lib/domain/types";

export const Route = createFileRoute("/_app/prospects/$id")({
  component: ProspectProfile,
});

function ProspectProfile() {
  const { id } = Route.useParams();
  const { state, businessId, index } = useBusiness();
  const prospect = state.prospects.find((p) => p.id === id && p.businessId === businessId);
  if (!prospect) {
    return (
      <Panel title="Prospect not found">
        <p className="text-sm text-muted-foreground">
          That prospect does not exist in{" "}
          <b>{state.businesses.find((b) => b.id === businessId)?.name}</b>. Switching businesses
          isolates data —{" "}
          <Link to="/prospects" className="underline">
            back to prospects
          </Link>
          .
        </p>
      </Panel>
    );
  }

  return <ProspectDetail key={prospect.id} prospect={prospect} />;
}

/** Hooks live in this child so the not-found branch above can never change hook order. */
function ProspectDetail({ prospect }: { prospect: Prospect }) {
  const { state, index } = useBusiness();
  const contact = index.contactOf(prospect);
  const company = index.companyOf(prospect);
  const owner = index.userOf(prospect.ownerId);
  const breakdown = state.scoreBreakdowns[prospect.id];
  const comms = useMemo(() => prospectCommunications(state, prospect.id), [state, prospect.id]);
  const inbound = comms.filter((c) => c.direction === "inbound");
  const calls = comms.filter((c) => c.channel === "call" || c.channel === "meeting");
  const tasks = state.tasks.filter((t) => t.prospectId === prospect.id);
  const appointments = state.appointments
    .filter((a) => a.prospectId === prospect.id)
    .sort((a, b) => +new Date(b.startAt) - +new Date(a.startAt));
  const submissions = state.submissions.filter((s) => s.prospectId === prospect.id);
  const documents = state.documents.filter((d) => d.prospectId === prospect.id);
  const deal = state.deals.find((d) => d.prospectId === prospect.id);
  const events = state.events.filter((e) => e.prospectId === prospect.id);
  const insights = state.insights.filter((i) => i.prospectId === prospect.id);
  const aiActions = state.actions.filter((a) => a.prospectId === prospect.id);
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-4">
      <Link
        to="/prospects"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> All prospects
      </Link>

      {/* Header */}
      <header className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start gap-4">
          <ScoreRing score={prospect.score} size={64} />
          <div className="min-w-[220px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{index.nameOf(prospect)}</h1>
              <IntentBadge intent={prospect.intent} />
              <StateBadge state={prospect.state} />
              {prospect.stateInferred ? <Pill tone="ai">state inferred</Pill> : null}
              {prospect.doNotContact ? <Pill tone="critical">do not contact</Pill> : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {company ? (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {company.name}
                </span>
              ) : null}
              {contact?.jobTitle ? <span>{contact.jobTitle}</span> : null}
              {contact?.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {contact.location}
                </span>
              ) : null}
              {contact?.email ? (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {contact.email}
                </span>
              ) : null}
              {contact?.phone ? (
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {contact.phone}
                </span>
              ) : null}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <MetaCell label="Owner" value={owner?.name ?? "Unassigned"} />
              <MetaCell label="Source" value={SOURCE_LABEL[prospect.source]} />
              <MetaCell label="Opportunity" value={currency(prospect.value)} />
              <MetaCell
                label="Last activity"
                value={<RelativeTime iso={prospect.lastActivityAt} />}
              />
            </div>
          </div>

          <div className="w-full space-y-2 lg:w-auto">
            <div className="flex flex-wrap gap-1.5">
              <QuickAction prospectId={prospect.id} action="call" variant="default" />
              <QuickAction prospectId={prospect.id} action="reply" />
              <QuickAction prospectId={prospect.id} action="sms" />
              <QuickAction prospectId={prospect.id} action="whatsapp" />
              <QuickAction prospectId={prospect.id} action="task" />
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() =>
                  actions.proposeAction({
                    type: "research_prospect",
                    title: `Research ${index.nameOf(prospect)}`,
                    rationale:
                      "Requested from the prospect profile — the agent gathers context from the timeline, company and public sources.",
                    expectedOutcome:
                      "A one-page brief attached to the profile and summarised into the next call plan.",
                    confidence: 0.75,
                    prospectId: prospect.id,
                  })
                }
              >
                <Sparkles className="h-3.5 w-3.5" /> Research
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-background/60 p-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Next best action
              </p>
              <p className="text-xs font-medium">
                {prospect.nextActionType ? prospect.nextActionType.replace(/_/g, " ") : "qualify"} —{" "}
                {prospect.summary?.slice(0, 78) ?? "no recommendation yet"}
              </p>
            </div>
          </div>
        </div>

        {/* Prospect-scoped AI search */}
        <ProspectAI state={state} prospectId={prospect.id} />
      </header>

      <Tabs defaultValue="overview">
        <TabsList className="flex h-9 flex-wrap">
          {[
            "overview",
            "timeline",
            "communications",
            "calls",
            "forms",
            "tasks",
            "appointments",
            "documents",
            "deal",
            "ai",
            "activity",
          ].map((t) => (
            <TabsTrigger key={t} value={t} className="text-xs capitalize">
              {t === "ai" ? "AI intelligence" : t}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Panel title="AI overview" icon={<Sparkles className="h-4 w-4 text-violet-500" />}>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {prospect.summary}
              </p>
              {prospect.researchNotes ? (
                <p className="mt-3 rounded-lg border border-border bg-background/60 p-2.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">Research: </span>
                  {prospect.researchNotes}
                </p>
              ) : null}
              {breakdown?.whyHot.length ? (
                <ul className="mt-3 space-y-1">
                  {breakdown.whyHot.map((w) => (
                    <li key={w} className="flex gap-2 text-xs">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      {w}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Panel>

            <Panel
              title="Recent timeline"
              action={
                <Link
                  to="/prospects/$id"
                  params={{ id: prospect.id }}
                  className="text-[11px] text-muted-foreground hover:underline"
                >
                  full timeline →
                </Link>
              }
              dense
            >
              <div className="divide-y divide-border/70">
                {[...comms.slice(0, 6)].map((c) => (
                  <div key={c.id} className="flex items-start gap-3 px-4 py-2.5">
                    <span
                      className={cn(
                        "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                        c.direction === "inbound" ? "bg-violet-500" : "bg-sky-500",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">
                        {c.direction === "inbound" ? "Received" : "Sent"} {CHANNEL_LABEL[c.channel]}{" "}
                        · <RelativeTime iso={c.occurredAt} />
                      </p>
                      <p className="line-clamp-2 text-[11px] text-muted-foreground">{c.preview}</p>
                    </div>
                    {c.enrichment ? (
                      <Pill tone="ai">{INTENT_LABEL[c.enrichment.intent]}</Pill>
                    ) : null}
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel title="Key facts" dense>
              <div className="space-y-2 p-4 text-xs">
                <Row label="Score" value={`${prospect.score}/100`} hint={breakdown?.band} />
                <Row
                  label="Score confidence"
                  value={`${((breakdown?.confidence ?? 0) * 100).toFixed(0)}%`}
                />
                <Row label="Engagement" value={`${prospect.engagement}/100`} />
                <Row
                  label="Intent confidence"
                  value={`${(prospect.intentConfidence * 100).toFixed(0)}%`}
                />
                <Row label="Days since contact" value={String(prospect.daysSinceContact)} />
                <Row
                  label="First response"
                  value={
                    prospect.firstResponseMinutes ? `${prospect.firstResponseMinutes} min` : "—"
                  }
                />
                <Row label="Tags" value={prospect.tags.join(", ") || "—"} />
                <Row label="Health flags" value={prospect.healthFlags.join(", ") || "none"} />
                <Row label="Created" value={<RelativeTime iso={prospect.createdAt} />} />
              </div>
            </Panel>

            <Panel title="Open items" dense>
              <div className="divide-y divide-border/70">
                {tasks
                  .filter((t) => t.status !== "completed")
                  .slice(0, 4)
                  .map((t) => (
                    <div key={t.id} className="flex items-center gap-2 px-4 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{t.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          due <RelativeTime iso={t.dueAt} /> · {t.reason}
                        </p>
                      </div>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() =>
                          actions.completeTask(t.id, "Completed from prospect profile")
                        }
                      >
                        Done
                      </Button>
                    </div>
                  ))}
                {tasks.filter((t) => t.status !== "completed").length === 0 ? (
                  <p className="px-4 py-3 text-xs text-muted-foreground">No open items.</p>
                ) : null}
              </div>
            </Panel>

            <Panel title="Add a note" dense>
              <div className="space-y-2 p-4">
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What happened, what matters, what's next…"
                  className="text-xs"
                />
                <Button
                  size="sm"
                  className="w-full gap-1.5"
                  disabled={!notes.trim()}
                  onClick={() => {
                    actions.addNote(prospect.id, notes);
                    setNotes("");
                  }}
                >
                  <StickyNote className="h-3.5 w-3.5" /> Save note
                </Button>
              </div>
            </Panel>
          </div>
        </TabsContent>

        {/* TIMELINE */}
        <TabsContent value="timeline" className="mt-4">
          <Panel
            title="Complete history"
            subtitle="Communications, events, tasks and appointments merged into one chronological record."
            dense
          >
            <div className="relative space-y-0 pl-4">
              {buildTimeline(comms, events, tasks, appointments, submissions).map((item) => (
                <div key={item.id} className="relative border-l border-border/70 pb-4 pl-4">
                  <span
                    className={cn(
                      "absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full",
                      item.dot,
                    )}
                  />
                  <p className="text-xs font-medium">
                    {item.title}{" "}
                    <span className="font-normal text-muted-foreground">
                      · <RelativeTime iso={item.at} />
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{item.body}</p>
                  {item.effects?.length ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.effects.map((e) => (
                        <Pill key={e} tone="ai">
                          {e}
                        </Pill>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Panel>
        </TabsContent>

        {/* COMMUNICATIONS */}
        <TabsContent value="communications" className="mt-4">
          <Panel
            title="Communications"
            subtitle={`${inbound.length} inbound · ${comms.length - inbound.length} outbound across ${new Set(comms.map((c) => c.channel)).size} channels`}
            action={
              <div className="flex gap-1.5">
                <QuickAction prospectId={prospect.id} action="reply" variant="default" />
              </div>
            }
            dense
          >
            <div className="divide-y divide-border/70">
              {comms.map((c) => (
                <CommunicationRow key={c.id} comm={c} />
              ))}
              {comms.length === 0 ? (
                <p className="px-4 py-4 text-xs text-muted-foreground">No communications yet.</p>
              ) : null}
            </div>
          </Panel>
        </TabsContent>

        {/* CALLS */}
        <TabsContent value="calls" className="mt-4 space-y-4">
          {calls.length === 0 ? (
            <Panel title="Calls">
              <p className="text-xs text-muted-foreground">
                No calls recorded. Log the first one from the actions above.
              </p>
            </Panel>
          ) : (
            calls.map((c) => (
              <Panel
                key={c.id}
                title={`${CHANNEL_LABEL[c.channel]} · ${c.direction} · ${c.call?.outcome?.replace(/_/g, " ") ?? "logged"}`}
                subtitle={`${new Date(c.occurredAt).toLocaleString()} · ${c.call?.durationSeconds ? `${Math.round(c.call.durationSeconds / 60)}m ${c.call.durationSeconds % 60}s` : "no duration"}`}
                action={
                  <Pill tone={c.status === "missed" ? "critical" : "positive"}>{c.status}</Pill>
                }
              >
                {c.call?.summary ? (
                  <p className="text-xs text-muted-foreground">{c.call.summary}</p>
                ) : null}
                {c.call?.transcript?.length ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-border bg-background/60 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Transcript
                    </p>
                    {c.call.transcript.map((seg, i) => (
                      <div key={i} className="flex gap-2 text-[11px]">
                        <span
                          className={cn(
                            "w-14 shrink-0 font-medium",
                            seg.speaker === "agent"
                              ? "text-sky-600 dark:text-sky-400"
                              : "text-violet-600 dark:text-violet-400",
                          )}
                        >
                          {seg.speaker === "agent" ? "Northwind" : "Contact"}
                        </span>
                        <span className="flex-1 text-muted-foreground">{seg.text}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {Math.floor(seg.at / 60)}:{String(seg.at % 60).padStart(2, "0")}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {c.call?.objections?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.call.objections.map((o) => (
                      <Pill key={o} tone="medium">
                        objection: {o}
                      </Pill>
                    ))}
                  </div>
                ) : null}
              </Panel>
            ))
          )}
        </TabsContent>

        {/* FORMS */}
        <TabsContent value="forms" className="mt-4">
          <Panel title="Forms & intake" dense>
            <div className="divide-y divide-border/70">
              {submissions.map((s) => {
                const form = state.forms.find((f) => f.id === s.formId);
                return (
                  <div key={s.id} className="space-y-2 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">{form?.name}</span>
                      <Pill
                        tone={
                          s.status === "completed"
                            ? "positive"
                            : s.status === "abandoned"
                              ? "critical"
                              : "medium"
                        }
                      >
                        {s.status}
                      </Pill>
                      <span className="text-[11px] text-muted-foreground">
                        {s.completion}% · started <RelativeTime iso={s.startedAt} />
                      </span>
                      {s.status !== "completed" ? (
                        <Button
                          size="xs"
                          variant="outline"
                          className="ml-auto"
                          onClick={() => actions.sendIntakeReminder(s.id)}
                        >
                          Send reminder
                        </Button>
                      ) : null}
                    </div>
                    {s.answers.length ? (
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {s.answers.map((a) => (
                          <div
                            key={a.fieldId}
                            className="rounded-md border border-border bg-background/60 px-2 py-1 text-[11px]"
                          >
                            <span className="text-muted-foreground">{a.label}: </span>
                            {a.value}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {s.missingFields.length ? (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400">
                        Missing: {s.missingFields.join(", ")}
                      </p>
                    ) : null}
                  </div>
                );
              })}
              {submissions.length === 0 ? (
                <p className="px-4 py-4 text-xs text-muted-foreground">
                  No forms attached to this prospect.
                </p>
              ) : null}
            </div>
          </Panel>
        </TabsContent>

        {/* TASKS */}
        <TabsContent value="tasks" className="mt-4">
          <Panel
            title="Tasks & follow-ups"
            action={<QuickAction prospectId={prospect.id} action="task" variant="outline" />}
            dense
          >
            <div className="divide-y divide-border/70">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      t.status === "completed"
                        ? "bg-emerald-500"
                        : +new Date(t.dueAt) < Date.now()
                          ? "bg-rose-500"
                          : "bg-sky-500",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{t.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {t.status} · due <RelativeTime iso={t.dueAt} /> · {t.createdByKind} ·{" "}
                      {t.reason}
                    </p>
                  </div>
                  <Pill tone={t.priority}>{t.priority}</Pill>
                  {t.status !== "completed" ? (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => actions.completeTask(t.id, "Completed from prospect profile")}
                    >
                      Complete
                    </Button>
                  ) : null}
                </div>
              ))}
              {tasks.length === 0 ? (
                <p className="px-4 py-4 text-xs text-muted-foreground">No tasks.</p>
              ) : null}
            </div>
          </Panel>
        </TabsContent>

        {/* APPOINTMENTS */}
        <TabsContent value="appointments" className="mt-4">
          <Panel title="Appointments" dense>
            <div className="divide-y divide-border/70">
              {appointments.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(a.startAt).toLocaleString()} · {a.kind.replace(/_/g, " ")} ·{" "}
                      {a.location ?? a.conferenceUrl ?? "no location"}
                    </p>
                    {a.aiPrep ? (
                      <p className="mt-1 text-[11px] italic text-muted-foreground">
                        AI prep: {a.aiPrep}
                      </p>
                    ) : null}
                  </div>
                  <Pill
                    tone={
                      a.status === "missed"
                        ? "critical"
                        : a.status === "completed"
                          ? "positive"
                          : "info"
                    }
                  >
                    {a.status}
                  </Pill>
                  {a.scheduledByKind === "ai" ? <Pill tone="ai">AI scheduled</Pill> : null}
                </div>
              ))}
              {appointments.length === 0 ? (
                <p className="px-4 py-4 text-xs text-muted-foreground">No appointments.</p>
              ) : null}
            </div>
          </Panel>
        </TabsContent>

        {/* DOCUMENTS */}
        <TabsContent value="documents" className="mt-4">
          <Panel title="Documents" dense>
            <div className="divide-y divide-border/70">
              {documents.map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{d.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {d.kind} · {d.sizeKb} KB · added <RelativeTime iso={d.createdAt} /> by{" "}
                      {d.uploadedByKind}
                    </p>
                  </div>
                  {d.status ? (
                    <Pill
                      tone={
                        d.status === "viewed"
                          ? "info"
                          : d.status === "signed"
                            ? "positive"
                            : "neutral"
                      }
                    >
                      {d.status}
                    </Pill>
                  ) : null}
                  {d.viewedAt ? (
                    <span className="text-[10px] text-muted-foreground">
                      viewed <RelativeTime iso={d.viewedAt} />
                    </span>
                  ) : null}
                </div>
              ))}
              {documents.length === 0 ? (
                <p className="px-4 py-4 text-xs text-muted-foreground">No documents attached.</p>
              ) : null}
            </div>
          </Panel>
        </TabsContent>

        {/* DEAL */}
        <TabsContent value="deal" className="mt-4">
          <Panel title="Commercial information">
            {deal ? (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-4">
                  <MetaCell label="Value" value={currency(deal.value)} />
                  <MetaCell label="State" value={deal.state} />
                  <MetaCell label="Probability" value={`${(deal.probability * 100).toFixed(0)}%`} />
                  <MetaCell
                    label="Expected close"
                    value={new Date(deal.expectedCloseAt).toLocaleDateString()}
                  />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Products
                  </p>
                  <div className="mt-1 space-y-1">
                    {deal.products.map((p) => (
                      <div
                        key={p.name}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-xs"
                      >
                        <span>{p.name}</span>
                        <span className="tabular-nums">{currency(p.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {deal.lostReason ? (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    Lost reason: {deal.lostReason}
                  </p>
                ) : null}
                {deal.won ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Closed won {deal.closedAt ? new Date(deal.closedAt).toLocaleDateString() : ""}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No deal record yet.</p>
            )}
          </Panel>
        </TabsContent>

        {/* AI INTELLIGENCE */}
        <TabsContent value="ai" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel
            title="Score breakdown"
            subtitle={`Model ${breakdown?.modelVersion ?? "pending"} · every signal explains itself`}
            dense
          >
            <div className="divide-y divide-border/70">
              {(breakdown?.signals ?? []).map((s) => (
                <div key={s.key} className="px-4 py-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{s.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.points.toFixed(1)} / {s.weight} pts
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-violet-500"
                      style={{ width: `${Math.min(100, s.value * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{s.reason}</p>
                </div>
              ))}
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel title="AI insights" dense>
              <div className="divide-y divide-border/70">
                {insights.map((i) => (
                  <div key={i.id} className="px-4 py-3">
                    <p className="text-xs font-medium">{i.title}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{i.body}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {i.model} · confidence {(i.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                ))}
                {insights.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-muted-foreground">
                    No insights for this prospect yet.
                  </p>
                ) : null}
              </div>
            </Panel>

            <Panel title="AI actions on this prospect" dense>
              <div className="divide-y divide-border/70">
                {aiActions.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 px-4 py-2.5">
                    <span
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 rounded-full",
                        a.status === "executed"
                          ? "bg-emerald-500"
                          : a.status === "rejected"
                            ? "bg-rose-500"
                            : "bg-violet-500",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{a.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {ACTION_TYPE_LABEL[a.type]} · {ACTION_STATUS_LABEL[a.status]} ·{" "}
                        <RelativeTime iso={a.executedAt ?? a.createdAt} />
                      </p>
                      {a.result ? (
                        <p className="text-[10px] italic text-muted-foreground">{a.result}</p>
                      ) : null}
                    </div>
                    {a.status === "executed" && a.revertible ? (
                      <Button size="xs" variant="ghost" onClick={() => actions.revertAction(a.id)}>
                        Undo
                      </Button>
                    ) : null}
                  </div>
                ))}
                {aiActions.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-muted-foreground">No AI actions yet.</p>
                ) : null}
              </div>
            </Panel>
          </div>
        </TabsContent>

        {/* ACTIVITY */}
        <TabsContent value="activity" className="mt-4">
          <Panel
            title="System activity"
            subtitle="Every event the platform recorded for this prospect."
            dense
          >
            <div className="divide-y divide-border/70">
              {events.slice(0, 40).map((e) => (
                <div key={e.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                  <Pill tone="neutral">{EVENT_LABEL[e.type] ?? e.type}</Pill>
                  <span className="min-w-0 flex-1 text-xs">
                    {e.summary}
                    {e.detail ? <span className="text-muted-foreground"> — {e.detail}</span> : null}
                  </span>
                  <Pill tone={e.actorKind === "ai" ? "ai" : "neutral"}>{e.actorKind}</Pill>
                  <span className="text-[11px] text-muted-foreground">
                    <RelativeTime iso={e.occurredAt} />
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ProspectAI({
  state,
  prospectId,
}: {
  state: ReturnType<typeof useAppState>;
  prospectId: string;
}) {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<AIAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const prospect = state.prospects.find((p) => p.id === prospectId)!;

  const examples = [
    "Summarize the last 3 conversations.",
    "What objections have they raised?",
    "What did they say about price?",
    "Why haven't they converted?",
    "What should I say on my next call?",
    "Find unanswered questions.",
    "What changed in the last 7 days?",
  ];

  const ask = (text: string) => {
    if (!text.trim()) return;
    setBusy(true);
    setTimeout(() => {
      setAnswer(answerProspectQuestion(state, prospect, text));
      setBusy(false);
      setQuery("");
    }, 200);
  };

  return (
    <div className="mt-4 rounded-xl border border-violet-500/25 bg-violet-500/[0.04] p-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(query)}
          placeholder="Ask anything about this prospect…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => ask(query)}
          disabled={busy}
        >
          <Send className="h-3.5 w-3.5" />
          {busy ? "Thinking…" : "Ask"}
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {examples.map((e) => (
          <button
            key={e}
            onClick={() => ask(e)}
            className="rounded-full border border-border bg-background/70 px-2.5 py-1 text-[11px] hover:border-violet-500/50"
          >
            {e}
          </button>
        ))}
      </div>

      {answer ? (
        <div className="mt-3 rounded-lg border border-border bg-background/80 p-3">
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
              {answer.bullets.slice(0, 6).map((b, i) => (
                <li key={i} className="flex gap-2 text-[11px] text-muted-foreground">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                  {b}
                </li>
              ))}
            </ul>
          ) : null}
          {answer.recommendations?.map((rec, i) => (
            <div key={i} className="mt-2 rounded-md border border-border p-2">
              <p className="text-[11px] font-medium">{rec.title}</p>
              <p className="text-[10px] text-muted-foreground">{rec.why}</p>
              <div className="mt-1.5 flex gap-1.5">
                <QuickAction
                  prospectId={prospectId}
                  action={
                    rec.type === "place_call"
                      ? "call"
                      : rec.type === "send_intake_reminder"
                        ? "task"
                        : "reply"
                  }
                  label="Do it"
                  variant="default"
                  size="xs"
                />
                <Pill tone="neutral">{(rec.confidence * 100).toFixed(0)}% confidence</Pill>
              </div>
            </div>
          ))}
          <p className="mt-2 text-[10px] text-muted-foreground">
            {answer.provider} · confidence {(answer.confidence * 100).toFixed(0)}%
          </p>
        </div>
      ) : null}
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-background/60 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="truncate text-xs font-medium">{value}</p>
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 font-medium">
        {value}
        {hint ? <Pill tone="neutral">{hint}</Pill> : null}
      </span>
    </div>
  );
}

function CommunicationRow({ comm }: { comm: Communication }) {
  const { state, index } = useBusiness();
  const contact = index.contactOf(state.prospects.find((p) => p.id === comm.prospectId));
  return (
    <div className="flex gap-3 px-4 py-3">
      {contact ? (
        <Avatar
          name={`${contact.firstName} ${contact.lastName}`}
          color={contact.avatarColor}
          size={28}
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <ChannelBadge channel={comm.channel} />
          <Pill tone={comm.direction === "inbound" ? "info" : "neutral"}>{comm.direction}</Pill>
          <span className="text-[11px] text-muted-foreground">
            <RelativeTime iso={comm.occurredAt} />
          </span>
          {comm.enrichment ? (
            <Pill tone="ai">
              {INTENT_LABEL[comm.enrichment.intent]} ·{" "}
              {((comm.enrichment.intentConfidence ?? 0) * 100).toFixed(0)}%
            </Pill>
          ) : null}
          {comm.handled ? (
            <Pill tone="positive">handled</Pill>
          ) : comm.requiresResponse ? (
            <Pill tone="high">needs reply</Pill>
          ) : null}
        </div>
        {comm.subject ? <p className="mt-1.5 text-xs font-medium">{comm.subject}</p> : null}
        <p className="mt-1 whitespace-pre-wrap text-[12px] text-muted-foreground">{comm.body}</p>
        {comm.attachments?.length ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {comm.attachments.map((a) => (
              <Pill key={a.id} tone="neutral">
                {a.name} ({a.sizeKb} KB)
              </Pill>
            ))}
          </div>
        ) : null}
        <div className="mt-1.5 flex gap-1.5">
          <QuickAction
            prospectId={comm.prospectId}
            action={comm.channel === "call" ? "call" : "reply"}
            label="Reply"
            variant="outline"
            size="xs"
          />
          {!comm.handled ? (
            <Button size="xs" variant="ghost" onClick={() => actions.handleCommunication(comm.id)}>
              Mark handled
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface TimelineItem {
  id: string;
  at: string;
  title: string;
  body: string;
  dot: string;
  effects?: string[];
}

function buildTimeline(
  comms: Communication[],
  events: DomainEvent[],
  tasks: ReturnType<typeof useAppState>["tasks"],
  appointments: ReturnType<typeof useAppState>["appointments"],
  submissions: ReturnType<typeof useAppState>["submissions"],
): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const c of comms) {
    items.push({
      id: c.id,
      at: c.occurredAt,
      title: `${c.direction === "inbound" ? "Received" : "Sent"} ${CHANNEL_LABEL[c.channel]}${c.subject ? ` — ${c.subject}` : ""}`,
      body: c.preview,
      dot: c.direction === "inbound" ? "bg-violet-500" : "bg-sky-500",
    });
  }
  for (const e of events) {
    if (e.type === "EMAIL_RECEIVED" || e.type === "EMAIL_SENT") continue;
    items.push({
      id: e.id,
      at: e.occurredAt,
      title: e.summary,
      body: e.detail ?? "",
      dot: e.actorKind === "ai" ? "bg-violet-400" : "bg-slate-400",
      effects: e.effects?.map((x) => x.label),
    });
  }
  for (const t of tasks) {
    items.push({
      id: t.id,
      at: t.completedAt ?? t.dueAt,
      title: `${t.status === "completed" ? "Task completed" : "Task due"}: ${t.title}`,
      body: t.outcome ?? t.reason,
      dot: t.status === "completed" ? "bg-emerald-500" : "bg-amber-500",
    });
  }
  for (const a of appointments) {
    items.push({
      id: a.id,
      at: a.startAt,
      title: a.title,
      body: `${a.kind} · ${a.status}`,
      dot: "bg-teal-500",
    });
  }
  for (const s of submissions) {
    items.push({
      id: s.id,
      at: s.submittedAt ?? s.lastActivityAt,
      title: `Intake ${s.status}`,
      body: `${s.completion}% complete${s.missingFields.length ? ` · missing ${s.missingFields.join(", ")}` : ""}`,
      dot: s.status === "completed" ? "bg-emerald-500" : "bg-orange-500",
    });
  }
  return items.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 60);
}
