import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarClock, Sparkles, TriangleAlert } from "lucide-react";
import { useBusiness } from "@/hooks/use-app-store";
import { calendarEvents } from "@/lib/services/queries";
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

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarScreen,
});

function CalendarScreen() {
  const { state, businessId, index } = useBusiness();
  const events = useMemo(() => calendarEvents(state, businessId), [state, businessId]);
  const [range, setRange] = useState<"today" | "week" | "all">("week");

  const now = Date.now();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = +dayStart + 86_400_000;
  const weekEnd = +dayStart + 7 * 86_400_000;

  const filtered = events.filter((e) => {
    const t = +new Date(e.startAt);
    if (range === "today") return t >= +dayStart && t < dayEnd;
    if (range === "week") return t >= +dayStart - 86_400_000 && t < weekEnd;
    return true;
  });

  const conflicts = useMemo(() => {
    const sorted = [...events]
      .filter((e) => e.kind === "appointment")
      .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
    const out: { a: (typeof sorted)[number]; b: (typeof sorted)[number] }[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const end = prev.endAt ? +new Date(prev.endAt) : +new Date(prev.startAt) + 1_800_000;
      if (+new Date(cur.startAt) < end) out.push({ a: prev, b: cur });
    }
    return out;
  }, [events]);

  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, e) => {
    const key = new Date(e.startAt).toDateString();
    acc[key] = [...(acc[key] ?? []), e];
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Appointments, calls, follow-ups and tasks in one timeline — including everything the AI
            scheduled.
          </p>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-border text-xs">
          {(["today", "week", "all"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-3 py-1.5 capitalize",
                range === r ? "bg-accent" : "text-muted-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Today"
          value={
            events.filter((e) => +new Date(e.startAt) >= +dayStart && +new Date(e.startAt) < dayEnd)
              .length
          }
          icon={<CalendarClock className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="This week"
          value={
            events.filter(
              (e) => +new Date(e.startAt) >= +dayStart && +new Date(e.startAt) < weekEnd,
            ).length
          }
          tone="info"
        />
        <StatCard
          label="AI scheduled"
          value={events.filter((e) => e.aiScheduled).length}
          tone="medium"
          icon={<Sparkles className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Conflicts detected"
          value={conflicts.length}
          tone={conflicts.length ? "critical" : "positive"}
          icon={<TriangleAlert className="h-3.5 w-3.5" />}
        />
      </div>

      {conflicts.length ? (
        <Panel
          title="Scheduling conflicts"
          subtitle="The AI checks every proposed time against the calendar before booking."
          dense
        >
          <div className="divide-y divide-border/70">
            {conflicts.slice(0, 4).map(({ a, b }, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-xs">
                <TriangleAlert className="h-3.5 w-3.5 text-rose-500" />
                <span>
                  <b>{a.title}</b> overlaps with <b>{b.title}</b>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(a.startAt).toLocaleString()} →{" "}
                  {new Date(b.startAt).toLocaleTimeString()}
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => index.prospects[0] && undefined}
                >
                  Suggest new time
                </Button>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <div className="space-y-4">
        {Object.entries(grouped).map(([day, dayEvents]) => (
          <Panel
            key={day}
            title={new Date(day).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            subtitle={`${dayEvents.length} item${dayEvents.length === 1 ? "" : "s"}`}
            dense
          >
            <div className="divide-y divide-border/70">
              {dayEvents.map((e) => {
                const prospect = e.prospectId
                  ? state.prospects.find((p) => p.id === e.prospectId)
                  : undefined;
                const contact = prospect ? index.contactOf(prospect) : undefined;
                const owner = index.userOf(e.ownerId);
                return (
                  <div
                    key={`${e.kind}_${e.id}`}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <div className="w-14 text-right text-[11px] tabular-nums text-muted-foreground">
                      {new Date(e.startAt).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                    <span
                      className={cn(
                        "w-1 self-stretch rounded-full",
                        e.kind === "appointment"
                          ? "bg-teal-500"
                          : e.status === "overdue"
                            ? "bg-rose-500"
                            : "bg-sky-500",
                      )}
                    />
                    <div className="min-w-[200px] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-medium">{e.title}</p>
                        <Pill tone={e.kind === "appointment" ? "info" : "neutral"}>
                          {e.kind.replace(/_/g, " ")}
                        </Pill>
                        {e.status === "missed" || e.status === "overdue" ? (
                          <Pill tone="critical">{e.status}</Pill>
                        ) : (
                          <Pill tone="neutral">{e.status}</Pill>
                        )}
                        {e.aiScheduled ? <Pill tone="ai">AI scheduled</Pill> : null}
                      </div>
                      {e.detail ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{e.detail}</p>
                      ) : null}
                      {contact ? (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          <Link
                            to="/prospects/$id"
                            params={{ id: e.prospectId! }}
                            className="hover:underline"
                          >
                            {contact.firstName} {contact.lastName}
                          </Link>{" "}
                          · <RelativeTime iso={e.startAt} />
                        </p>
                      ) : null}
                    </div>
                    {owner ? (
                      <Avatar
                        name={owner.name}
                        color={owner.avatarColor}
                        size={24}
                        isAi={owner.isAi}
                      />
                    ) : null}
                    {prospect ? (
                      <QuickAction
                        prospectId={prospect.id}
                        action={e.kind === "appointment" ? "task" : "call"}
                        label={e.kind === "appointment" ? "Prep" : "Call"}
                        variant="outline"
                        size="xs"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Panel>
        ))}
        {filtered.length === 0 ? (
          <Panel>
            <EmptyState
              icon={<CalendarClock className="h-5 w-5" />}
              title="Nothing scheduled in this range"
            />
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
