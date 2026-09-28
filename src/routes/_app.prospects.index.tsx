import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LayoutGrid, List, Search, SlidersHorizontal } from "lucide-react";
import { useBusiness } from "@/hooks/use-app-store";
import { filterProspects, type ProspectFilters } from "@/lib/services/queries";
import { SOURCE_LABEL, STATE_LABEL, currency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Avatar,
  EmptyState,
  HotFlame,
  IntentBadge,
  Panel,
  Pill,
  RelativeTime,
  ScoreDelta,
  ScoreRing,
  StateBadge,
} from "@/components/app/primitives";
import { QuickAction } from "@/components/app/prospect-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PipelineStateKey } from "@/lib/domain/types";

export const Route = createFileRoute("/_app/prospects/")({
  component: ProspectsScreen,
});

const FILTER_CHIPS: {
  key: string;
  label: string;
  apply: (f: ProspectFilters) => ProspectFilters;
}[] = [
  { key: "hot", label: "🔥 Hot", apply: (f) => ({ ...f, band: "hot" }) },
  { key: "warm", label: "Warm", apply: (f) => ({ ...f, band: "warm" }) },
  { key: "cold", label: "Cold", apply: (f) => ({ ...f, band: "cold" }) },
  { key: "new", label: "New", apply: (f) => ({ ...f, isNew: true }) },
  {
    key: "awaiting",
    label: "Responded — awaiting us",
    apply: (f) => ({ ...f, awaitingReply: true }),
  },
  { key: "no_response", label: "No response", apply: (f) => ({ ...f, noResponse: true }) },
  { key: "overdue", label: "Follow-up overdue", apply: (f) => ({ ...f, followUpOverdue: true }) },
  { key: "missed_call", label: "Missed call", apply: (f) => ({ ...f, missedCall: true }) },
  { key: "intake", label: "Form incomplete", apply: (f) => ({ ...f, formIncomplete: true }) },
  {
    key: "appointment",
    label: "Appointment booked",
    apply: (f) => ({ ...f, hasAppointment: true }),
  },
  { key: "proposal", label: "Proposal out", apply: (f) => ({ ...f, proposalOut: true }) },
  { key: "won", label: "Won", apply: (f) => ({ ...f, state: "won" }) },
  { key: "lost", label: "Lost", apply: (f) => ({ ...f, state: "lost" }) },
];

