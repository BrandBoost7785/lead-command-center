import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Clock, ListTodo, Sparkles, Users } from "lucide-react";
import { useBusiness, useTasks } from "@/hooks/use-app-store";
import { actions } from "@/lib/data/store";
import type { TaskView } from "@/lib/services/queries";
import { NEXT_ACTION_LABEL, currency } from "@/lib/format";
import { cn } from "@/lib/utils";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/tasks")({
  component: TasksScreen,
});

const VIEWS: { key: TaskView; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "overdue", label: "Overdue" },
  { key: "upcoming", label: "Upcoming" },
  { key: "ai", label: "AI created" },
  { key: "manual", label: "Manual" },
  { key: "mine", label: "Assigned to me" },
  { key: "team", label: "Team" },
  { key: "completed", label: "Completed" },
];

function TasksScreen() {
  const { state, businessId, index } = useBusiness();
  const [view, setView] = useState<TaskView>("today");
  const tasks = useTasks(view);

  const overdue = state.tasks.filter(
    (t) =>
      t.businessId === businessId && t.status !== "completed" && +new Date(t.dueAt) < Date.now(),
  );
  const dueToday = state.tasks.filter(
    (t) =>
      t.businessId === businessId &&
      t.status !== "completed" &&
      +new Date(t.dueAt) >= Date.now() &&
      +new Date(t.dueAt) <= Date.now() + 86_400_000,
  );
  const aiCreated = state.tasks.filter(
    (t) => t.businessId === businessId && t.createdByKind !== "user",
  );

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Tasks & follow-ups</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The AI creates, prioritises and completes tasks as events land — humans can add, snooze or
          complete anything.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Overdue"
          value={overdue.length}
          tone={overdue.length ? "critical" : "positive"}
          icon={<Clock className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Due today"
          value={dueToday.length}
          tone="medium"
          icon={<ListTodo className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Created by AI"
          value={aiCreated.length}
          tone="info"
          icon={<Sparkles className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Completed"
          value={
            state.tasks.filter((t) => t.businessId === businessId && t.status === "completed")
              .length
          }
          tone="positive"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
      </div>

      <Panel dense>
        <div className="border-b border-border/70 p-3">
          <Tabs value={view} onValueChange={(v) => setView(v as TaskView)}>
            <TabsList className="h-8 flex-wrap">
              {VIEWS.map((v) => (
                <TabsTrigger key={v.key} value={v.key} className="text-xs">
                  {v.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="divide-y divide-border/70">
          {tasks.map((t) => {
            const prospect = state.prospects.find((p) => p.id === t.prospectId);
            const contact = prospect ? index.contactOf(prospect) : undefined;
            const owner = index.userOf(t.ownerId);
            const isOverdue = t.status !== "completed" && +new Date(t.dueAt) < Date.now();
            return (
              <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span
                  className={cn(
                    "w-1 self-stretch rounded-full",
                    t.status === "completed"
                      ? "bg-emerald-500"
                      : isOverdue
                        ? "bg-rose-500"
                        : "bg-sky-500",
                  )}
                />
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={cn(
                        "text-[13px] font-medium",
                        t.status === "completed" && "text-muted-foreground line-through",
                      )}
                    >
                      {t.title}
                    </p>
                    <Pill tone={t.priority}>{t.priority}</Pill>
                    <Pill tone={t.createdByKind === "user" ? "neutral" : "ai"}>
                      {t.createdByKind === "user"
                        ? "manual"
                        : `${t.createdByKind === "automation" ? "automation" : "AI"} · ${index.userOf(t.createdBy)?.name ?? "agent"}`}
                    </Pill>
                    {t.slaBreached ? <Pill tone="critical">SLA breached</Pill> : null}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {contact ? (
                      <>
                        <Link
                          to="/prospects/$id"
                          params={{ id: t.prospectId! }}
                          className="hover:underline"
                        >
                          {contact.firstName} {contact.lastName}
                        </Link>{" "}
                        ·{" "}
                      </>
                    ) : null}
                    due <RelativeTime iso={t.dueAt} /> · {t.reason}
                  </p>
                  {t.aiRecommendation ? (
                    <p className="mt-0.5 text-[11px] italic text-violet-600 dark:text-violet-300">
                      AI: {t.aiRecommendation}
                    </p>
                  ) : null}
                  {t.outcome ? (
                    <p className="mt-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                      Outcome: {t.outcome}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {owner ? (
                    <Avatar
                      name={owner.name}
                      color={owner.avatarColor}
                      size={24}
                      isAi={owner.isAi}
                    />
                  ) : null}
                  {prospect ? (
                    <span className="hidden text-[11px] text-muted-foreground lg:block">
                      {currency(prospect.value)} · score {prospect.score}
                    </span>
                  ) : null}
                  {t.status !== "completed" ? (
                    <>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => actions.completeTask(t.id, "Completed from the task list")}
                      >
                        Complete
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => actions.snoozeTask(t.id, 1_440)}
                      >
                        Snooze
                      </Button>
                      {prospect ? (
                        <QuickAction
                          prospectId={prospect.id}
                          action={t.type === "call" ? "call" : "reply"}
                          label="Do now"
                          variant="default"
                          size="xs"
                        />
                      ) : null}
                    </>
                  ) : (
                    <Pill tone="positive">
                      completed <RelativeTime iso={t.completedAt} />
                    </Pill>
                  )}
                </div>
              </div>
            );
          })}
          {tasks.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title="Nothing in this view"
                body="Switch tabs or create a task from any prospect."
              />
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel title="Task types in use" dense>
        <div className="flex flex-wrap gap-2 p-4">
          {Object.entries(
            state.tasks
              .filter((t) => t.businessId === businessId)
              .reduce<Record<string, number>>((acc, t) => {
                const key = t.type;
                acc[key] = (acc[key] ?? 0) + 1;
                return acc;
              }, {}),
          ).map(([type, count]) => (
            <Pill key={type} tone="neutral">
              {NEXT_ACTION_LABEL[type as keyof typeof NEXT_ACTION_LABEL] ?? type}: {count}
            </Pill>
          ))}
        </div>
      </Panel>
    </div>
  );
}
