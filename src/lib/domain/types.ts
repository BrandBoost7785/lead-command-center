/**
 * Lead Intelligence — Domain model
 * ---------------------------------------------------------------------------
 * Every entity that carries business data is scoped by `tenantId` and (where
 * relevant) `businessId`. Nothing in the UI may read across those boundaries;
 * the service layer enforces it before the UI ever sees data.
 *
 * The model is intentionally shaped for growth: scoring, intent, autonomy and
 * integrations are all pluggable/extensible rather than hardcoded strings.
 */

export type ID = string;
export type ISODate = string;

/* -------------------------------------------------------------------------- */
/* Tenancy                                                                     */
/* -------------------------------------------------------------------------- */

export interface Tenant {
  id: ID;
  name: string;
  slug: string;
  plan: "starter" | "growth" | "scale" | "enterprise";
  createdAt: ISODate;
  billing: {
    seats: number;
    seatsUsed: number;
    renewalDate: ISODate;
    status: "trialing" | "active" | "past_due";
  };
}

export interface Business {
  id: ID;
  tenantId: ID;
  name: string;
  legalName?: string;
  industry: string;
  timezone: string;
  currency: string;
  website?: string;
  phone?: string;
  address?: string;
  brandColor?: string;
  createdAt: ISODate;
  settings: BusinessSettings;
}

export interface BusinessSettings {
  /** Business-scoped AI operating mode, overridable per agent/user/action. */
  defaultAutonomy: AutonomyMode;
  /** Hours of the day the AI may execute autonomous actions. */
  quietHours: { start: string; end: string };
  scoringWeights: ScoringWeights;
  followUpSlaHours: number;
  notifications: NotificationPreference[];
  intakeReminderHours: number;
  workingHours: { start: string; end: string; days: number[] };
}

export interface NotificationPreference {
  key: NotificationKind;
  inApp: boolean;
  email: boolean;
  push: boolean;
}

/* -------------------------------------------------------------------------- */
/* Identity, roles & permissions                                               */
/* -------------------------------------------------------------------------- */

export type RoleKey =
  "owner" | "admin" | "manager" | "salesperson" | "assistant" | "ai_agent" | "client" | "analyst";

export interface Role {
  key: RoleKey;
  name: string;
  description: string;
  system: boolean;
  permissions: PermissionKey[];
}

export type PermissionKey =
  | "leads.view"
  | "leads.edit"
  | "leads.delete"
  | "data.export"
  | "comms.view"
  | "comms.send"
  | "calls.view"
  | "calls.transcripts"
  | "forms.manage"
  | "pipeline.manage"
  | "automations.manage"
  | "ai.run"
  | "ai.approve"
  | "ai.configure"
  | "ai.viewDecisions"
  | "integrations.manage"
  | "reports.view"
  | "users.manage"
  | "businesses.manage"
  | "billing.manage";

export interface User {
  id: ID;
  tenantId: ID;
  name: string;
  email: string;
  avatarColor: string;
  title: string;
  isAi: boolean;
  lastActiveAt: ISODate;
  createdAt: ISODate;
}

export interface Membership {
  id: ID;
  tenantId: ID;
  businessId: ID;
  userId: ID;
  roleKey: RoleKey;
  /** Granular overrides on top of the role. `null` = inherit role. */
  permissionOverrides: Partial<Record<PermissionKey, boolean>>;
  teamId?: ID;
  status: "active" | "invited" | "suspended";
  invitedAt?: ISODate;
}

export interface Team {
  id: ID;
  tenantId: ID;
  businessId: ID;
  name: string;
  description: string;
  color: string;
  memberIds: ID[];
  managerId?: ID;
}

export interface AIAgent {
  id: ID;
  tenantId: ID;
  businessId: ID;
  name: string;
  purpose: string;
  status: "active" | "paused" | "training";
  autonomy: AutonomyMode;
  /** Action types this agent may execute without human approval. */
  autonomousActions: AIActionType[];
  /** Scopes the agent may touch (channels/objects). */
  scopes: string[];
  confidenceFloor: number;
  model: string;
  escalationUserId?: ID;
}

