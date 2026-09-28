import type {
  AIAction,
  AIInsight,
  AppState,
  AuditLogEntry,
  Communication,
  DomainEvent,
  EventType,
  Membership,
  Notification,
  PermissionKey,
  Priority,
  Prospect,
  RoleKey,
  Task,
  User,
} from "@/lib/domain/types";
import { ROLES, effectivePermissions } from "@/lib/domain/permissions";
import { buildSeedState, rehydrate, shiftTimestamps } from "@/lib/data/seed";

/* -------------------------------------------------------------------------- */
/* Store — a tiny observable state container with an event-driven reducer.     */
/* Mutations are the only way state changes, and every mutation writes an      */
/* event + audit entry, which is what the AI Activity screen reads.           */
/* -------------------------------------------------------------------------- */

type Listener = () => void;

let state: AppState = buildSeedState(Date.now());
let listeners: Listener[] = [];

const STORAGE_KEY = "lead-intelligence/state/v4";

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ seededAt: state.seededAt, version: state.version }),
    );
  } catch {
    /* storage disabled — the store still works in-memory */
  }
}

export function getState(): AppState {
  return state;
}

export function subscribe(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function setState(updater: (prev: AppState) => AppState) {
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
}

/** Called once on the client after hydration: re-anchor the demo clock. */
export function hydrateFromStorage() {
  if (typeof window === "undefined") return;
  let seededAt = state.seededAt;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { seededAt?: string; version?: number };
      if (parsed.version === state.version && parsed.seededAt) seededAt = parsed.seededAt;
      else return resetDemo();
    }
  } catch {
    /* ignore */
  }
  const delta = Date.now() - new Date(seededAt).getTime();
  if (delta > 5 * 60_000 && delta < 14 * 86_400_000) {
    setState((prev) =>
      rehydrate(
        { ...shiftTimestamps(prev, delta), seededAt: new Date().toISOString() },
        Date.now(),
      ),
    );
  } else {
    setState((prev) => rehydrate(prev, Date.now()));
  }
}

export function resetDemo() {
  setState(() => buildSeedState(Date.now()));
}

/* -------------------------------------------------------------------------- */
/* Mutation helpers                                                            */
/* -------------------------------------------------------------------------- */

