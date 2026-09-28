import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Pencil, Send, Shield, Sparkles, ThumbsDown, X, Zap } from "lucide-react";
import { useBusiness, useAppState } from "@/hooks/use-app-store";
import { actions } from "@/lib/data/store";
import { answerCommand, type AIAnswer, type AIRecommendation } from "@/lib/ai/reasoner";
import { createLocalProvider } from "@/lib/ai/reasoner";
import { cn } from "@/lib/utils";
import { AUTONOMY_SHORT, ACTION_STATUS_LABEL, ACTION_TYPE_LABEL } from "@/components/app/labels";
import { Avatar, Panel, Pill, RelativeTime, ScoreRing } from "@/components/app/primitives";
import { QuickAction } from "@/components/app/prospect-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { currency } from "@/lib/format";

export const Route = createFileRoute("/_app/ai")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => {
    const q = search["q"];
    return { q: typeof q === "string" && q.length ? q : undefined };
  },
  component: AICommandCenter,
});

interface Turn {
  id: string;
  query: string;
  answer: AIAnswer;
  at: number;
}

const EXAMPLES = [
  "Show me my 15 hottest prospects.",
  "Who needs a follow-up?",
  "Show me everyone who responded today.",
  "Why is Sarah marked as high priority?",
  "Prepare my calls for today.",
  "Draft follow-ups for everyone waiting more than 3 days.",
  "Show me missed opportunities.",
  "Find everyone who hasn't completed their intake.",
  "What should I do next?",
];

