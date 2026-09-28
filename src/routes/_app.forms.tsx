import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ClipboardList, Sparkles } from "lucide-react";
import { useBusiness, useForms } from "@/hooks/use-app-store";
import { actions } from "@/lib/data/store";
import { currency, percent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState, Panel, Pill, RelativeTime, StatCard } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/forms")({
  component: FormsScreen,
});

function FormsScreen() {
  const { state, businessId, index } = useBusiness();
  const forms = useForms();
  const [active, setActive] = useState<string>(forms[0]?.form.id ?? "");

  const allSubmissions = state.submissions.filter((s) => s.businessId === businessId);
  const selected = forms.find((f) => f.form.id === active) ?? forms[0];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Forms & intake</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Partial submissions are tracked field-by-field, so abandoned high-value intake becomes a
          follow-up instead of a lost lead.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Started"
          value={allSubmissions.filter((s) => s.status === "started").length}
          icon={<ClipboardList className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Partial"
          value={allSubmissions.filter((s) => s.status === "partial").length}
          tone="medium"
        />
        <StatCard
          label="Completed"
          value={allSubmissions.filter((s) => s.status === "completed").length}
          tone="positive"
        />
        <StatCard
          label="Abandoned"
          value={allSubmissions.filter((s) => s.status === "abandoned").length}
          tone="critical"
          hint={`${currency(allSubmissions.filter((s) => s.status !== "completed").reduce((sum, s) => sum + s.valueEstimate, 0))} recoverable`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Panel title="Forms" dense>
          <div className="divide-y divide-border/70">
            {forms.map(({ form, started, partial, completed, abandoned, totalValue }) => (
              <button
                key={form.id}
                onClick={() => setActive(form.id)}
                className={cn(
                  "w-full px-4 py-3 text-left hover:bg-accent/50",
                  active === form.id && "bg-accent/60",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{form.name}</span>
                  <Pill
                    tone={
                      form.status === "live"
                        ? "positive"
                        : form.status === "draft"
                          ? "medium"
                          : "neutral"
                    }
                  >
                    {form.status}
                  </Pill>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {completed} completed · {partial + started} in progress · {abandoned} abandoned
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {currency(totalValue)} value tracked · {percent(form.completionRate)} completion
                </p>
              </button>
            ))}
          </div>
        </Panel>

        {selected ? (
          <div className="space-y-4">
            <Panel
              title={selected.form.name}
              subtitle={selected.form.description}
              action={
                <div className="flex gap-1.5">
                  <Pill tone="neutral">{selected.form.fields.length} fields</Pill>
                  <Pill tone="neutral">~{selected.form.averageCompletionMinutes} min</Pill>
                  {selected.form.abandonFollowUp?.enabled ? (
                    <Pill tone="ai">
                      auto follow-up after {selected.form.abandonFollowUp.afterHours}h
                    </Pill>
                  ) : null}
                </div>
              }
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Funnel
                  </p>
                  <div className="mt-2 space-y-2">
                    {[
                      {
                        label: "Started",
                        value:
                          selected.started +
                          selected.partial +
                          selected.completed +
                          selected.abandoned,
                        tone: "bg-slate-400",
                      },
                      { label: "Partial", value: selected.partial, tone: "bg-amber-500" },
                      { label: "Completed", value: selected.completed, tone: "bg-emerald-500" },
                      { label: "Abandoned", value: selected.abandoned, tone: "bg-rose-500" },
                    ].map((row) => {
                      const max = Math.max(
                        1,
                        selected.started +
                          selected.partial +
                          selected.completed +
                          selected.abandoned,
                      );
                      return (
                        <div key={row.label}>
                          <div className="flex justify-between text-[11px]">
                            <span>{row.label}</span>
                            <span className="tabular-nums text-muted-foreground">{row.value}</span>
                          </div>
                          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn("h-full", row.tone)}
                              style={{ width: `${(row.value / max) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Fields collected
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {selected.form.fields.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between rounded-md border border-border px-2 py-1 text-[11px]"
                      >
                        <span>{f.label}</span>
                        <span className="text-muted-foreground">
                          {f.type}
                          {f.required ? " · required" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel
              title="Submissions"
              subtitle="Every partial submission keeps its answers — follow-up targets the exact missing fields."
              dense
            >
              <Tabs defaultValue="open">
                <div className="px-3 pt-3">
                  <TabsList className="h-8">
                    <TabsTrigger value="open" className="text-xs">
                      In progress ({selected.partial + selected.started + selected.abandoned})
                    </TabsTrigger>
                    <TabsTrigger value="done" className="text-xs">
                      Completed ({selected.completed})
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="open" className="mt-3">
                  <div className="divide-y divide-border/70 border-t border-border/70">
                    {selected.submissions
                      .filter((s) => s.status !== "completed")
                      .map((s) => {
                        const prospect = state.prospects.find((p) => p.id === s.prospectId);
                        const contact = prospect ? index.contactOf(prospect) : undefined;
                        return (
                          <div key={s.id} className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {prospect ? (
                                <Link
                                  to="/prospects/$id"
                                  params={{ id: prospect.id }}
                                  className="text-xs font-medium hover:underline"
                                >
                                  {index.nameOf(prospect)}
                                </Link>
                              ) : (
                                <span className="text-xs font-medium">
                                  {s.answers.find((a) => a.label.toLowerCase().includes("name"))
                                    ?.value ?? "Unlinked lead"}
                                </span>
                              )}
                              <Pill tone={s.status === "abandoned" ? "critical" : "medium"}>
                                {s.status}
                              </Pill>
                              <Pill tone="neutral">{s.completion}% complete</Pill>
                              <Pill tone={s.valueEstimate >= 20_000 ? "critical" : "neutral"}>
                                {currency(s.valueEstimate)} est.
                              </Pill>
                              <span className="text-[11px] text-muted-foreground">
                                last activity <RelativeTime iso={s.lastActivityAt} />
                              </span>
                              {s.reminderSentAt ? (
                                <Pill tone="ai">
                                  reminder sent <RelativeTime iso={s.reminderSentAt} />
                                </Pill>
                              ) : null}
                              <div className="ml-auto flex gap-1.5">
                                <Button size="xs" onClick={() => actions.sendIntakeReminder(s.id)}>
                                  {s.reminderSentAt ? "Send another reminder" : "Send reminder"}
                                </Button>
                                {prospect ? (
                                  <Button size="xs" variant="outline" asChild>
                                    <Link to="/prospects/$id" params={{ id: prospect.id }}>
                                      Open
                                    </Link>
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                            <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                              {s.answers.map((a) => (
                                <div
                                  key={a.fieldId}
                                  className="rounded-md border border-border px-2 py-1 text-[11px]"
                                >
                                  <span className="text-muted-foreground">{a.label}: </span>
                                  {a.value}
                                </div>
                              ))}
                            </div>
                            {s.missingFields.length ? (
                              <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-400">
                                Missing: {s.missingFields.join(" · ")}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    {selected.submissions.filter((s) => s.status !== "completed").length === 0 ? (
                      <div className="p-4">
                        <EmptyState
                          icon={<Sparkles className="h-5 w-5" />}
                          title="No open submissions"
                          body="Every submission for this form is complete."
                        />
                      </div>
                    ) : null}
                  </div>
                </TabsContent>
                <TabsContent value="done" className="mt-3">
                  <div className="divide-y divide-border/70 border-t border-border/70">
                    {selected.submissions
                      .filter((s) => s.status === "completed")
                      .map((s) => {
                        const prospect = state.prospects.find((p) => p.id === s.prospectId);
                        return (
                          <div
                            key={s.id}
                            className="flex flex-wrap items-center gap-2 px-4 py-3 text-xs"
                          >
                            {prospect ? (
                              <Link
                                to="/prospects/$id"
                                params={{ id: prospect.id }}
                                className="font-medium hover:underline"
                              >
                                {index.nameOf(prospect)}
                              </Link>
                            ) : (
                              <span className="font-medium">
                                {s.answers[0]?.value ?? "Unlinked"}
                              </span>
                            )}
                            <Pill tone="positive">completed</Pill>
                            <Pill tone="neutral">{currency(s.valueEstimate)}</Pill>
                            <span className="text-[11px] text-muted-foreground">
                              submitted <RelativeTime iso={s.submittedAt ?? s.lastActivityAt} /> ·{" "}
                              {s.answers.length} answers
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </TabsContent>
              </Tabs>
            </Panel>
          </div>
        ) : null}
      </div>
    </div>
  );
}
