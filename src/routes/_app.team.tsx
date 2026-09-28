import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Minus, ShieldCheck, Sparkles, UserPlus, Users } from "lucide-react";
import { useBusiness } from "@/hooks/use-app-store";
import { actions } from "@/lib/data/store";
import {
  PERMISSIONS,
  PERMISSION_GROUPS,
  ROLES,
  ROLE_LIST,
  effectivePermissions,
} from "@/lib/domain/permissions";
import { cn } from "@/lib/utils";
import { AUTONOMY_LABEL, AUTONOMY_SHORT } from "@/components/app/labels";
import {
  Avatar,
  EmptyState,
  Panel,
  Pill,
  RelativeTime,
  StatCard,
} from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PermissionKey, RoleKey } from "@/lib/domain/types";

export const Route = createFileRoute("/_app/team")({
  component: TeamScreen,
});

function TeamScreen() {
  const { state, businessId, index, currentUser } = useBusiness();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleKey>("salesperson");
  const [teamId, setTeamId] = useState<string>("");
  const [matrixRole, setMatrixRole] = useState<RoleKey>("salesperson");

  const memberships = state.memberships.filter((m) => m.businessId === businessId);
  const teams = state.teams.filter((t) => t.businessId === businessId);
  const agents = state.agents.filter((a) => a.businessId === businessId);
  const businessProspects = index.prospects;

  const member =
    memberships.find((m) => m.id === memberId) ??
    memberships.find((m) => m.userId === currentUser?.id) ??
    memberships[0];

  const memberCounts = useMemo(() => {
    const users = state.users.filter((u) => !u.isAi);
    return {
      users: users.length,
      invited: memberships.filter((m) => m.status === "invited").length,
      agents: agents.length,
    };
  }, [state.users, memberships, agents]);

  const canEdit = member ? effectivePermissions(member) : new Set<PermissionKey>();

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team & permissions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Roles, granular overrides and AI agents — the same computation the service layer
            enforces, so the UI never over-promises access.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-3.5 w-3.5" /> Invite user
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="People"
          value={memberCounts.users}
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Active in this business"
          value={memberships.filter((m) => m.status === "active").length}
          tone="positive"
        />
        <StatCard
          label="Pending invites"
          value={memberCounts.invited}
          tone={memberCounts.invited ? "medium" : "neutral"}
        />
        <StatCard
          label="AI agents"
          value={agents.length}
          tone="info"
          icon={<Sparkles className="h-3.5 w-3.5" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <Panel
          dense
          title="Members"
          subtitle={`${memberships.length} memberships in this business`}
        >
          <div className="divide-y divide-border/70">
            {memberships.map((m) => {
              const u = state.users.find((x) => x.id === m.userId);
              if (!u) return <div key={m.id} />;
              const owned = businessProspects.filter((p) => p.ownerId === u.id);
              const hot = owned.filter((p) => p.score >= 70).length;
              const perms = effectivePermissions(m);
              const overrides = Object.keys(m.permissionOverrides ?? {}).length;
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 px-4 py-3",
                    member?.id === m.id && "bg-accent/40",
                  )}
                >
                  <Avatar name={u.name} color={u.avatarColor} size={34} />
                  <div className="min-w-[180px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-medium">{u.name}</p>
                      {u.id === currentUser?.id ? <Pill tone="info">you</Pill> : null}
                      <Pill
                        tone={
                          m.status === "active"
                            ? "positive"
                            : m.status === "invited"
                              ? "medium"
                              : "critical"
                        }
                      >
                        {m.status}
                      </Pill>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {u.title} · {u.email} · last active <RelativeTime iso={u.lastActiveAt} />
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {owned.length} prospects · {hot} hot · {perms.size} permissions
                      {overrides ? ` · ${overrides} override${overrides === 1 ? "" : "s"}` : ""}
                    </p>
                  </div>
                  <Select
                    value={m.roleKey}
                    onValueChange={(v) => actions.updateMemberRole(m.id, v as RoleKey)}
                  >
                    <SelectTrigger
                      className="h-8 w-[150px] text-xs"
                      disabled={m.roleKey === "owner"}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_LIST.filter((r) => r.key !== "ai_agent" || false).map((r) => (
                        <SelectItem key={r.key} value={r.key}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="xs" variant="outline" onClick={() => setMemberId(m.id)}>
                    Permissions
                  </Button>
                </div>
              );
            })}
            {memberships.length === 0 ? (
              <EmptyState icon={<Users className="h-5 w-5" />} title="No members yet" />
            ) : null}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Teams" dense>
            <div className="divide-y divide-border/70">
              {teams.map((t) => (
                <div key={t.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                    <p className="text-xs font-medium">{t.name}</p>
                    <Pill tone="neutral">{t.memberIds.length} members</Pill>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{t.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.memberIds.map((id) => {
                      const u = state.users.find((x) => x.id === id);
                      return u ? (
                        <Avatar key={id} name={u.name} color={u.avatarColor} size={22} />
                      ) : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="AI agents"
            subtitle="Each agent has its own autonomy, scopes and approval floor."
            dense
          >
            <div className="divide-y divide-border/70">
              {agents.map((a) => {
                const owner = state.users.find((u) => u.id === a.escalationUserId);
                return (
                  <div key={a.id} className="space-y-1.5 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Avatar name={a.name} color="#8b5cf6" size={26} isAi />
                      <p className="text-xs font-medium">{a.name}</p>
                      <Pill
                        tone={
                          a.autonomy === "autonomous"
                            ? "ai"
                            : a.autonomy === "approve"
                              ? "medium"
                              : "neutral"
                        }
                      >
                        {AUTONOMY_SHORT[a.autonomy]} · {AUTONOMY_LABEL[a.autonomy]}
                      </Pill>
                      <Pill tone={a.status === "active" ? "positive" : "medium"}>{a.status}</Pill>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{a.purpose}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Model {a.model} · confidence floor {(a.confidenceFloor * 100).toFixed(0)}% ·
                      escalates to {owner?.name ?? "manager"}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {a.scopes.slice(0, 5).map((s) => (
                        <Pill key={s} tone="neutral">
                          {s}
                        </Pill>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() =>
                          actions.setAgentStatus(a.id, a.status === "paused" ? "active" : "paused")
                        }
                      >
                        {a.status === "paused" ? "Resume agent" : "Pause agent"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>

      <Panel
        title="Permissions"
        subtitle="Granular control across leads, comms, forms, pipeline, automations, AI, integrations, reports and admin."
      >
        <Tabs value={member ? member.id : ""} onValueChange={(v) => setMemberId(v)}>
          <TabsList className="h-8 flex-wrap">
            {memberships.slice(0, 8).map((m) => {
              const u = state.users.find((x) => x.id === m.userId);
              return (
                <TabsTrigger key={m.id} value={m.id} className="text-xs">
                  {u?.name.split(" ")[0] ?? m.id}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {member ? (
            <TabsContent value={member.id} className="mt-3 space-y-4">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-[11px]">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span className="font-medium">{ROLES[member.roleKey]?.name} role</span>
                <span className="text-muted-foreground">{ROLES[member.roleKey]?.description}</span>
                <span className="ml-auto text-muted-foreground">
                  {effectivePermissions(member).size} of {PERMISSIONS.length} permissions effective
                </span>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                {PERMISSION_GROUPS.map((group) => (
                  <div key={group} className="space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group}
                    </p>
                    {PERMISSIONS.filter((p) => p.group === group).map((p) => {
                      const granted = effectivePermissions(member).has(p.key);
                      const overridden = member.permissionOverrides?.[p.key] !== undefined;
                      return (
                        <button
                          key={p.key}
                          onClick={() => actions.togglePermission(member.id, p.key)}
                          disabled={member.roleKey === "owner"}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left text-[11px] hover:bg-accent/50",
                            granted && "border-emerald-500/30 bg-emerald-500/[0.06]",
                            overridden && "ring-1 ring-violet-500/40",
                          )}
                        >
                          {granted ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Minus className="h-3 w-3 text-muted-foreground" />
                          )}
                          <span className="min-w-0 flex-1 truncate">{p.label}</span>
                          {overridden ? <Pill tone="ai">override</Pill> : null}
                          {p.risk === "high" ? <Pill tone="critical">high impact</Pill> : null}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Toggling a permission records a PERMISSION_CHANGED event and an audit entry with
                previous/new state, so access changes are reviewable.
                {member.roleKey === "owner"
                  ? " Owners always retain full control of the tenant."
                  : ""}
              </p>
            </TabsContent>
          ) : null}
        </Tabs>
      </Panel>

      <Panel
        title="Role reference"
        subtitle="What each role can do out of the box — overrides are layered on top."
      >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ROLE_LIST.map((r) => (
            <button
              key={r.key}
              onClick={() => setMatrixRole(r.key)}
              className={cn(
                "rounded-full border border-border px-2.5 py-1 text-[11px]",
                matrixRole === r.key ? "bg-accent" : "text-muted-foreground",
              )}
            >
              {r.name} · {r.permissions.length}
            </button>
          ))}
        </div>
        <p className="mb-2 text-[11px] text-muted-foreground">{ROLES[matrixRole]?.description}</p>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {PERMISSIONS.map((p) => {
            const granted = ROLES[matrixRole]?.permissions.includes(p.key);
            return (
              <div
                key={p.key}
                className={cn(
                  "flex items-center gap-2 rounded-md border border-border px-2 py-1 text-[11px]",
                  !granted && "opacity-45",
                )}
              >
                {granted ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                {p.label}
              </div>
            );
          })}
        </div>
      </Panel>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
            <DialogDescription>
              They join this business with the selected role. Permissions can be refined per user
              afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium">Name</p>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jordan Miles"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium">Work email</p>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jordan@northwind.test"
                className="h-9 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-xs font-medium">Role</p>
                <Select value={role} onValueChange={(v) => setRole(v as RoleKey)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_LIST.filter((r) => r.key !== "owner").map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium">Team</p>
                <Select value={teamId} onValueChange={setTeamId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="No team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!name.trim() || !email.trim()}
              onClick={() => {
                actions.inviteMember({
                  name: name.trim(),
                  email: email.trim(),
                  roleKey: role,
                  businessId,
                  teamId: teamId || undefined,
                });
                setName("");
                setEmail("");
                setInviteOpen(false);
              }}
            >
              Send invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-[11px] text-muted-foreground">
        Looking for someone's book of business?{" "}
        <Link to="/prospects" className="underline">
          Open prospects
        </Link>{" "}
        and filter by owner.
      </p>
    </div>
  );
}