/* -------------------------------------------------------------------------- */
/* CRM core                                                                    */
/* -------------------------------------------------------------------------- */

export interface Company {
  id: ID;
  tenantId: ID;
  businessId: ID;
  name: string;
  domain?: string;
  industry: string;
  size: string;
  location: string;
  phone?: string;
  website?: string;
  annualRevenue?: number;
  ownerId: ID;
  tier: "strategic" | "mid_market" | "smb";
  healthScore: number;
  createdAt: ISODate;
  notes?: string;
  tags: string[];
}

export type LeadSource =
  | "website_form"
  | "google_ads"
  | "referral"
  | "inbound_call"
  | "email_campaign"
  | "linkedin"
  | "partner"
  | "walk_in"
  | "csv_import"
  | "manual"
  | "webchat"
  | "sms"
  | "whatsapp"
  | "event";

export type PipelineStateKey =
  | "new"
  | "contacted"
  | "engaged"
  | "qualified"
  | "appointment"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost"
  | "customer";

export interface Prospect {
  id: ID;
  tenantId: ID;
  businessId: ID;
  /** Prospect is the working lead record attached to a contact. */
  contactId: ID;
  companyId?: ID;
  ownerId: ID;
  source: LeadSource;
  state: PipelineStateKey;
  /** True when the pipeline state was set by the intelligence engine. */
  stateInferred: boolean;
  score: number;
  scoreDelta: number;
  intent: Intent;
  intentConfidence: number;
  engagement: number;
  priority: Priority;
  value: number;
  /** When the AI/automation engine expects the next touch. */
  nextActionAt?: ISODate;
  nextActionType?: NextActionType;
  lastActivityAt: ISODate;
  lastInboundAt?: ISODate;
  lastOutboundAt?: ISODate;
  firstResponseMinutes?: number;
  daysSinceContact: number;
  tags: string[];
  createdAt: ISODate;
  updatedAt: ISODate;
  healthFlags: string[];
  /** AI's own narrative of why this prospect matters right now. */
  summary?: string;
  researchNotes?: string;
  doNotContact?: boolean;
}

export interface Contact {
  id: ID;
  tenantId: ID;
  businessId: ID;
  companyId?: ID;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  linkedin?: string;
  jobTitle?: string;
  location?: string;
  timezone?: string;
  avatarColor: string;
  createdAt: ISODate;
  lastSeenAt: ISODate;
  preferredChannel?: Channel;
  tags: string[];
  notes?: string;
}

/* -------------------------------------------------------------------------- */
/* Communication                                                               */
/* -------------------------------------------------------------------------- */

export type Channel =
  "email" | "call" | "sms" | "whatsapp" | "form" | "webchat" | "linkedin" | "meeting";

export type CommunicationDirection = "inbound" | "outbound";

export type CommunicationStatus =
  | "received"
  | "sent"
  | "delivered"
  | "read"
  | "opened"
  | "clicked"
  | "missed"
  | "answered"
  | "voicemail"
  | "no_answer"
  | "drafted"
  | "awaiting_approval"
  | "bounced"
  | "busy";

export type Intent =
  | "high_intent"
  | "interested"
  | "scheduling"
  | "pricing"
  | "question"
  | "objection"
  | "not_interested"
  | "unsubscribe"
  | "neutral"
  | "spam"
  | "unknown";

export type Sentiment = "positive" | "neutral" | "negative" | "mixed";

export type Priority = "critical" | "high" | "medium" | "low";

export interface Communication {
  id: ID;
  tenantId: ID;
  businessId: ID;
  prospectId: ID;
  contactId: ID;
  companyId?: ID;
  channel: Channel;
  direction: CommunicationDirection;
  status: CommunicationStatus;
  subject?: string;
  body: string;
  preview: string;
  occurredAt: ISODate;
  /** Who sent/received: a user id, an agent id, or the contact. */
  actorId: ID;
  actorKind: "user" | "ai" | "contact" | "system";
  threadId?: string;
  /** AI enrichment attached at ingest time. */
  enrichment?: CommunicationEnrichment;
  handled: boolean;
  requiresResponse: boolean;
  respondedAt?: ISODate;
  responseTimeMinutes?: number;
  /** Channel-specific payloads. */
  call?: CallDetail;
  attachments?: Attachment[];
  tags: string[];
}