function AICommandCenter() {
  const { state, businessId, business, aiPaused } = useBusiness();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const provider = useMemo(() => createLocalProvider(state, businessId), [state, businessId]);

  const ask = (text: string) => {
    const value = text.trim();
    if (!value) return;
    setThinking(true);
    // Route through the provider interface — a remote model would plug in here.
    void provider
      .chat({ messages: [{ role: "user", content: value }], context: { businessId } })
      .then((res) => {
        const answer = (res.data as AIAnswer) ?? answerCommand({ state, businessId, query: value });
        setTurns((prev) => [
          ...prev,
          { id: `turn_${Date.now()}`, query: value, answer, at: Date.now() },
        ]);
        setThinking(false);
        setQuery("");
      });
  };

  useEffect(() => {
    if (search.q) {
      ask(search.q);
      navigate({ to: "/ai", search: {}, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [turns.length, thinking]);

  const pending = state.actions.filter(
    (a) =>
      a.businessId === businessId && (a.status === "awaiting_approval" || a.status === "proposed"),
  );
  const recent = state.actions
    .filter(
      (a) =>
        a.businessId === businessId && a.status !== "awaiting_approval" && a.status !== "proposed",
    )
    .slice(0, 5);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <div className="flex min-h-[calc(100vh-140px)] flex-col">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              AI Command Center
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ask anything about {business?.name} — or tell the AI to handle it. Scoped to this
              business, grounded in its events.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Pill tone={aiPaused ? "medium" : "positive"} icon={<Shield className="h-3 w-3" />}>
              {aiPaused
                ? "AI paused"
                : `Autonomy: ${AUTONOMY_SHORT[business?.settings.defaultAutonomy ?? "approve"]}`}
            </Pill>
            <span className="text-[11px] text-muted-foreground">
              {pending.length} awaiting approval
            </span>
          </div>
        </header>

        {/* Console */}
        <div className="mt-4 flex-1 space-y-4 overflow-y-auto pb-4">
          {turns.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-medium">What do you want to know or do?</p>
              <p className="mt-1 text-xs text-muted-foreground">
                The AI reads your events, communications, forms, tasks and pipeline before
                answering. Every answer shows its reasoning, and every recommended action can be
                executed with one click.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {EXAMPLES.map((e) => (
                  <button
                    key={e}
                    onClick={() => ask(e)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs transition hover:border-violet-500/50 hover:bg-violet-500/5"
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {turns.map((turn) => (
            <div key={turn.id} className="space-y-3">
              <div className="flex justify-end">
                <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                  {turn.query}
                </div>
              </div>
              <AnswerCard answer={turn.answer} at={turn.at} />
            </div>
          ))}

          {thinking ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-violet-500" />
              Reading events, scoring signals and open items…
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="sticky bottom-0 border-t border-border bg-background/95 pt-3 backdrop-blur">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-card p-2 focus-within:border-violet-500/50">
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(query);
                }
              }}
              rows={1}
              placeholder="What do you want to know or do?"
              className="min-h-9 resize-none border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
            />
            <Button
              size="sm"
              className="gap-1.5 bg-gradient-to-br from-violet-600 to-indigo-600"
              onClick={() => ask(query)}
              disabled={thinking || !query.trim()}
            >
              <Send className="h-3.5 w-3.5" />
              Ask
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Try “Handle my follow-ups.” — the AI will prepare or execute actions depending on
            autonomy, permissions and confidence.
          </p>
        </div>
      </div>

      {/* Side rail */}
      <aside className="space-y-4">
        <Panel title="Awaiting your approval" subtitle="The AI prepared these and stopped." dense>
          <div className="divide-y divide-border/70">
            {pending.slice(0, 5).map((a) => {
              const prospect = state.prospects.find((p) => p.id === a.prospectId);
              const contact = prospect
                ? state.contacts.find((c) => c.id === prospect.contactId)
                : undefined;
              return (
                <div key={a.id} className="space-y-2 px-4 py-3">
                  <div className="flex items-start gap-2">
                    {contact ? (
                      <Avatar
                        name={`${contact.firstName} ${contact.lastName}`}
                        color={contact.avatarColor}
                        size={28}
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium">{a.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {ACTION_TYPE_LABEL[a.type]} · confidence {(a.confidence * 100).toFixed(0)}%
                        · <RelativeTime iso={a.createdAt} />
                      </p>
                    </div>
                  </div>
                  <p className="line-clamp-2 text-[11px] text-muted-foreground italic">
                    {a.rationale}
                  </p>
                  <div className="flex gap-1.5">
                    <Button
                      size="xs"
                      className="gap-1"
                      onClick={() => {
                        actions.approveAction(a.id);
                        actions.executeAction(a.id);
                      }}
                    >
                      <Check className="h-3 w-3" /> Approve & execute
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      className="gap-1"
                      onClick={() => actions.approveAction(a.id)}
                    >
                      <ThumbsDown className="h-3 w-3 rotate-180" /> Approve only
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => actions.rejectAction(a.id)}>
                      Reject
                    </Button>
                  </div>
                </div>
              );
            })}
            {pending.length === 0 ? (
              <p className="px-4 py-4 text-xs text-muted-foreground">
                Nothing waiting. The queue is clear.
              </p>
            ) : null}
          </div>
        </Panel>

        <Panel title="Recently executed" dense>
          <div className="divide-y divide-border/70">
            {recent.map((a) => (
              <Link
                key={a.id}
                to="/ai-activity"
                className="flex items-start gap-2 px-4 py-2.5 hover:bg-accent/60"
              >
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{a.title}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {ACTION_STATUS_LABEL[a.status]} ·{" "}
                    <RelativeTime iso={a.executedAt ?? a.createdAt} />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="How this answer was produced" dense>
          <div className="space-y-2 px-4 pb-3 text-[11px] text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-violet-500" /> Provider: Lead Intelligence Reasoner
              (local, on-prem)
            </p>
            <p>
              Grounded in: events, communications, forms, tasks, appointments, pipeline state and
              score breakdowns for this business only.
            </p>
            <p>
              Model, weights and autonomy are configurable per business in Settings → AI behaviour.
            </p>
          </div>
        </Panel>
      </aside>
    </div>
  );
}

function AnswerCard({ answer, at }: { answer: AIAnswer; at: number }) {
  const { state, index } = useBusiness();
  const prospects = (answer.prospectIds ?? [])
    .map((id) => state.prospects.find((p) => p.id === id))
    .filter(Boolean)
    .slice(0, 6);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-violet-500/12 text-violet-600 dark:text-violet-300">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{answer.title}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{answer.body}</p>

          {answer.metrics?.length ? (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {answer.metrics.map((m) => (
                <div
                  key={m.label}
                  className="rounded-lg border border-border bg-background/60 px-2.5 py-2"
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {m.label}
                  </p>
                  <p className="text-sm font-semibold tabular-nums">{m.value}</p>
                  {m.hint ? <p className="text-[10px] text-muted-foreground">{m.hint}</p> : null}
                </div>
              ))}
            </div>
          ) : null}

          {answer.bullets?.length ? (
            <ul className="mt-3 space-y-1.5">
              {answer.bullets.slice(0, 8).map((b, i) => (
                <li key={i} className="flex gap-2 text-xs">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {prospects.length ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {prospects.map((p) => {
                const contact = index.contactOf(p!);
                const company = index.companyOf(p!);
                return (
                  <div
                    key={p!.id}
                    className="flex items-center gap-2 rounded-lg border border-border bg-background/60 p-2"
                  >
                    <ScoreRing score={p!.score} size={34} />
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/prospects/$id"
                        params={{ id: p!.id }}
                        className="block truncate text-xs font-medium hover:underline"
                      >
                        {contact ? `${contact.firstName} ${contact.lastName}` : p!.id}
                      </Link>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {company?.name ?? "—"} · {currency(p!.value)} · {p!.state}
                      </p>
                    </div>
                    <QuickAction
                      prospectId={p!.id}
                      action={p!.nextActionType === "call" ? "call" : "reply"}
                      label="Act"
                      variant="outline"
                      size="xs"
                    />
                  </div>
                );
              })}
            </div>
          ) : null}

          {answer.recommendations?.length ? (
            <div className="mt-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recommended actions
              </p>
              {answer.recommendations.map((rec, i) => (
                <RecommendationRow key={i} rec={rec} />
              ))}
            </div>
          ) : null}

          {answer.followUps?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {answer.followUps.map((f) => (
                <Link
                  key={f}
                  to="/ai"
                  search={{ q: f } as never}
                  className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-violet-500/50 hover:text-foreground"
                >
                  {f}
                </Link>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/70 pt-2 text-[10px] text-muted-foreground">
            <span>{answer.provider}</span>
            <span>confidence {(answer.confidence * 100).toFixed(0)}%</span>
            <span>
              {new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </span>
            {answer.reasoning.map((r) => (
              <span key={r} className="hidden xl:inline">
                · {r}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RecommendationRow({ rec }: { rec: AIRecommendation }) {
  const [editing, setEditing] = useState(false);
  const [[draft], setDraft] = useState([rec.draft ?? ""]);

  return (
    <div className="rounded-lg border border-border bg-background/60 p-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium">{rec.title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80">Why:</span> {rec.why}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80">Expected outcome:</span> {rec.outcome}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Pill tone="ai">{ACTION_TYPE_LABEL[rec.type]}</Pill>
          <Pill tone="neutral">{(rec.confidence * 100).toFixed(0)}%</Pill>
        </div>
      </div>

      {editing ? (
        <Textarea
          value={draft}
          onChange={(e) => setDraft([e.target.value])}
          rows={6}
          className="mt-2 text-xs"
        />
      ) : draft ? (
        <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
          {draft}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          size="xs"
          className="gap-1"
          onClick={() =>
            actions.proposeAction({
              type: rec.type,
              title: rec.title,
              rationale: rec.why,
              expectedOutcome: rec.outcome,
              confidence: rec.confidence,
              prospectId: rec.prospectId,
              draft: draft || undefined,
              status: rec.autonomy === "autonomous" ? "approved" : "awaiting_approval",
              autonomyUsed: rec.autonomy ?? "approve",
            })
          }
        >
          <Zap className="h-3 w-3" /> Execute
        </Button>
        <Button size="xs" variant="outline" className="gap-1" onClick={() => setEditing((v) => !v)}>
          <Pencil className="h-3 w-3" /> {editing ? "Done" : "Edit"}
        </Button>
        <Button size="xs" variant="ghost" className="gap-1" onClick={() => setEditing(false)}>
          <X className="h-3 w-3" /> Dismiss
        </Button>
      </div>
    </div>
  );
}