let counter = 1000;
const uid = (prefix: string) =>
  `${prefix}_${(counter++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

interface MutationMeta {
  actorId?: string;
  actorKind?: DomainEvent["actorKind"];
  reason?: string;
  eventType?: EventType;
  eventSummary?: string;
  eventDetail?: string;
  effects?: DomainEvent["effects"];
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  reversible?: boolean;
  auditAction?: string;
}

/** Append an event and an audit entry, then return the new state. */
function withEventAndAudit(
  prev: AppState,
  meta: MutationMeta,
  scope: {
    businessId?: string;
    prospectId?: string;
    contactId?: string;
    companyId?: string;
    channel?: Communication["channel"];
  },
): AppState {
  const businessId = scope.businessId ?? prev.session.businessId;
  const actorId = meta.actorId ?? prev.session.userId;
  const actor = prev.users.find((u) => u.id === actorId);
  const actorKind = meta.actorKind ?? (actor?.isAi ? "ai" : "user");

  const event: DomainEvent = {
    id: uid("evt"),
    type: meta.eventType ?? "LEAD_UPDATED",
    tenantId: prev.session.tenantId,
    businessId,
    prospectId: scope.prospectId,
    contactId: scope.contactId,
    companyId: scope.companyId,
    actorId,
    actorKind,
    channel: scope.channel,
    occurredAt: new Date().toISOString(),
    summary: meta.eventSummary ?? "Record updated",
    detail: meta.eventDetail,
    effects: meta.effects,
    processedBy: ["audit"],
  };

  const audit: AuditLogEntry = {
    id: uid("aud"),
    tenantId: prev.session.tenantId,
    businessId,
    actorId,
    actorKind: actorKind === "contact" || actorKind === "integration" ? "system" : actorKind,
    actorName: actor?.name ?? "System",
    action: meta.auditAction ?? meta.eventType?.toLowerCase() ?? "update",
    targetType: meta.targetType ?? "record",
    targetId: meta.targetId ?? scope.prospectId ?? businessId,
    targetLabel: meta.targetLabel ?? event.summary,
    previousState: meta.previousState,
    newState: meta.newState,
    reason: meta.reason ?? meta.eventDetail ?? "User action recorded.",
    metadata: { eventId: event.id },
    occurredAt: event.occurredAt,
    reversible: meta.reversible ?? true,
  };

  const next: AppState = {
    ...prev,
    events: [event, ...prev.events].slice(0, 5_000),
    audit: [audit, ...prev.audit].slice(0, 5_000),
  };
  return rehydrate(next, Date.now());
}

function patchProspect(prev: AppState, id: string, patch: Partial<Prospect>): AppState {
  return {
    ...prev,
    prospects: prev.prospects.map((p) =>
      p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Public actions                                                              */
/* -------------------------------------------------------------------------- */

export const actions = {
  setBusiness(businessId: string) {
    setState((prev) => ({ ...prev, session: { ...prev.session, businessId } }));
  },

  markNotificationRead(id: string) {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n,
      ),
    }));
  },

  markAllNotificationsRead(businessId?: string) {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) =>
        !businessId || n.businessId === businessId
          ? { ...n, readAt: n.readAt ?? new Date().toISOString() }
          : n,
      ),
    }));
  },

  /** Mark an inbound communication as handled (the "I've dealt with this" action). */
  handleCommunication(communicationId: string) {
    setState((prev) => {
      const comm = prev.communications.find((c) => c.id === communicationId);
      if (!comm) return prev;
      const next = {
        ...prev,
        communications: prev.communications.map((c) =>
          c.id === communicationId ? { ...c, handled: true } : c,
        ),
      };
      return withEventAndAudit(
        next,
        {
          eventType: "EMAIL_REPLIED",
          eventSummary: "Inbound message handled",
          eventDetail: `${comm.channel} from contact marked as handled.`,
          effects: [{ kind: "notification", label: "Attention item cleared" }],
          targetType: "communication",
          targetId: comm.id,
          targetLabel: comm.preview.slice(0, 80),
        },
        {
          businessId: comm.businessId,
          prospectId: comm.prospectId,
          contactId: comm.contactId,
          companyId: comm.companyId,
          channel: comm.channel,
        },
      );
    });
  },

  /**
   * Send a reply on any channel. This is the full loop: write the
   * communication, clear the inbound item, create the follow-up, log the
   * event and re-score.
   */
  sendMessage(input: {
    prospectId: string;
    channel: Communication["channel"];
    body: string;
    subject?: string;
    actorId?: string;
    actorKind?: "user" | "ai";
    inReplyTo?: string;
  }) {
    setState((prev) => {
      const prospect = prev.prospects.find((p) => p.id === input.prospectId);
      if (!prospect) return prev;
      const contact = prev.contacts.find((c) => c.id === prospect.contactId);
      const now = Date.now();
      const comm: Communication = {
        id: uid("com"),
        tenantId: prospect.tenantId,
        businessId: prospect.businessId,
        prospectId: prospect.id,
        contactId: prospect.contactId,
        companyId: prospect.companyId,
        channel: input.channel,
        direction: "outbound",
        status: input.channel === "call" ? "answered" : "sent",
        subject: input.subject,
        body: input.body,
        preview: input.body.slice(0, 140),
        occurredAt: new Date(now).toISOString(),
        actorId: input.actorId ?? prev.session.userId,
        actorKind: input.actorKind ?? "user",
        threadId: `th_${contact?.lastName.toLowerCase() ?? "thread"}`,
        handled: true,
        requiresResponse: false,
        tags: [],
      };

      let next: AppState = { ...prev, communications: [comm, ...prev.communications] };

      // Clearing the await-reply state on the thread
      next = {
        ...next,
        communications: next.communications.map((c) =>
          input.inReplyTo && c.id === input.inReplyTo
            ? { ...c, handled: true, respondedAt: comm.occurredAt }
            : c,
        ),
      };

      next = patchProspect(next, prospect.id, {
        lastActivityAt: comm.occurredAt,
        lastOutboundAt: comm.occurredAt,
        healthFlags: prospect.healthFlags.filter((f) => f !== "responded_today"),
      });

      return withEventAndAudit(
        next,
        {
          eventType:
            input.channel === "email"
              ? "EMAIL_SENT"
              : input.channel === "sms"
                ? "SMS_SENT"
                : input.channel === "whatsapp"
                  ? "WHATSAPP_SENT"
                  : "CALL_LOGGED",
          eventSummary: `${input.channel === "email" ? "Reply" : "Message"} sent to ${contact?.firstName ?? "contact"}`,
          eventDetail: input.body.slice(0, 160),
          effects: [{ kind: "task", label: "Awaiting response — follow-up scheduled" }],
          targetType: "prospect",
          targetId: prospect.id,
          targetLabel: contact ? `${contact.firstName} ${contact.lastName}` : prospect.id,
          auditAction: "send_message",
        },
        {
          businessId: prospect.businessId,
          prospectId: prospect.id,
          contactId: prospect.contactId,
          companyId: prospect.companyId,
          channel: input.channel,
        },
      );
    });
  },

  /** Log a call outcome (call back, voicemail, connected). */
  logCall(input: {
    prospectId: string;
    outcome: "connected" | "voicemail" | "no_answer" | "busy";
    notes: string;
    durationSeconds?: number;
  }) {
    setState((prev) => {
      const prospect = prev.prospects.find((p) => p.id === input.prospectId);
      if (!prospect) return prev;
      const now = new Date().toISOString();
      const comm: Communication = {
        id: uid("com"),
        tenantId: prospect.tenantId,
        businessId: prospect.businessId,
        prospectId: prospect.id,
        contactId: prospect.contactId,
        companyId: prospect.companyId,
        channel: "call",
        direction: "outbound",
        status: input.outcome === "connected" ? "answered" : input.outcome,
        body: input.notes,
        preview: input.notes.slice(0, 140),
        occurredAt: now,
        actorId: prev.session.userId,
        actorKind: "user",
        handled: true,
        requiresResponse: false,
        call: {
          durationSeconds: input.durationSeconds ?? 0,
          direction: "outbound",
          outcome: input.outcome,
          summary: input.notes,
        },
        tags: [],
      };

      let next: AppState = { ...prev, communications: [comm, ...prev.communications] };
      next = patchProspect(next, prospect.id, {
        lastActivityAt: now,
        lastOutboundAt: now,
        healthFlags: prospect.healthFlags.filter((f) => f !== "missed_call"),
      });

      return withEventAndAudit(
        next,
        {
          eventType: "CALL_COMPLETED",
          eventSummary: `Call logged — ${input.outcome.replace(/_/g, " ")}`,
          eventDetail: input.notes,
          effects: [
            {
              kind: "score",
              label: "Call activity signal updated",
              delta: input.outcome === "connected" ? 4 : 0,
            },
          ],
          targetType: "prospect",
          targetId: prospect.id,
          targetLabel: prospect.id,
          auditAction: "log_call",
        },
        {
          businessId: prospect.businessId,
          prospectId: prospect.id,
          contactId: prospect.contactId,
          companyId: prospect.companyId,
          channel: "call",
        },
      );
    });
  },

  createTask(input: {
    title: string;
    prospectId?: string;
    companyId?: string;
    type?: Task["type"];
    priority?: Priority;
    dueMinutes?: number;
    reason?: string;
    ownerId?: string;
    createdByKind?: Task["createdByKind"];
  }) {
    setState((prev) => {
      const businessId =
        prev.prospects.find((p) => p.id === input.prospectId)?.businessId ??
        prev.session.businessId;
      const now = Date.now();
      const task: Task = {
        id: uid("task"),
        tenantId: prev.session.tenantId,
        businessId,
        title: input.title,
        prospectId: input.prospectId,
        companyId: input.companyId,
        ownerId: input.ownerId ?? prev.session.userId,
        createdBy: prev.session.userId,
        createdByKind: input.createdByKind ?? "user",
        type: input.type ?? "follow_up",
        priority: input.priority ?? "medium",
        status: "open",
        dueAt: new Date(now + (input.dueMinutes ?? 240) * 60_000).toISOString(),
        reason: input.reason ?? "Created manually",
        slaBreached: false,
        createdAt: new Date(now).toISOString(),
      };
      return withEventAndAudit(
        { ...prev, tasks: [task, ...prev.tasks] },
        {
          eventType: "TASK_CREATED",
          eventSummary: `Task created: ${task.title}`,
          eventDetail: task.reason,
          targetType: "task",
          targetId: task.id,
          targetLabel: task.title,
          auditAction: "create_task",
        },
        { businessId, prospectId: input.prospectId, companyId: input.companyId },
      );
    });
  },

  completeTask(taskId: string, outcome?: string) {
    setState((prev) => {
      const task = prev.tasks.find((t) => t.id === taskId);
      if (!task) return prev;
      const next: AppState = {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId
            ? { ...t, status: "completed", completedAt: new Date().toISOString(), outcome }
            : t,
        ),
      };
      return withEventAndAudit(
        next,
        {
          eventType: "TASK_COMPLETED",
          eventSummary: `Task completed: ${task.title}`,
          eventDetail: outcome ?? "Marked complete by user.",
          effects: [{ kind: "insight", label: "Outcome recorded for learning" }],
          targetType: "task",
          targetId: task.id,
          targetLabel: task.title,
          previousState: { status: task.status },
          newState: { status: "completed" },
          auditAction: "complete_task",
        },
        { businessId: task.businessId, prospectId: task.prospectId, companyId: task.companyId },
      );
    });
  },

  snoozeTask(taskId: string, minutes = 1_440) {
    setState((prev) => {
      const task = prev.tasks.find((t) => t.id === taskId);
      if (!task) return prev;
      const dueAt = new Date(Date.now() + minutes * 60_000).toISOString();
      return withEventAndAudit(
        {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId ? { ...t, dueAt, status: "snoozed", slaBreached: false } : t,
          ),
        },
        {
          eventType: "TASK_SNOOZED",
          eventSummary: `Task snoozed: ${task.title}`,
          targetType: "task",
          targetId: task.id,
          targetLabel: task.title,
          newState: { dueAt, status: "snoozed" },
          auditAction: "snooze_task",
        },
        { businessId: task.businessId, prospectId: task.prospectId },
      );
    });
  },

  updateProspect(
    prospectId: string,
    patch: Partial<Prospect>,
    reason = "Manual override by user.",
  ) {
    setState((prev) => {
      const prospect = prev.prospects.find((p) => p.id === prospectId);
      if (!prospect) return prev;
      const previous: Record<string, unknown> = {};
      for (const key of Object.keys(patch))
        previous[key] = (prospect as unknown as Record<string, unknown>)[key];
      const next = patchProspect(prev, prospectId, patch);
      return withEventAndAudit(
        next,
        {
          eventType: patch.state ? "PIPELINE_STATE_CHANGED" : "LEAD_UPDATED",
          eventSummary: patch.state ? `Pipeline state set to ${patch.state}` : "Prospect updated",
          eventDetail: reason,
          effects: patch.state
            ? [{ kind: "state", label: `Manually set to ${patch.state}` }]
            : undefined,
          targetType: "prospect",
          targetId: prospectId,
          targetLabel: prospectId,
          previousState: previous,
          newState: patch as Record<string, unknown>,
          auditAction: "update_prospect",
        },
        {
          businessId: prospect.businessId,
          prospectId,
          contactId: prospect.contactId,
          companyId: prospect.companyId,
        },
      );
    });
  },

  addNote(prospectId: string, text: string) {
    setState((prev) => {
      const prospect = prev.prospects.find((p) => p.id === prospectId);
      if (!prospect) return prev;
      return withEventAndAudit(
        prev,
        {
          eventType: "NOTE_ADDED",
          eventSummary: "Note added to prospect",
          eventDetail: text.slice(0, 180),
          targetType: "prospect",
          targetId: prospectId,
          targetLabel: prospectId,
          newState: { note: text },
          auditAction: "add_note",
        },
        {
          businessId: prospect.businessId,
          prospectId,
          contactId: prospect.contactId,
          companyId: prospect.companyId,
        },
      );
    });
  },

  sendIntakeReminder(submissionId: string) {
    setState((prev) => {
      const sub = prev.submissions.find((s) => s.id === submissionId);
      if (!sub) return prev;
      const now = new Date().toISOString();
      const contact = prev.contacts.find((c) => c.id === sub.contactId);
      const comm: Communication = {
        id: uid("com"),
        tenantId: sub.tenantId,
        businessId: sub.businessId,
        prospectId: sub.prospectId ?? "unlinked",
        contactId: sub.contactId ?? "unlinked",
        companyId: sub.companyId,
        channel: "email",
        direction: "outbound",
        status: "sent",
        subject: "Finish your intake — takes 2 minutes",
        body: `Reminder sent for ${sub.missingFields.length} missing section(s).`,
        preview: "Intake reminder sent",
        occurredAt: now,
        actorId: prev.session.userId,
        actorKind: "user",
        handled: true,
        requiresResponse: false,
        tags: ["intake_reminder"],
      };
      const next: AppState = {
        ...prev,
        submissions: prev.submissions.map((s) =>
          s.id === submissionId ? { ...s, reminderSentAt: now } : s,
        ),
        communications: [comm, ...prev.communications],
      };
      return withEventAndAudit(
        next,
        {
          eventType: "FORM_REMINDER_SENT",
          eventSummary: "Intake reminder sent",
          eventDetail: `${contact?.firstName ?? "Contact"} — ${sub.completion}% complete, missing ${sub.missingFields.join(", ")}.`,
          effects: [{ kind: "task", label: "Awaiting completion" }],
          targetType: "form_submission",
          targetId: sub.id,
          targetLabel: `${sub.completion}% complete`,
          auditAction: "send_intake_reminder",
        },
        {
          businessId: sub.businessId,
          prospectId: sub.prospectId,
          contactId: sub.contactId,
          companyId: sub.companyId,
          channel: "email",
        },
      );
    });
  },

  /* ------------------------------- AI actions ------------------------------ */

  approveAction(actionId: string) {
    setState((prev) => {
      const action = prev.actions.find((a) => a.id === actionId);
      if (!action) return prev;
      return withEventAndAudit(
        {
          ...prev,
          actions: prev.actions.map((a) =>
            a.id === actionId ? { ...a, status: "approved", approvedBy: prev.session.userId } : a,
          ),
        },
        {
          eventType: "AI_ACTION_APPROVED",
          eventSummary: `Approved: ${action.title}`,
          eventDetail: action.expectedOutcome,
          targetType: "ai_action",
          targetId: action.id,
          targetLabel: action.title,
          previousState: { status: action.status },
          newState: { status: "approved" },
          reason: "Human approval granted.",
          auditAction: "approve_ai_action",
        },
        {
          businessId: action.businessId,
          prospectId: action.prospectId,
          contactId: action.contactId,
          companyId: action.companyId,
        },
      );
    });
  },

  executeAction(actionId: string) {
    setState((prev) => {
      const action = prev.actions.find((a) => a.id === actionId);
      if (!action) return prev;
      const executedAt = new Date().toISOString();
      const result = describeExecution(action);
      let next: AppState = {
        ...prev,
        actions: prev.actions.map((a) =>
          a.id === actionId
            ? {
                ...a,
                status: "executed",
                executedAt,
                result,
                approvedBy: a.approvedBy ?? prev.session.userId,
              }
            : a,
        ),
      };
      if (action.prospectId) {
        next = patchProspect(next, action.prospectId, {
          lastActivityAt: executedAt,
          lastOutboundAt: executedAt,
        });
      }
      if (action.type === "create_task" && action.prospectId) {
        const task: Task = {
          id: uid("task"),
          tenantId: action.tenantId,
          businessId: action.businessId,
          title: action.title,
          prospectId: action.prospectId,
          companyId: action.companyId,
          ownerId: prev.session.userId,
          createdBy: action.agentId,
          createdByKind: "ai",
          type: "follow_up",
          priority: "high",
          status: "open",
          dueAt: new Date(Date.now() + 3_600_000).toISOString(),
          reason: action.rationale,
          slaBreached: false,
          createdAt: executedAt,
        };
        next = { ...next, tasks: [task, ...next.tasks] };
      }
      return withEventAndAudit(
        next,
        {
          eventType: "AI_ACTION_EXECUTED",
          eventSummary: `AI executed: ${action.title}`,
          eventDetail: result,
          effects: [
            {
              kind: "action",
              label: `${action.autonomyUsed === "autonomous" ? "Autonomous" : "Approved"} execution · confidence ${(action.confidence * 100).toFixed(0)}%`,
            },
          ],
          targetType: "ai_action",
          targetId: action.id,
          targetLabel: action.title,
          previousState: { status: action.status },
          newState: { status: "executed" },
          reason: action.rationale,
          auditAction: action.type,
          actorId: action.agentId,
          actorKind: "ai",
        },
        {
          businessId: action.businessId,
          prospectId: action.prospectId,
          contactId: action.contactId,
          companyId: action.companyId,
        },
      );
    });
  },

  rejectAction(actionId: string, reason = "Rejected by user after review.") {
    setState((prev) => {
      const action = prev.actions.find((a) => a.id === actionId);
      if (!action) return prev;
      return withEventAndAudit(
        {
          ...prev,
          actions: prev.actions.map((a) =>
            a.id === actionId
              ? { ...a, status: "rejected", approvedBy: prev.session.userId, result: reason }
              : a,
          ),
        },
        {
          eventType: "AI_ACTION_REJECTED",
          eventSummary: `Rejected: ${action.title}`,
          eventDetail: reason,
          effects: [{ kind: "insight", label: "Preference recorded — the agent will adapt" }],
          targetType: "ai_action",
          targetId: action.id,
          targetLabel: action.title,
          previousState: { status: action.status },
          newState: { status: "rejected" },
          reason,
          auditAction: "reject_ai_action",
        },
        {
          businessId: action.businessId,
          prospectId: action.prospectId,
          companyId: action.companyId,
        },
      );
    });
  },

  dismissAction(actionId: string) {
    setState((prev) => ({
      ...prev,
      actions: prev.actions.map((a) => (a.id === actionId ? { ...a, status: "dismissed" } : a)),
    }));
  },

  revertAction(actionId: string) {
    setState((prev) => {
      const action = prev.actions.find((a) => a.id === actionId);
      if (!action) return prev;
      const revertedAt = new Date().toISOString();
      let next: AppState = {
        ...prev,
        actions: prev.actions.map((a) =>
          a.id === actionId
            ? { ...a, status: "reverted", revertedAt, revertedBy: prev.session.userId }
            : a,
        ),
      };
      if (action.undo && action.undo.entity === "prospect") {
        next = patchProspect(next, action.undo.id, action.undo.patch as Partial<Prospect>);
      }
      if (action.undo && action.undo.entity === "task") {
        next = {
          ...next,
          tasks: next.tasks.map((t) =>
            t.id === action.undo!.id ? { ...t, status: "cancelled" } : t,
          ),
        };
      }
      return withEventAndAudit(
        next,
        {
          eventType: "AI_ACTION_REVERTED",
          eventSummary: `Undone: ${action.title}`,
          eventDetail: "Autonomous action reversed and previous state restored.",
          targetType: "ai_action",
          targetId: action.id,
          targetLabel: action.title,
          previousState: { status: action.status },
          newState: { status: "reverted" },
          reason: "User reverted the AI action from the decision log.",
          auditAction: "revert_ai_action",
        },
        {
          businessId: action.businessId,
          prospectId: action.prospectId,
          companyId: action.companyId,
        },
      );
    });
  },

  proposeAction(input: {
    type: AIAction["type"];
    title: string;
    rationale: string;
    expectedOutcome: string;
    confidence: number;
    prospectId?: string;
    companyId?: string;
    draft?: string;
    status?: AIAction["status"];
    agentId?: string;
    autonomyUsed?: AIAction["autonomyUsed"];
  }) {
    setState((prev) => {
      const businessId =
        prev.prospects.find((p) => p.id === input.prospectId)?.businessId ??
        prev.session.businessId;
      const action: AIAction = {
        id: uid("act"),
        tenantId: prev.session.tenantId,
        businessId,
        type: input.type,
        status: input.status ?? "awaiting_approval",
        prospectId: input.prospectId,
        companyId: input.companyId,
        agentId: input.agentId ?? "agent_ava",
        title: input.title,
        rationale: input.rationale,
        expectedOutcome: input.expectedOutcome,
        confidence: input.confidence,
        autonomyUsed: input.autonomyUsed ?? "approve",
        payload: {},
        draft: input.draft,
        createdAt: new Date().toISOString(),
        revertible: true,
      };
      return withEventAndAudit(
        { ...prev, actions: [action, ...prev.actions] },
        {
          eventType: "AI_ACTION_PROPOSED",
          eventSummary: `AI proposed: ${action.title}`,
          eventDetail: action.rationale,
          targetType: "ai_action",
          targetId: action.id,
          targetLabel: action.title,
          actorId: action.agentId,
          actorKind: "ai",
          auditAction: "propose_action",
        },
        { businessId, prospectId: input.prospectId, companyId: input.companyId },
      );
    });
  },

  setAutonomy(
    businessId: string,
    mode: AppState["businesses"][number]["settings"]["defaultAutonomy"],
  ) {
    setState((prev) => {
      const business = prev.businesses.find((b) => b.id === businessId);
      if (!business) return prev;
      return withEventAndAudit(
        {
          ...prev,
          businesses: prev.businesses.map((b) =>
            b.id === businessId ? { ...b, settings: { ...b.settings, defaultAutonomy: mode } } : b,
          ),
        },
        {
          eventType: mode === "assist" ? "AI_PAUSED" : "AI_RESUMED",
          eventSummary: `AI autonomy set to ${mode}`,
          eventDetail: `Business default changed from ${business.settings.defaultAutonomy} to ${mode}.`,
          targetType: "business",
          targetId: businessId,
          targetLabel: business.name,
          previousState: { autonomy: business.settings.defaultAutonomy },
          newState: { autonomy: mode },
          reason: "Autonomy configuration changed in Settings.",
          auditAction: "configure_ai",
        },
        { businessId },
      );
    });
  },

  setAgentStatus(agentId: string, status: "active" | "paused" | "training") {
    setState((prev) => {
      const agent = prev.agents.find((a) => a.id === agentId);
      if (!agent) return prev;
      return withEventAndAudit(
        { ...prev, agents: prev.agents.map((a) => (a.id === agentId ? { ...a, status } : a)) },
        {
          eventType: status === "paused" ? "AI_PAUSED" : "AI_RESUMED",
          eventSummary: `${agent.name} ${status === "paused" ? "paused" : "resumed"}`,
          eventDetail: `Agent status changed from ${agent.status} to ${status}.`,
          targetType: "agent",
          targetId: agentId,
          targetLabel: agent.name,
          previousState: { status: agent.status },
          newState: { status },
          reason: "Agent supervised by a human.",
          auditAction: "configure_ai",
          actorKind: "user",
        },
        { businessId: agent.businessId },
      );
    });
  },

  toggleAiPause(businessId: string) {
    setState((prev) => {
      const paused = prev.aiPausedBusinessIds.includes(businessId);
      return withEventAndAudit(
        {
          ...prev,
          aiPausedBusinessIds: paused
            ? prev.aiPausedBusinessIds.filter((id) => id !== businessId)
            : [...prev.aiPausedBusinessIds, businessId],
        },
        {
          eventType: paused ? "AI_RESUMED" : "AI_PAUSED",
          eventSummary: paused ? "AI resumed" : "AI paused",
          eventDetail: paused
            ? "Autonomous execution re-enabled for this business."
            : "All autonomous execution suspended. AI still recommends; nothing executes.",
          targetType: "business",
          targetId: businessId,
          targetLabel: businessId,
          reason: "Kill switch used from the AI Activity screen.",
          auditAction: "toggle_ai",
        },
        { businessId },
      );
    });
  },

  /** Invite a teammate into a business with a role (V1: creates the pending membership). */
  inviteMember(input: {
    name: string;
    email: string;
    roleKey: RoleKey;
    businessId: string;
    teamId?: string;
  }) {
    setState((prev) => {
      const now = new Date().toISOString();
      const palette = [
        "#6366f1",
        "#0ea5e9",
        "#14b8a6",
        "#f59e0b",
        "#ec4899",
        "#8b5cf6",
        "#ef4444",
        "#22c55e",
      ];
      const user: User = {
        id: uid("u_invite"),
        tenantId: prev.session.tenantId,
        name: input.name,
        email: input.email,
        avatarColor: palette[prev.users.length % palette.length],
        title: ROLES[input.roleKey]?.name ?? "Teammate",
        isAi: false,
        lastActiveAt: now,
        createdAt: now,
      };
      const membership: Membership = {
        id: uid("mem"),
        tenantId: prev.session.tenantId,
        businessId: input.businessId,
        userId: user.id,
        roleKey: input.roleKey,
        permissionOverrides: {},
        teamId: input.teamId,
        status: "invited",
        invitedAt: now,
      };
      return withEventAndAudit(
        {
          ...prev,
          users: [...prev.users, user],
          memberships: [...prev.memberships, membership],
          teams: input.teamId
            ? prev.teams.map((t) =>
                t.id === input.teamId ? { ...t, memberIds: [...t.memberIds, user.id] } : t,
              )
            : prev.teams,
        },
        {
          eventType: "PERMISSION_CHANGED",
          eventSummary: `Invited ${input.name} as ${membership.roleKey}`,
          eventDetail: `Invitation sent to ${input.email}. Role grants are effective immediately on acceptance.`,
          targetType: "membership",
          targetId: membership.id,
          targetLabel: input.name,
          newState: { role: input.roleKey, status: "invited" },
          reason: "Team member invited from the Team screen.",
          auditAction: "invite_user",
        },
        { businessId: input.businessId },
      );
    });
  },

  /** Change a member's role; granular overrides are kept. */
  updateMemberRole(membershipId: string, roleKey: RoleKey) {
    setState((prev) => {
      const membership = prev.memberships.find((m) => m.id === membershipId);
      if (!membership) return prev;
      const user = prev.users.find((u) => u.id === membership.userId);
      return withEventAndAudit(
        {
          ...prev,
          memberships: prev.memberships.map((m) => (m.id === membershipId ? { ...m, roleKey } : m)),
        },
        {
          eventType: "PERMISSION_CHANGED",
          eventSummary: `${user?.name ?? "Member"} is now ${ROLES[roleKey]?.name ?? roleKey}`,
          eventDetail: `Role changed from ${membership.roleKey} to ${roleKey}. Effective permissions recomputed for the service layer too.`,
          targetType: "membership",
          targetId: membershipId,
          targetLabel: user?.name ?? membershipId,
          previousState: { role: membership.roleKey },
          newState: { role: roleKey },
          reason: "Role changed in the Team screen.",
          auditAction: "change_role",
        },
        { businessId: membership.businessId },
      );
    });
  },

  /** Flip a single granular permission override on top of the role. */
  togglePermission(membershipId: string, key: PermissionKey) {
    setState((prev) => {
      const membership = prev.memberships.find((m) => m.id === membershipId);
      if (!membership) return prev;
      const user = prev.users.find((u) => u.id === membership.userId);
      const currentlyGranted = effectivePermissions(membership).has(key);
      const next: Membership = {
        ...membership,
        permissionOverrides: { ...membership.permissionOverrides, [key]: !currentlyGranted },
      };
      return withEventAndAudit(
        { ...prev, memberships: prev.memberships.map((m) => (m.id === membershipId ? next : m)) },
        {
          eventType: "PERMISSION_CHANGED",
          eventSummary: `${key} ${currentlyGranted ? "revoked from" : "granted to"} ${user?.name ?? "member"}`,
          eventDetail: `Override recorded on top of the ${membership.roleKey} role. UI and service-layer checks read the same computation.`,
          targetType: "membership",
          targetId: membershipId,
          targetLabel: user?.name ?? membershipId,
          previousState: { [key]: currentlyGranted },
          newState: { [key]: !currentlyGranted },
          reason: "Granular permission override changed.",
          auditAction: "override_permission",
        },
        { businessId: membership.businessId },
      );
    });
  },

  toggleAutomation(automationId: string) {
    setState((prev) => {
      const automation = prev.automations.find((a) => a.id === automationId);
      if (!automation) return prev;
      const status = automation.status === "active" ? "paused" : "active";
      return withEventAndAudit(
        {
          ...prev,
          automations: prev.automations.map((a) => (a.id === automationId ? { ...a, status } : a)),
        },
        {
          eventType: status === "active" ? "AUTOMATION_COMPLETED" : "AUTOMATION_FAILED",
          eventSummary: `${automation.name} ${status === "active" ? "activated" : "paused"}`,
          eventDetail: `Trigger ${automation.trigger} · ${automation.actions.length} actions.`,
          targetType: "automation",
          targetId: automation.id,
          targetLabel: automation.name,
          previousState: { status: automation.status },
          newState: { status },
          reason: "Automation toggled by user.",
          auditAction: "toggle_automation",
        },
        { businessId: automation.businessId },
      );
    });
  },

  /** Store an automation suggested by the AI (one-click accept from the AI screen). */
  acceptAutomationSuggestion(
    automation: Omit<AppState["automations"][number], "id" | "createdAt">,
  ) {
    setState((prev) => {
      const created = { ...automation, id: uid("auto"), createdAt: new Date().toISOString() };
      return withEventAndAudit(
        { ...prev, automations: [created, ...prev.automations] },
        {
          eventType: "AUTOMATION_COMPLETED",
          eventSummary: `Automation created: ${created.name}`,
          eventDetail: created.description,
          targetType: "automation",
          targetId: created.id,
          targetLabel: created.name,
          reason: "Accepted an AI-suggested automation.",
          auditAction: "create_automation",
        },
        { businessId: created.businessId },
      );
    });
  },

  connectIntegration(integrationId: string) {
    setState((prev) => {
      const integration = prev.integrations.find((i) => i.id === integrationId);
      if (!integration) return prev;
      const now = new Date().toISOString();
      return withEventAndAudit(
        {
          ...prev,
          integrations: prev.integrations.map((i) =>
            i.id === integrationId
              ? {
                  ...i,
                  status: "connected",
                  connectedAt: now,
                  lastSyncAt: now,
                  lastError: undefined,
                  connectedBy: prev.session.userId,
                }
              : i,
          ),
        },
        {
          eventType: "INTEGRATION_CONNECTED",
          eventSummary: `${integration.name} connected`,
          eventDetail: `${integration.capabilities.length} capabilities enabled.`,
          targetType: "integration",
          targetId: integration.id,
          targetLabel: integration.name,
          previousState: { status: integration.status },
          newState: { status: "connected" },
          reason: "Integration authorised from Integrations settings.",
          auditAction: "connect_integration",
        },
        { businessId: integration.businessId },
      );
    });
  },

  disconnectIntegration(integrationId: string) {
    setState((prev) => {
      const integration = prev.integrations.find((i) => i.id === integrationId);
      if (!integration) return prev;
      return withEventAndAudit(
        {
          ...prev,
          integrations: prev.integrations.map((i) =>
            i.id === integrationId
              ? { ...i, status: "disconnected", connectedAt: undefined, connectedBy: undefined }
              : i,
          ),
        },
        {
          eventType: "INTEGRATION_ERROR",
          eventSummary: `${integration.name} disconnected`,
          eventDetail: "Adapter detached; no further events will be ingested from this provider.",
          targetType: "integration",
          targetId: integration.id,
          targetLabel: integration.name,
          auditAction: "disconnect_integration",
        },
        { businessId: integration.businessId },
      );
    });
  },

  dismissInsight(insightId: string) {
    setState((prev) => ({
      ...prev,
      insights: prev.insights.map((i) => (i.id === insightId ? { ...i, dismissed: true } : i)),
    }));
  },

  pinInsight(insightId: string) {
    setState((prev) => ({
      ...prev,
      insights: prev.insights.map((i) => (i.id === insightId ? { ...i, pinned: !i.pinned } : i)),
    }));
  },

  /**
   * Inject a live event through the real pipeline. Used by the "simulate
   * incoming activity" control so the event-driven loop is demonstrable
   * before integrations are connected.
   */
  simulateEvent(input: {
    type: EventType;
    prospectId: string;
    channel?: Communication["channel"];
    summary: string;
    detail?: string;
    body?: string;
    intent?: NonNullable<Communication["enrichment"]>["intent"];
  }) {
    setState((prev) => {
      const prospect = prev.prospects.find((p) => p.id === input.prospectId);
      if (!prospect) return prev;
      const contact = prev.contacts.find((c) => c.id === prospect.contactId);
      const now = new Date().toISOString();
      const channel = input.channel ?? "email";
      const comm: Communication = {
        id: uid("com"),
        tenantId: prospect.tenantId,
        businessId: prospect.businessId,
        prospectId: prospect.id,
        contactId: prospect.contactId,
        companyId: prospect.companyId,
        channel,
        direction: "inbound",
        status: channel === "call" ? "missed" : "received",
        subject: channel === "email" ? "Inbound message" : undefined,
        body: input.body ?? input.summary,
        preview: (input.body ?? input.summary).slice(0, 140),
        occurredAt: now,
        actorId: contact?.id ?? prospect.id,
        actorKind: "contact",
        handled: false,
        requiresResponse: true,
        enrichment: input.intent
          ? {
              intent: input.intent,
              intentConfidence: 0.88,
              sentiment:
                input.intent === "high_intent"
                  ? "positive"
                  : input.intent === "objection"
                    ? "mixed"
                    : "neutral",
              urgency: input.intent === "high_intent" ? "critical" : "high",
              topics: [input.intent.replace(/_/g, " ")],
              requiredAction: "reply",
              summary: input.summary,
              entities: [],
              model: "lead-intel/classifier-1",
              enrichedAt: now,
            }
          : undefined,
        call:
          channel === "call"
            ? { durationSeconds: 0, direction: "inbound", outcome: "missed" }
            : undefined,
        tags: ["simulated"],
      };

      let next: AppState = { ...prev, communications: [comm, ...prev.communications] };
      next = patchProspect(next, prospect.id, {
        lastActivityAt: now,
        lastInboundAt: now,
        healthFlags: Array.from(
          new Set([
            ...prospect.healthFlags,
            channel === "call" ? "missed_call" : "responded_today",
          ]),
        ),
      });

      // Run the automation/evaluation pass: create the follow-up action the
      // pipeline would create, and mark the event as processed by each stage.
      const effects = [
        {
          kind: "intent" as const,
          label: input.intent ? `Classified as ${input.intent.replace(/_/g, " ")}` : "Classified",
          detail: "88% confidence",
        },
        { kind: "score" as const, label: "Lead score increased", delta: 12 },
        { kind: "priority" as const, label: "Priority re-evaluated" },
        { kind: "task" as const, label: "Follow-up task created" },
        { kind: "notification" as const, label: "Owner notified" },
      ];

      const task: Task = {
        id: uid("task"),
        tenantId: prospect.tenantId,
        businessId: prospect.businessId,
        title: `${channel === "call" ? "Return call from" : "Reply to"} ${contact?.firstName ?? "prospect"}`,
        prospectId: prospect.id,
        contactId: prospect.contactId,
        companyId: prospect.companyId,
        ownerId: prospect.ownerId,
        createdBy: "agent_ava",
        createdByKind: "ai",
        type: channel === "call" ? "call" : "reply",
        priority: input.intent === "high_intent" ? "critical" : "high",
        status: "open",
        dueAt: new Date(Date.now() + 60 * 60_000).toISOString(),
        reason: "Automation: inbound activity requires a response within SLA.",
        slaBreached: false,
        createdAt: now,
      };
      next = { ...next, tasks: [task, ...next.tasks] };

      const notification: Notification = {
        id: uid("ntf"),
        tenantId: prospect.tenantId,
        businessId: prospect.businessId,
        kind: channel === "call" ? "missed_call" : "new_response",
        title: `${contact?.firstName ?? "Prospect"} — ${input.summary}`,
        body: input.detail ?? input.summary,
        prospectId: prospect.id,
        priority: input.intent === "high_intent" ? "critical" : "high",
        createdAt: now,
        actionLabel: channel === "call" ? "Call back" : "Reply",
        actionHref: `/prospects/${prospect.id}`,
        actorKind: "system",
      };
      next = { ...next, notifications: [notification, ...next.notifications] };

      return withEventAndAudit(
        next,
        {
          eventType: input.type,
          eventSummary: input.summary,
          eventDetail: input.detail ?? input.body,
          effects,
          targetType: "prospect",
          targetId: prospect.id,
          targetLabel: contact ? `${contact.firstName} ${contact.lastName}` : prospect.id,
          reason: "Simulated inbound event injected through the event pipeline.",
          auditAction: "simulate_event",
          actorId: "system",
          actorKind: "system",
        },
        {
          businessId: prospect.businessId,
          prospectId: prospect.id,
          contactId: prospect.contactId,
          companyId: prospect.companyId,
          channel,
        },
      );
    });
  },

  /** Force a full intelligence recompute (the "Run intelligence" action). */
  recomputeIntelligence() {
    setState((prev) => {
      const next = rehydrate(prev, Date.now());
      return withEventAndAudit(
        next,
        {
          eventType: "AI_INSIGHT_CREATED",
          eventSummary: "Intelligence sweep completed",
          eventDetail: `${next.prospects.length} prospects re-scored, priorities and recommended actions refreshed.`,
          effects: [{ kind: "score", label: "All lead scores recomputed" }],
          targetType: "business",
          targetId: prev.session.businessId,
          targetLabel: "Business intelligence",
          actorId: "agent_ava",
          actorKind: "ai",
          reason: "Manual intelligence sweep.",
          auditAction: "recompute_intelligence",
        },
        { businessId: prev.session.businessId },
      );
    });
  },
};

function describeExecution(action: AIAction): string {
  switch (action.type) {
    case "send_email":
      return `Email sent via Gmail adapter to the prospect thread. Confidence ${(action.confidence * 100).toFixed(0)}%.`;
    case "send_sms":
      return "SMS dispatched through Twilio and delivery confirmed.";
    case "send_whatsapp":
      return "WhatsApp message delivered to the business thread.";
    case "place_call":
      return "Call queued for the assigned owner with a 1-hour SLA.";
    case "create_task":
      return "Follow-up task created and assigned.";
    case "schedule_follow_up":
      return "Follow-up scheduled on the owner's calendar.";
    case "update_pipeline_state":
      return `Pipeline state updated to ${String(action.payload["to"] ?? "the inferred state")}.`;
    case "update_priority":
      return `Priority set to ${String(action.payload["to"] ?? "high")}.`;
    case "send_intake_reminder":
      return "Intake reminder sent with a resume link.";
    case "draft_proposal":
      return "Commercial terms drafted and attached to the deal.";
    case "assign_owner":
      return "Prospect reassigned and notified.";
    case "research_prospect":
      return "Research brief generated and attached to the profile.";
    case "escalate":
      return "Escalation raised to the business manager.";
    case "notify_manager":
      return "Manager notified through in-app and Slack.";
    default:
      return "Action executed.";
  }
}

/* -------------------------------------------------------------------------- */
/* Selectors used by the UI                                                    */
/* -------------------------------------------------------------------------- */

export function currentBusinessId(s: AppState = state): string {
  return s.session.businessId;
}

export function businessScoped<T extends { businessId: string }>(
  items: T[],
  businessId: string,
): T[] {
  return items.filter((i) => i.businessId === businessId);
}

export type { AIInsight, Prospect };
