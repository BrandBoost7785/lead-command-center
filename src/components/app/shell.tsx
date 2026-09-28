import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  CheckCheck,
  ChevronDown,
  ClipboardList,
  Cog,
  Kanban,
  LayoutDashboard,
  ListTodo,
  Menu,
  MessageSquare,
  Pause,
  Play,
  Plug,
  Search,
  Send,
  Sparkles,
  Users,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { actions } from "@/lib/data/store";
import { useAppState, useBusiness, useHydrated } from "@/hooks/use-app-store";
import { searchEverything } from "@/lib/ai/reasoner";
import { Avatar, Pill, RelativeTime } from "./primitives";
import { AUTONOMY_LABEL } from "@/components/app/labels";

const NAV: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: "attention" | "tasks" | "approvals" | "none";
}[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, badge: "attention" },
  { to: "/ai", label: "AI Command Center", icon: Sparkles, badge: "approvals" },
  { to: "/prospects", label: "Prospects", icon: Users, badge: "attention" },
  { to: "/companies", label: "Companies", icon: Building2, badge: "none" },
  { to: "/communications", label: "Communications", icon: MessageSquare, badge: "none" },
  { to: "/tasks", label: "Tasks", icon: ListTodo, badge: "tasks" },
  { to: "/pipeline", label: "Pipeline", icon: Kanban, badge: "none" },
  { to: "/forms", label: "Forms / Intake", icon: ClipboardList, badge: "none" },
  { to: "/calendar", label: "Calendar", icon: Calendar, badge: "none" },
  { to: "/ai-activity", label: "AI Activity", icon: Activity, badge: "approvals" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, badge: "none" },
  { to: "/automations", label: "Automations", icon: Workflow, badge: "none" },
  { to: "/integrations", label: "Integrations", icon: Plug, badge: "none" },
  { to: "/team", label: "Team", icon: Users, badge: "none" },
  { to: "/settings", label: "Settings", icon: Cog, badge: "none" },
];

/* -------------------------------------------------------------------------- */

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  if (!hydrated) return <BootScreen />;
  return <ShellInner>{children}</ShellInner>;
}

function BootScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Sparkles className="h-5 w-5 animate-pulse text-violet-500" />
        <span className="text-sm">Preparing your command center…</span>
      </div>
    </div>
  );
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const state = useAppState();
  const { businessId, business, attention, stats, aiPaused, currentUser } = useBusiness();
  const [mobileNav, setMobileNav] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [bizOpen, setBizOpen] = useState(false);

  const tasksDue = state.tasks.filter(
    (t) =>
      t.businessId === businessId &&
      t.status !== "completed" &&
      t.status !== "cancelled" &&
      +new Date(t.dueAt) <= Date.now() + 86_400_000,
  ).length;
  const approvals = state.actions.filter(
    (a) =>
      a.businessId === businessId && (a.status === "awaiting_approval" || a.status === "proposed"),
  ).length;
  const unread = state.notifications.filter((n) => n.businessId === businessId && !n.readAt);

  const badgeFor = (kind: string) =>
    kind === "attention"
      ? attention.length
      : kind === "tasks"
        ? tasksDue
        : kind === "approvals"
          ? approvals
          : 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
        setUserMenu(false);
        setBizOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-sidebar-border bg-sidebar transition-transform lg:static lg:translate-x-0",
          mobileNav ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2.5 px-4 py-4">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
            <Zap className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">Lead Intelligence</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {state.tenants.find((t) => t.id === state.session.tenantId)?.name}
            </p>
          </div>
          <button
            className="ml-auto rounded p-1 text-muted-foreground lg:hidden"
            onClick={() => setMobileNav(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Business switcher */}
        <div className="relative px-3 pb-2">
          <button
            onClick={() => setBizOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-card px-2.5 py-2 text-left hover:border-primary/40"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: business?.brandColor ?? "oklch(0.6 0.15 250)" }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{business?.name}</span>
              <span className="block truncate text-[10px] text-muted-foreground">
                {business?.industry}
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {bizOpen ? (
            <div className="absolute left-3 right-3 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
              {state.businesses.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    actions.setBusiness(b.id);
                    setBizOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-accent",
                    b.id === businessId && "bg-accent/60",
                  )}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: b.brandColor }} />
                  <span className="flex-1 truncate">{b.name}</span>
                  {b.id === businessId ? (
                    <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                  ) : null}
                </button>
              ))}
              <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
                Multi-business: data, AI config and integrations are isolated per business.
              </div>
            </div>
          ) : null}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
          {NAV.map((item) => {
            const count = badgeFor(item.badge ?? "none");
            return (
              <NavLink
                key={item.to}
                to={item.to}
                label={item.label}
                icon={item.icon}
                count={count}
                onNavigate={() => setMobileNav(false)}
              />
            );
          })}
        </nav>

        {/* AI status */}
        <div className="border-t border-sidebar-border p-3">
          <div className="rounded-lg border border-violet-500/25 bg-violet-500/5 p-2.5">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  aiPaused ? "bg-amber-500" : "animate-pulse bg-emerald-500",
                )}
              />
              <span className="text-[11px] font-semibold">AI {aiPaused ? "paused" : "active"}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {AUTONOMY_LABEL[business?.settings.defaultAutonomy ?? "approve"]}
              </span>
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
              {approvals > 0
                ? `${approvals} action${approvals === 1 ? "" : "s"} waiting for approval`
                : aiPaused
                  ? "Autonomous execution suspended"
                  : "Handling monitoring, scoring and routing"}
            </p>
            <button
              onClick={() => actions.toggleAiPause(businessId)}
              className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent"
            >
              {aiPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              {aiPaused ? "Resume AI" : "Pause AI"}
            </button>
          </div>
        </div>
      </aside>

      {mobileNav ? (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileNav(false)}
        />
      ) : null}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur lg:px-5">
          <button
            className="rounded p-1.5 text-muted-foreground hover:bg-accent lg:hidden"
            onClick={() => setMobileNav(true)}
          >
            <Menu className="h-4.5 w-4.5" />
          </button>

          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 text-left text-xs text-muted-foreground hover:border-primary/40 sm:max-w-md"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="truncate">Search prospects, emails, tasks…</span>
            <kbd className="ml-auto hidden rounded border border-border px-1.5 py-0.5 text-[10px] sm:block">
              ⌘K
            </kbd>
          </button>

          <Link
            to="/ai"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 px-3 text-xs font-medium text-white shadow-sm hover:opacity-95"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AI Command</span>
          </Link>

          <div className="relative">
            <button
              onClick={() => {
                setNotifOpen((v) => !v);
                setUserMenu(false);
              }}
              className="relative rounded-lg border border-border bg-card p-2 text-muted-foreground hover:border-primary/40"
            >
              <Bell className="h-4 w-4" />
              {unread.length ? (
                <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {unread.length}
                </span>
              ) : null}
            </button>
            {notifOpen ? <NotificationsPanel onClose={() => setNotifOpen(false)} /> : null}
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setUserMenu((v) => !v);
                setNotifOpen(false);
              }}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 hover:border-primary/40"
            >
              <Avatar
                name={currentUser?.name ?? "User"}
                color={currentUser?.avatarColor}
                size={22}
              />
              <span className="hidden text-xs font-medium sm:block">{currentUser?.name}</span>
              <ChevronDown className="hidden h-3 w-3 text-muted-foreground sm:block" />
            </button>
            {userMenu ? (
              <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                <div className="border-b border-border px-3 py-2">
                  <p className="text-xs font-semibold">{currentUser?.name}</p>
                  <p className="text-[11px] text-muted-foreground">{currentUser?.email}</p>
                </div>
                <Link
                  to="/settings"
                  className="block px-3 py-2 text-xs hover:bg-accent"
                  onClick={() => setUserMenu(false)}
                >
                  Business settings
                </Link>
                <Link
                  to="/team"
                  className="block px-3 py-2 text-xs hover:bg-accent"
                  onClick={() => setUserMenu(false)}
                >
                  Team & permissions
                </Link>
                <button
                  className="block w-full px-3 py-2 text-left text-xs hover:bg-accent"
                  onClick={() => {
                    setUserMenu(false);
                    actions.recomputeIntelligence();
                  }}
                >
                  Re-run intelligence
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <main className="min-w-0 flex-1 px-3 py-4 lg:px-6 lg:py-6">{children}</main>
      </div>

      {searchOpen ? <CommandPalette onClose={() => setSearchOpen(false)} /> : null}
    </div>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  count,
  onNavigate,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  count: number;
  onNavigate: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition",
        active
          ? "bg-sidebar-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1 truncate">{label}</span>
      {count > 0 ? (
        <span className="rounded-full bg-rose-500/12 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 ring-1 ring-rose-500/25 dark:text-rose-400">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const state = useAppState();
  const { businessId } = useBusiness();
  const items = state.notifications.filter((n) => n.businessId === businessId);
  const navigate = useNavigate();

  return (
    <div className="absolute right-0 top-full z-50 mt-1 w-[360px] overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="text-xs font-semibold">Notifications</p>
        <button
          className="text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => actions.markAllNotificationsRead(businessId)}
        >
          Mark all read
        </button>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">Nothing yet.</p>
        ) : (
          items.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                actions.markNotificationRead(n.id);
                onClose();
                if (n.prospectId) navigate({ to: "/prospects/$id", params: { id: n.prospectId } });
              }}
              className={cn(
                "flex w-full gap-2.5 border-b border-border/60 px-3 py-2.5 text-left hover:bg-accent",
                !n.readAt && "bg-violet-500/[0.04]",
              )}
            >
              <span
                className={cn(
                  "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                  n.readAt ? "bg-border" : "bg-violet-500",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium">{n.title}</span>
                </span>
                <span className="mt-0.5 block line-clamp-2 text-[11px] text-muted-foreground">
                  {n.body}
                </span>
                <span className="mt-1 flex items-center gap-2">
                  <Pill
                    tone={
                      n.priority === "critical"
                        ? "critical"
                        : n.priority === "high"
                          ? "high"
                          : "neutral"
                    }
                  >
                    {n.kind.replace(/_/g, " ")}
                  </Pill>
                  <span className="text-[10px] text-muted-foreground">
                    <RelativeTime iso={n.createdAt} />
                  </span>
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Command palette — search everything + jump into AI                      */
/* -------------------------------------------------------------------------- */

function CommandPalette({ onClose }: { onClose: () => void }) {
  const state = useAppState();
  const { businessId } = useBusiness();
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const results = useMemo(
    () => (query.length > 1 ? searchEverything(state, businessId, query) : []),
    [state, businessId, query],
  );

  const suggestions = [
    "Show me my 15 hottest prospects",
    "Who needs a follow-up?",
    "Show me everyone who responded today",
    "Why is Sarah marked as high priority?",
    "Prepare my calls for today",
    "Draft follow-ups for everyone waiting more than 3 days",
    "Show me missed opportunities",
    "Find everyone who hasn't completed their intake",
    "What should I do next?",
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                navigate({ to: "/ai", search: { q: query } as never });
                onClose();
              }
            }}
            placeholder="Search everything, or ask the AI a question…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            esc
          </kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {results.length > 0 ? (
            <>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Results
              </p>
              {results.map((r) => (
                <button
                  key={`${r.kind}_${r.id}`}
                  onClick={() => {
                    if (r.prospectId)
                      navigate({ to: "/prospects/$id", params: { id: r.prospectId } });
                    else navigate({ to: r.href as never });
                    onClose();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-accent"
                >
                  <Pill tone="neutral">{r.kind}</Pill>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{r.title}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {r.subtitle}
                    </span>
                  </span>
                </button>
              ))}
            </>
          ) : (
            <>
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {query.length > 1 ? "No direct matches — try asking" : "Ask the AI"}
              </p>
              {suggestions
                .filter((s) => !query || s.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 7)
                .map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      navigate({ to: "/ai", search: { q: s } as never });
                      onClose();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-accent"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                    <span className="flex-1 truncate">{s}</span>
                    <Send className="h-3 w-3 text-muted-foreground" />
                  </button>
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
