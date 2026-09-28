import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Building2, Search } from "lucide-react";
import { useBusiness } from "@/hooks/use-app-store";
import { currency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Avatar,
  EmptyState,
  Panel,
  Pill,
  RelativeTime,
  ScoreRing,
  Sparkline,
} from "@/components/app/primitives";
import { QuickAction } from "@/components/app/prospect-actions";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/companies/")({
  component: CompaniesScreen,
});

function CompaniesScreen() {
  const { state, businessId, index } = useBusiness();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const companies = useMemo(
    () =>
      state.companies
        .filter((c) => c.businessId === businessId)
        .filter((c) =>
          search
            ? `${c.name} ${c.industry} ${c.location}`.toLowerCase().includes(search.toLowerCase())
            : true,
        )
        .sort((a, b) => b.healthScore - a.healthScore),
    [state, businessId, search],
  );

  const active = companies.find((c) => c.id === selected) ?? companies[0];
  const companyProspects = active ? index.prospects.filter((p) => p.companyId === active.id) : [];
  const companyContacts = active ? state.contacts.filter((c) => c.companyId === active.id) : [];
  const companyComms = active ? state.communications.filter((c) => c.companyId === active.id) : [];
  const companyDocs = active ? state.documents.filter((d) => d.companyId === active.id) : [];
  const pipelineValue = companyProspects.reduce((s, p) => s + p.value, 0);
  const wonValue = companyProspects
    .filter((p) => state.deals.some((d) => d.prospectId === p.id && d.won))
    .reduce((s, p) => s + p.value, 0);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Company-level 360: contacts, opportunities, communications, documents and relationship
          history.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel dense>
          <div className="border-b border-border/70 p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search companies…"
                className="h-9 pl-8 text-sm"
              />
            </div>
          </div>
          <div className="max-h-[70vh] divide-y divide-border/70 overflow-y-auto">
            {companies.map((c) => {
              const prospects = index.prospects.filter((p) => p.companyId === c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={cn(
                    "w-full px-4 py-3 text-left hover:bg-accent/50",
                    active?.id === c.id && "bg-accent/60",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-md bg-muted text-[10px] font-semibold">
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{c.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {c.industry} · {c.location}
                      </span>
                    </span>
                    <Pill
                      tone={
                        c.tier === "strategic" ? "ai" : c.tier === "mid_market" ? "info" : "neutral"
                      }
                    >
                      {c.tier.replace(/_/g, " ")}
                    </Pill>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {prospects.length} prospects ·{" "}
                    {currency(prospects.reduce((s, p) => s + p.value, 0))} open
                  </p>
                </button>
              );
            })}
            {companies.length === 0 ? (
              <EmptyState icon={<Building2 className="h-5 w-5" />} title="No companies match" />
            ) : null}
          </div>
        </Panel>

        {active ? (
          <div className="space-y-4">
            <Panel>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">{active.name}</h2>
                    <Pill tone={active.tier === "strategic" ? "ai" : "info"}>
                      {active.tier.replace(/_/g, " ")}
                    </Pill>
                    <Pill
                      tone={
                        active.healthScore >= 80
                          ? "positive"
                          : active.healthScore >= 65
                            ? "medium"
                            : "critical"
                      }
                    >
                      health {active.healthScore}
                    </Pill>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {active.industry} · {active.size} · {active.location}
                    {active.domain ? ` · ${active.domain}` : ""}
                    {active.annualRevenue ? ` · revenue ${currency(active.annualRevenue)}` : ""}
                  </p>
                  {active.notes ? (
                    <p className="mt-2 max-w-2xl text-xs text-muted-foreground">{active.notes}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {active.tags.map((t) => (
                      <Pill key={t} tone="neutral">
                        {t}
                      </Pill>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-border px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Open
                    </p>
                    <p className="text-sm font-semibold">{currency(pipelineValue)}</p>
                  </div>
                  <div className="rounded-lg border border-border px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Won
                    </p>
                    <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {currency(wonValue)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Contacts
                    </p>
                    <p className="text-sm font-semibold">{companyContacts.length}</p>
                  </div>
                </div>
              </div>
            </Panel>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Contacts" subtitle="Every person we know at this account." dense>
                <div className="divide-y divide-border/70">
                  {companyContacts.map((c) => {
                    const prospect = companyProspects.find((p) => p.contactId === c.id);
                    return (
                      <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                        <Avatar
                          name={`${c.firstName} ${c.lastName}`}
                          color={c.avatarColor}
                          size={28}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">
                            {c.firstName} {c.lastName}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {c.jobTitle} · {c.email}
                          </p>
                        </div>
                        {prospect ? (
                          <>
                            <ScoreRing score={prospect.score} size={28} />
                            <QuickAction
                              prospectId={prospect.id}
                              action="reply"
                              label="Contact"
                              variant="outline"
                              size="xs"
                            />
                          </>
                        ) : (
                          <Pill tone="neutral">contact only</Pill>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Panel>

              <Panel title="Opportunities" dense>
                <div className="divide-y divide-border/70">
                  {companyProspects.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <Link
                          to="/prospects/$id"
                          params={{ id: p.id }}
                          className="truncate text-xs font-medium hover:underline"
                        >
                          {index.nameOf(p)}
                        </Link>
                        <p className="text-[11px] text-muted-foreground">
                          {p.state} · {currency(p.value)} · intent {p.intent.replace(/_/g, " ")} ·{" "}
                          <RelativeTime iso={p.lastActivityAt} />
                        </p>
                      </div>
                      <Sparkline
                        data={[3, 5, 4, 7, p.engagement / 12, p.score / 8]}
                        className="hidden w-16 sm:block"
                        tone={p.score >= 70 ? "positive" : "primary"}
                      />
                      <Pill tone={p.priority}>{p.priority}</Pill>
                    </div>
                  ))}
                  {companyProspects.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-muted-foreground">No prospects yet.</p>
                  ) : null}
                </div>
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Recent communications" dense>
                <div className="divide-y divide-border/70">
                  {companyComms.slice(0, 6).map((c) => (
                    <div key={c.id} className="px-4 py-2.5">
                      <p className="text-[11px] text-muted-foreground">
                        {c.channel} · {c.direction} · <RelativeTime iso={c.occurredAt} />
                      </p>
                      <p className="line-clamp-2 text-xs">{c.preview}</p>
                    </div>
                  ))}
                  {companyComms.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-muted-foreground">
                      No communications yet.
                    </p>
                  ) : null}
                </div>
              </Panel>

              <Panel title="Documents & appointments" dense>
                <div className="divide-y divide-border/70">
                  {companyDocs.map((d) => (
                    <div key={d.id} className="flex items-center gap-2 px-4 py-2.5 text-xs">
                      <span className="min-w-0 flex-1 truncate">{d.name}</span>
                      <Pill tone="neutral">{d.kind}</Pill>
                      {d.status ? (
                        <Pill tone={d.status === "signed" ? "positive" : "info"}>{d.status}</Pill>
                      ) : null}
                    </div>
                  ))}
                  {state.appointments
                    .filter((a) => a.companyId === active.id)
                    .map((a) => (
                      <div key={a.id} className="flex items-center gap-2 px-4 py-2.5 text-xs">
                        <span className="min-w-0 flex-1 truncate">{a.title}</span>
                        <Pill tone={a.status === "missed" ? "critical" : "info"}>{a.status}</Pill>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(a.startAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                </div>
              </Panel>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
