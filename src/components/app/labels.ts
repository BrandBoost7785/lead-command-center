import type { AutonomyMode, AIActionStatus, AIActionType, EventType } from "@/lib/domain/types";

export const AUTONOMY_LABEL: Record<AutonomyMode, string> = {
  assist: "Assist — recommend only",
  approve: "Approve — prepare & wait",
  autonomous: "Autonomous — acts in scope",
};

export const AUTONOMY_SHORT: Record<AutonomyMode, string> = {
  assist: "Assist",
  approve: "Approve",
  autonomous: "Autonomous",
};

export const ACTION_TYPE_LABEL: Record<AIActionType, string> = {
  send_email: "Send email",
  send_sms: "Send SMS",
  send_whatsapp: "Send WhatsApp",
  place_call: "Place call",
  create_task: "Create task",
  schedule_follow_up: "Schedule follow-up",
  update_pipeline_state: "Update pipeline state",
  update_priority: "Update priority",
  send_intake_reminder: "Send intake reminder",
  draft_proposal: "Draft proposal",
  assign_owner: "Assign owner",
  research_prospect: "Research prospect",
  escalate: "Escalate",
  notify_manager: "Notify manager",
};

export const ACTION_STATUS_LABEL: Record<AIActionStatus, string> = {
  proposed: "Proposed",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  executing: "Executing",
  executed: "Executed",
  rejected: "Rejected",
  dismissed: "Dismissed",
  reverted: "Reverted",
  failed: "Failed",
};

export const EVENT_LABEL: Partial<Record<EventType, string>> = {
  LEAD_CREATED: "Lead created",
  LEAD_IMPORTED: "Lead imported",
  LEAD_UPDATED: "Lead updated",
  LEAD_ASSIGNED: "Lead assigned",
  LEAD_SCORE_CHANGED: "Score changed",
  EMAIL_RECEIVED: "Email received",
  EMAIL_SENT: "Email sent",
  EMAIL_OPENED: "Email opened",
  EMAIL_REPLIED: "Email replied",
  CALL_MISSED: "Call missed",
  CALL_RECEIVED: "Call received",
  CALL_COMPLETED: "Call completed",
  CALL_LOGGED: "Call logged",
  SMS_RECEIVED: "SMS received",
  SMS_SENT: "SMS sent",
  WHATSAPP_RECEIVED: "WhatsApp received",
  WHATSAPP_SENT: "WhatsApp sent",
  FORM_STARTED: "Form started",
  FORM_ABANDONED: "Form abandoned",
  FORM_COMPLETED: "Form completed",
  FORM_REMINDER_SENT: "Intake reminder sent",
  APPOINTMENT_CREATED: "Appointment created",
  APPOINTMENT_COMPLETED: "Appointment completed",
  APPOINTMENT_MISSED: "Appointment missed",
  APPOINTMENT_RESCHEDULED: "Appointment rescheduled",
  TASK_CREATED: "Task created",
  TASK_OVERDUE: "Task overdue",
  TASK_COMPLETED: "Task completed",
  TASK_SNOOZED: "Task snoozed",
  PROPOSAL_SENT: "Proposal sent",
  PROPOSAL_VIEWED: "Proposal viewed",
  DEAL_WON: "Deal won",
  DEAL_LOST: "Deal lost",
  PIPELINE_STATE_CHANGED: "Pipeline state changed",
  AI_INSIGHT_CREATED: "AI insight created",
  AI_ACTION_PROPOSED: "AI action proposed",
  AI_ACTION_EXECUTED: "AI action executed",
  AI_ACTION_APPROVED: "AI action approved",
  AI_ACTION_REJECTED: "AI action rejected",
  AI_ACTION_REVERTED: "AI action reverted",
  AI_PAUSED: "AI paused",
  AI_RESUMED: "AI resumed",
  AUTOMATION_TRIGGERED: "Automation triggered",
  AUTOMATION_COMPLETED: "Automation completed",
  AUTOMATION_FAILED: "Automation failed",
  INTEGRATION_CONNECTED: "Integration connected",
  INTEGRATION_ERROR: "Integration error",
  USER_LOGGED_IN: "User logged in",
  NOTE_ADDED: "Note added",
  DOCUMENT_UPLOADED: "Document uploaded",
  PERMISSION_CHANGED: "Permission changed",
};

export const INTEGRATION_STATUS_TONE: Record<
  string,
  "positive" | "critical" | "medium" | "neutral" | "info"
> = {
  connected: "positive",
  error: "critical",
  syncing: "info",
  disconnected: "medium",
  available: "neutral",
};