function ProspectsScreen() {
  const { state, businessId, index } = useBusiness();
  const [search, setSearch] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sort, setSort] = useState<"score" | "recent" | "value" | "name">("score");
  const [density, setDensity] = useState<"table" | "cards">("table");

  const filters = useMemo(() => {
    let f: ProspectFilters = {
      search,
      state: stateFilter !== "all" ? stateFilter : undefined,
      ownerId: ownerFilter !== "all" ? ownerFilter : undefined,
      source: sourceFilter !== "all" ? sourceFilter : undefined,
    };
    for (const key of chips) {
      const chip = FILTER_CHIPS.find((c) => c.key === key);
      if (chip) f = chip.apply(f);
    }
    return f;
  }, [search, chips, stateFilter, ownerFilter, sourceFilter]);

  const rows = useMemo(() => {
    const result = filterProspects(state, businessId, filters);
    switch (sort) {
      case "recent":
        return [...result].sort(
          (a, b) => +new Date(b.lastActivityAt) - +new Date(a.lastActivityAt),
        );
      case "value":
        return [...result].sort((a, b) => b.value - a.value);
      case "name":
        return [...result].sort((a, b) => index.nameOf(a).localeCompare(index.nameOf(b)));
      default:
        return result;
    }
  }, [state, businessId, filters, sort, index]);

  const owners = state.memberships.filter(
    (m) => m.businessId === businessId && m.status === "active",
  );
  const savedViews = state.savedViews.filter((v) => v.businessId === businessId);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prospects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} of {index.prospects.length} prospects · sorted by{" "}
            {sort === "score" ? "AI score" : sort}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-border">
            <button
              onClick={() => setDensity("table")}
              className={cn("px-2 py-1.5", density === "table" ? "bg-accent" : "")}
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setDensity("cards")}
              className={cn("px-2 py-1.5", density === "cards" ? "bg-accent" : "")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <Panel dense>
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, company, email or summary…"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="h-9 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {(Object.keys(STATE_LABEL) as PipelineStateKey[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {STATE_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="h-9 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              {owners.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {state.users.find((u) => u.id === m.userId)?.name ?? m.userId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="h-9 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {Object.entries(SOURCE_LABEL).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="h-9 w-[150px] text-xs">
              <SlidersHorizontal className="mr-1 h-3 w-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">Sort: AI score</SelectItem>
              <SelectItem value="recent">Sort: last activity</SelectItem>
              <SelectItem value="value">Sort: deal value</SelectItem>
              <SelectItem value="name">Sort: name</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-b border-border/70 px-3 py-2">
          {FILTER_CHIPS.map((chip) => {
            const active = chips.includes(chip.key);
            return (
              <button
                key={chip.key}
                onClick={() =>
                  setChips((prev) =>
                    active ? prev.filter((c) => c !== chip.key) : [...prev, chip.key],
                  )
                }
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] transition",
                  active
                    ? "border-violet-500/50 bg-violet-500/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                {chip.label}
              </button>
            );
          })}
          {chips.length ||
          stateFilter !== "all" ||
          ownerFilter !== "all" ||
          sourceFilter !== "all" ? (
            <button
              onClick={() => {
                setChips([]);
                setStateFilter("all");
                setOwnerFilter("all");
                setSourceFilter("all");
              }}
              className="ml-1 text-[11px] text-muted-foreground underline"
            >
              Clear
            </button>
          ) : null}
          <span className="ml-auto hidden items-center gap-1.5 text-[11px] text-muted-foreground lg:flex">
            Saved views:
            {savedViews.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setChips([]);
                  setSearch("");
                  const f = v.filters as {
                    band?: "hot";
                    awaitingReply?: boolean;
                    missedActivity?: boolean;
                    formStatus?: string;
                    priority?: string;
                  };
                  if (f.band) setChips(["hot"]);
                  if (f.awaitingReply) setChips(["awaiting"]);
                  if (f.missedActivity) setChips(["missed_call"]);
                  if (f.formStatus) setChips(["intake"]);
                }}
                className="rounded-full border border-border px-2 py-0.5 hover:border-primary/40"
              >
                {v.name}
              </button>
            ))}
          </span>
        </div>

        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No prospects match these filters"
              body="Loosen a filter or clear the search to see the full book."
            />
          </div>
        ) : density === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Prospect</th>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Intent</th>
                  <th className="px-3 py-2">Engagement</th>
                  <th className="px-3 py-2">Stage</th>
                  <th className="px-3 py-2">Last activity</th>
                  <th className="px-3 py-2">Next action</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2 text-right">AI score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const contact = index.contactOf(p);
                  const company = index.companyOf(p);
                  const owner = index.userOf(p.ownerId);
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-border/60 transition hover:bg-accent/40"
                    >
                      <td className="px-3 py-2">
                        <Pill tone={p.priority}>{p.priority}</Pill>
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          to="/prospects/$id"
                          params={{ id: p.id }}
                          className="flex items-center gap-2 hover:underline"
                        >
                          {contact ? (
                            <Avatar
                              name={`${contact.firstName} ${contact.lastName}`}
                              color={contact.avatarColor}
                              size={26}
                            />
                          ) : null}
                          <span className="font-medium">{index.nameOf(p)}</span>
                          <HotFlame score={p.score} />
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {company?.name ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {SOURCE_LABEL[p.source]}
                      </td>
                      <td className="px-3 py-2">
                        <IntentBadge intent={p.intent} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-sky-500"
                              style={{ width: `${p.engagement}%` }}
                            />
                          </div>
                          <span className="text-[11px] tabular-nums text-muted-foreground">
                            {p.engagement}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <StateBadge state={p.state} />
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        <RelativeTime iso={p.lastActivityAt} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">
                            {p.nextActionType ? (
                              <Pill tone="neutral">{p.nextActionType.replace(/_/g, " ")}</Pill>
                            ) : (
                              "—"
                            )}
                          </span>
                          <QuickAction
                            prospectId={p.id}
                            action={p.nextActionType === "call" ? "call" : "reply"}
                            label="Do"
                            variant="outline"
                            size="xs"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {owner?.name ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <ScoreDelta delta={p.scoreDelta} />
                          <ScoreRing score={p.score} size={32} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((p) => {
              const contact = index.contactOf(p);
              const company = index.companyOf(p);
              return (
                <div key={p.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start gap-3">
                    <ScoreRing score={p.score} size={40} />
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/prospects/$id"
                        params={{ id: p.id }}
                        className="block truncate text-sm font-medium hover:underline"
                      >
                        {index.nameOf(p)}
                      </Link>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {company?.name ?? "—"} · {currency(p.value)}
                      </p>
                    </div>
                    <HotFlame score={p.score} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <IntentBadge intent={p.intent} />
                    <StateBadge state={p.state} />
                    {contact?.location ? <Pill tone="neutral">{contact.location}</Pill> : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">{p.summary}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      <RelativeTime iso={p.lastActivityAt} />
                    </span>
                    <QuickAction
                      prospectId={p.id}
                      action={p.nextActionType === "call" ? "call" : "reply"}
                      label="Act"
                      variant="outline"
                      size="xs"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