export interface CallDetail {
  durationSeconds: number;
  direction: CommunicationDirection;
  outcome: "connected" | "missed" | "voicemail" | "no_answer" | "busy";
  recordingUrl?: string;
  transcript?: TranscriptSegment[];
  summary?: string;
  objections?: string[];
  nextSteps?: string[];
}

export interface TranscriptSegment {
  at: number;
  speaker: "contact" | "agent" | "system";
  text: string;
}

export interface Attachment {
  id: ID;
  name: string;
  kind: "pdf" | "doc" | "image" | "sheet" | "link";
  sizeKb: number;
  url?: string;
}

export interface CommunicationEnrichment {
  intent: Intent;
  intentConfidence: number;
  sentiment: Sentiment;
  urgency: Priority;
  topics: string[];
  requiredAction?: NextActionType;
  summary: string;
  entities: { type: string; value: string }[];
  model: string;
  enrichedAt: ISODate;
  /** User override of the AI classification. */
  overridden?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Forms / intake                                                              */
/* -------------------------------------------------------------------------- */

export interface FormField {
  id: ID;
  label: string;
  type: "text" | "email" | "phone" | "select" | "textarea" | "file" | "date" | "number";
  required: boolean;
  options?: string[];
}

export interface IntakeForm {
  id: ID;
  tenantId: ID;
  businessId: ID;
  name: string;
  description: string;
  kind: "intake" | "contact" | "quote" | "survey" | "booking";
  status: "live" | "draft" | "archived";
  fields: FormField[];
  createdAt: ISODate;
  submissions: number;
  completionRate: number;
  averageCompletionMinutes: number;
  /** Auto-follow-up when abandoned. */
  abandonFollowUp?: { enabled: boolean; afterHours: number; template: string };
}

export type FormSubmissionStatus = "started" | "partial" | "completed" | "abandoned";

export interface FormSubmission {
  id: ID;
  tenantId: ID;
  businessId: ID;
  formId: ID;
  prospectId?: ID;
  contactId?: ID;
  companyId?: ID;
  status: FormSubmissionStatus;
  completion: number;
  startedAt: ISODate;
  lastActivityAt: ISODate;
  submittedAt?: ISODate;
  answers: { fieldId: ID; label: string; value: string }[];
  missingFields: string[];
  /** AI assessed value of finishing this intake. */
  valueEstimate: number;
  reminderSentAt?: ISODate;
  source: LeadSource;
}

/* -------------------------------------------------------------------------- */
/* Work management                                                             */
/* -------------------------------------------------------------------------- */

export type NextActionType =
  | "reply"
  | "call"
  | "sms"
  | "whatsapp"
  | "follow_up"
  | "schedule"
  | "send_reminder"
  | "send_proposal"
  | "research"
  | "review"
  | "open"
  | "qualify";

export interface Task {
  id: ID;
  tenantId: ID;
  businessId: ID;
  title: string;
  description?: string;
  prospectId?: ID;
  contactId?: ID;
  companyId?: ID;
  ownerId: ID;
  createdBy: ID;
  createdByKind: "user" | "ai" | "system" | "automation";
  type: NextActionType | "admin" | "document" | "internal";
  priority: Priority;
  status: "open" | "in_progress" | "completed" | "snoozed" | "cancelled";
  dueAt: ISODate;
  completedAt?: ISODate;
  outcome?: string;
  /** Why the AI or automation created this task. */
  reason: string;
  aiRecommendation?: string;
  automationId?: ID;
  slaBreached: boolean;
  createdAt: ISODate;
}

export interface Appointment {
  id: ID;
  tenantId: ID;
  businessId: ID;
  title: string;
  kind: "call" | "meeting" | "demo" | "consult" | "site_visit";
  prospectId?: ID;
  contactId?: ID;
  companyId?: ID;
  ownerId: ID;
  startAt: ISODate;
  endAt: ISODate;
  status: "scheduled" | "confirmed" | "completed" | "missed" | "cancelled" | "rescheduled";
  location?: string;
  conferenceUrl?: string;
  notes?: string;
  scheduledBy: ID;
  scheduledByKind: "user" | "ai" | "system";
  aiPrep?: string;
  createdAt: ISODate;
}

export interface Document {
  id: ID;
  tenantId: ID;
  businessId: ID;
  name: string;
  kind: "proposal" | "contract" | "quote" | "report" | "intake" | "other";
  prospectId?: ID;
  companyId?: ID;
  dealId?: ID;
  uploadedBy: ID;
  uploadedByKind: "user" | "ai" | "contact" | "system";
  createdAt: ISODate;
  sizeKb: number;
  url?: string;
  status?: "draft" | "sent" | "viewed" | "signed" | "expired";
  viewedAt?: ISODate;
}

export interface Pipeline {
  id: ID;
  tenantId: ID;
  businessId: ID;
  name: string;
  isDefault: boolean;
  states: PipelineState[];
  /** Stage conversion target used by analytics. */
  conversionTargets: Partial<Record<PipelineStateKey, number>>;
}

export interface PipelineState {
  key: PipelineStateKey;
  label: string;
  order: number;
  color: string;
  /** How the state is inferred from behaviour by the intelligence engine. */
  entryCriteria: string[];
  probability: number;
  /** Automation may move prospects in/out of this state without a human. */
  autoManaged: boolean;
}

export interface Deal {
  id: ID;
  tenantId: ID;
  businessId: ID;
  prospectId: ID;
  companyId?: ID;
  name: string;
  value: number;
  currency: string;
  state: PipelineStateKey;
  probability: number;
  expectedCloseAt: ISODate;
  ownerId: ID;
  closedAt?: ISODate;
  won?: boolean;
  lostReason?: string;
  products: { name: string; value: number }[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

/* -------------------------------------------------------------------------- */
/* Events, intelligence, AI                                                    */
/* -------------------------------------------------------------------------- */

export type EventType =
  | "LEAD_CREATED"
  | "LEAD_IMPORTED"
  | "LEAD_UPDATED"
  | "LEAD_ASSIGNED"
  | "LEAD_SCORE_CHANGED"
  | "EMAIL_RECEIVED"
  | "EMAIL_SENT"
  | "EMAIL_OPENED"
  | "EMAIL_REPLIED"
  | "CALL_MISSED"
  | "CALL_RECEIVED"
  | "CALL_COMPLETED"
  | "CALL_LOGGED"
  | "SMS_RECEIVED"
  | "SMS_SENT"
  | "WHATSAPP_RECEIVED"
  | "WHATSAPP_SENT"
  | "FORM_STARTED"
  | "FORM_ABANDONED"
  | "FORM_COMPLETED"
  | "FORM_REMINDER_SENT"
  | "APPOINTMENT_CREATED"
  | "APPOINTMENT_COMPLETED"
  | "APPOINTMENT_MISSED"
  | "APPOINTMENT_RESCHEDULED"
  | "TASK_CREATED"
  | "TASK_OVERDUE"
  | "TASK_COMPLETED"
  | "TASK_SNOOZED"
  | "PROPOSAL_SENT"
  | "PROPOSAL_VIEWED"
  | "DEAL_WON"
  | "DEAL_LOST"
  | "PIPELINE_STATE_CHANGED"
  | "AI_INSIGHT_CREATED"
  | "AI_ACTION_PROPOSED"
  | "AI_ACTION_EXECUTED"
  | "AI_ACTION_APPROVED"
  | "AI_ACTION_REJECTED"
  | "AI_ACTION_REVERTED"
  | "AI_PAUSED"
  | "AI_RESUMED"
  | "AUTOMATION_TRIGGERED"
  | "AUTOMATION_COMPLETED"
  | "AUTOMATION_FAILED"
  | "INTEGRATION_CONNECTED"
  | "INTEGRATION_ERROR"
  | "USER_LOGGED_IN"
  | "NOTE_ADDED"
  | "DOCUMENT_UPLOADED"
  | "PERMISSION_CHANGED";

export interface DomainEvent {
  id: ID;
  type: EventType;
  tenantId: ID;
  businessId: ID;
  prospectId?: ID;
  contactId?: ID;
  companyId?: ID;
  /** user id, agent id, integration id or "system" */
  actorId: ID;
  actorKind: "user" | "ai" | "system" | "contact" | "automation" | "integration";
  channel?: Channel;
  occurredAt: ISODate;
  summary: string;
  detail?: string;
  /** Event payload — original facts, used for replay/re-processing. */
  payload?: Record<string, unknown>;
  /** Effects the intelligence pipeline produced from this event. */
  effects?: EventEffect[];
  /** Marks events that should drive automation evaluation. */
  automationEligible?: boolean;
  /** For heavy-volume systems: which pipeline stage processed it. */
  processedBy?: string[];
}

export interface EventEffect {
  kind: "score" | "intent" | "priority" | "state" | "task" | "notification" | "insight" | "action";
  label: string;
  detail?: string;
  delta?: number;
}

export type ScoringWeights = Record<SignalKey, number>;

export type SignalKey =
  | "recentResponse"
  | "responseSpeed"
  | "emailEngagement"
  | "callActivity"
  | "messageActivity"
  | "formCompletion"
  | "appointmentActivity"
  | "recency"
  | "dealValue"
  | "leadSource"
  | "followUpStatus"
  | "interactionDepth"
  | "intentStrength"
  | "engagementTrend"
  | "historicalConversion"
  | "aiOpportunity";

export interface ScoreSignal {
  key: SignalKey;
  label: string;
  weight: number;
  /** Normalised 0..1 raw signal value. */
  value: number;
  points: number;
  reason: string;
}

export interface ScoreBreakdown {
  prospectId: ID;
  total: number;
  band: "hot" | "warm" | "cold";
  confidence: number;
  signals: ScoreSignal[];
  modelVersion: string;
  computedAt: ISODate;
  /** Direction of change vs. previous computation. */
  delta: number;
  whyHot: string[];
}

export type AIInsightKind =
  | "daily_summary"
  | "prospect_summary"
  | "risk"
  | "opportunity"
  | "coaching"
  | "forecast"
  | "automation_suggestion"
  | "research";

export interface AIInsight {
  id: ID;
  tenantId: ID;
  businessId: ID;
  kind: AIInsightKind;
  prospectId?: ID;
  companyId?: ID;
  title: string;
  body: string;
  bullets?: string[];
  confidence: number;
  model: string;
  createdAt: ISODate;
  dismissed?: boolean;
  pinned?: boolean;
}

export type AIActionType =
  | "send_email"
  | "send_sms"
  | "send_whatsapp"
  | "place_call"
  | "create_task"
  | "schedule_follow_up"
  | "update_pipeline_state"
  | "update_priority"
  | "send_intake_reminder"
  | "draft_proposal"
  | "assign_owner"
  | "research_prospect"
  | "escalate"
  | "notify_manager";

export type AIActionStatus =
  | "proposed"
  | "awaiting_approval"
  | "approved"
  | "executing"
  | "executed"
  | "rejected"
  | "dismissed"
  | "reverted"
  | "failed";

export interface AIAction {
  id: ID;
  tenantId: ID;
  businessId: ID;
  type: AIActionType;
  status: AIActionStatus;
  prospectId?: ID;
  contactId?: ID;
  companyId?: ID;
  taskId?: ID;
  agentId: ID;
  /** Human that approved/rejected, when applicable. */
  approvedBy?: ID;
  title: string;
  rationale: string;
  expectedOutcome: string;
  confidence: number;
  autonomyUsed: AutonomyMode;
  payload: Record<string, unknown>;
  /** Draft content for review (email body, sms text...). */
  draft?: string;
  createdAt: ISODate;
  executedAt?: ISODate;
  result?: string;
  revertible: boolean;
  revertedAt?: ISODate;
  revertedBy?: ID;
  /** Snapshot used for undo. */
  undo?: { entity: string; id: ID; patch: Record<string, unknown> };
  automationId?: ID;
  insightId?: ID;
}

export type AutonomyMode = "assist" | "approve" | "autonomous";

/* -------------------------------------------------------------------------- */
/* Automation                                                                  */
/* -------------------------------------------------------------------------- */

export type AutomationConditionField =
  | "intent"
  | "priority"
  | "score"
  | "state"
  | "source"
  | "channel"
  | "owner"
  | "value"
  | "formStatus"
  | "tag"
  | "timeSinceLastContactHours"
  | "companyTier";

export type AutomationOperator =
  "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "in" | "not_in" | "is_true";

export interface AutomationCondition {
  id: ID;
  field: AutomationConditionField;
  operator: AutomationOperator;
  value: string | number | boolean | string[];
  logic: "AND" | "OR";
}

export interface AutomationAction {
  id: ID;
  type: AIActionType | "create_notification" | "add_tag" | "send_to_webhook";
  params: Record<string, unknown>;
  label: string;
  /** true = requires human approval even when the automation runs. */
  requiresApproval: boolean;
  delayMinutes?: number;
}

export interface Automation {
  id: ID;
  tenantId: ID;
  businessId: ID;
  name: string;
  description: string;
  status: "active" | "paused" | "draft";
  trigger: EventType;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  runCount: number;
  successCount: number;
  failureCount: number;
  lastRunAt?: ISODate;
  createdBy: ID;
  createdByKind: "user" | "ai";
  aiSuggested?: boolean;
  createdAt: ISODate;
}

export interface AutomationRun {
  id: ID;
  tenantId: ID;
  businessId: ID;
  automationId: ID;
  eventId: ID;
  prospectId?: ID;
  status: "success" | "failed" | "skipped" | "pending_approval";
  detail: string;
  startedAt: ISODate;
  finishedAt?: ISODate;
}

/* -------------------------------------------------------------------------- */
/* Integrations                                                                */
/* -------------------------------------------------------------------------- */

export type IntegrationKey =
  | "gmail"
  | "google_workspace"
  | "outlook"
  | "microsoft365"
  | "twilio"
  | "vonage"
  | "whatsapp_business"
  | "google_calendar"
  | "outlook_calendar"
  | "google_sheets"
  | "csv"
  | "linkedin"
  | "hubspot"
  | "salesforce"
  | "webforms"
  | "zapier"
  | "slack"
  | "openai"
  | "anthropic";

export interface Integration {
  id: ID;
  tenantId: ID;
  businessId: ID;
  key: IntegrationKey;
  name: string;
  category:
    | "email"
    | "calendar"
    | "telephony"
    | "messaging"
    | "crm"
    | "data"
    | "ai"
    | "notifications"
    | "social";
  description: string;
  status: "connected" | "disconnected" | "error" | "syncing" | "available";
  capabilities: IntegrationCapability[];
  connectedBy?: ID;
  connectedAt?: ISODate;
  lastSyncAt?: ISODate;
  lastError?: string;
  /** Adapter contract version — integration-agnostic. */
  adapter: string;
  config?: Record<string, unknown>;
  eventsHandled?: number;
}

export type IntegrationCapability =
  | "read_email"
  | "send_email"
  | "read_calendar"
  | "write_calendar"
  | "read_calls"
  | "place_calls"
  | "read_sms"
  | "send_sms"
  | "read_whatsapp"
  | "send_whatsapp"
  | "import_contacts"
  | "export_data"
  | "webhooks"
  | "embeddings";

/* -------------------------------------------------------------------------- */
/* Notifications & audit                                                       */
/* -------------------------------------------------------------------------- */

export type NotificationKind =
  | "new_response"
  | "missed_call"
  | "hot_prospect"
  | "follow_up_overdue"
  | "form_incomplete"
  | "appointment"
  | "ai_action"
  | "automation_failure"
  | "integration_issue"
  | "opportunity";

export interface Notification {
  id: ID;
  tenantId: ID;
  businessId: ID;
  kind: NotificationKind;
  title: string;
  body: string;
  prospectId?: ID;
  priority: Priority;
  createdAt: ISODate;
  readAt?: ISODate;
  actionLabel?: string;
  actionHref?: string;
  actorKind: "ai" | "system" | "user";
}

export interface AuditLogEntry {
  id: ID;
  tenantId: ID;
  businessId: ID;
  actorId: ID;
  actorKind: "user" | "ai" | "system" | "automation";
  actorName: string;
  action: string;
  targetType: string;
  targetId: ID;
  targetLabel: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  reason: string;
  metadata?: Record<string, unknown>;
  occurredAt: ISODate;
  reversible: boolean;
  revertedAt?: ISODate;
}

/* -------------------------------------------------------------------------- */
/* Derived / view models                                                       */
/* -------------------------------------------------------------------------- */

export type AttentionKind =
  | "email_response"
  | "missed_call"
  | "hot_prospect"
  | "overdue_follow_up"
  | "incomplete_intake"
  | "missed_appointment"
  | "task_overdue"
  | "unanswered_message"
  | "stalled_deal"
  | "unanswered_email";

export interface AttentionItem {
  id: ID;
  kind: AttentionKind;
  priority: Priority;
  /** 0-100 urgency used for ordering. */
  urgency: number;
  prospectId?: ID;
  contactId?: ID;
  companyId?: ID;
  companyName?: string;
  title: string;
  reason: string;
  /** ISO timestamp of the underlying event. */
  occurredAt: ISODate;
  ageMinutes: number;
  recommendedAction: NextActionType;
  recommendedActionLabel: string;
  insight?: string;
  scoreImpact?: number;
  href: string;
}

export interface SavedView {
  id: ID;
  tenantId: ID;
  businessId: ID;
  userId: ID | "shared";
  name: string;
  entity: "prospects" | "tasks" | "communications";
  filters: Record<string, unknown>;
  createdAt: ISODate;
  icon?: string;
}

export interface SimulatedEventInput {
  type: EventType;
  businessId: ID;
  prospectId?: ID;
  contactId?: ID;
  companyId?: ID;
  channel?: Channel;
  summary: string;
  detail?: string;
  payload?: Record<string, unknown>;
  actorId?: ID;
  actorKind?: DomainEvent["actorKind"];
  occurredAt?: ISODate;
}

export interface Session {
  userId: ID;
  tenantId: ID;
  businessId: ID;
  startedAt: ISODate;
  /** Session that has not yet completed tenant onboarding. */
  onboardingComplete: boolean;
}

export interface AppState {
  version: number;
  seededAt: ISODate;
  tenants: Tenant[];
  businesses: Business[];
  users: User[];
  memberships: Membership[];
  teams: Team[];
  agents: AIAgent[];
  companies: Company[];
  contacts: Contact[];
  prospects: Prospect[];
  communications: Communication[];
  forms: IntakeForm[];
  submissions: FormSubmission[];
  tasks: Task[];
  appointments: Appointment[];
  documents: Document[];
  pipelines: Pipeline[];
  deals: Deal[];
  events: DomainEvent[];
  insights: AIInsight[];
  actions: AIAction[];
  automations: Automation[];
  automationRuns: AutomationRun[];
  integrations: Integration[];
  notifications: Notification[];
  audit: AuditLogEntry[];
  savedViews: SavedView[];
  session: Session;
  /** Global AI kill-switch state per business. */
  aiPausedBusinessIds: ID[];
  scoreBreakdowns: Record<ID, ScoreBreakdown>;
}
