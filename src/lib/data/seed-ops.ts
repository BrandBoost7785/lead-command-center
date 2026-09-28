import type {
  AIAction,
  AIInsight,
  Appointment,
  AuditLogEntry,
  Automation,
  AutomationRun,
  Channel,
  Communication,
  Deal,
  Document,
  DomainEvent,
  EventEffect,
  EventType,
  FormSubmission,
  IntakeForm,
  Integration,
  Notification,
  Pipeline,
  Prospect,
  Task,
} from "@/lib/domain/types";
import { BIZ1, BIZ2, TENANT } from "./seed-crm";

/* -------------------------------------------------------------------------- */
/* Pipelines                                                                   */
/* -------------------------------------------------------------------------- */

export function buildPipelines(): Pipeline[] {
  const states = (businessId: string): Pipeline["states"] => [
    {
      key: "new",
      label: "New",
      order: 0,
      color: "oklch(0.65 0.02 250)",
      entryCriteria: ["Lead created from any source"],
      probability: 0.05,
      autoManaged: true,
    },
    {
      key: "contacted",
      label: "Contacted",
      order: 1,
      color: "oklch(0.62 0.12 240)",
      entryCriteria: ["Outbound email, call or message attempted"],
      probability: 0.12,
      autoManaged: true,
    },
    {
      key: "engaged",
      label: "Engaged",
      order: 2,
      color: "oklch(0.6 0.14 220)",
      entryCriteria: ["Prospect replied on any channel"],
      probability: 0.28,
      autoManaged: true,
    },
    {
      key: "qualified",
      label: "Qualified",
      order: 3,
      color: "oklch(0.6 0.15 195)",
      entryCriteria: ["Intake completed or budget/need confirmed"],
      probability: 0.45,
      autoManaged: true,
    },
    {
      key: "appointment",
      label: "Appointment",
      order: 4,
      color: "oklch(0.62 0.16 165)",
      entryCriteria: ["Appointment booked or walkthrough confirmed"],
      probability: 0.62,
      autoManaged: true,
    },
    {
      key: "proposal",
      label: "Proposal",
      order: 5,
      color: "oklch(0.66 0.16 120)",
      entryCriteria: ["Proposal or quote document sent"],
      probability: 0.72,
      autoManaged: true,
    },
    {
      key: "negotiation",
      label: "Negotiation",
      order: 6,
      color: "oklch(0.7 0.16 75)",
      entryCriteria: ["Pricing or terms discussed after proposal"],
      probability: 0.84,
      autoManaged: true,
    },
    {
      key: "won",
      label: "Won",
      order: 7,
      color: "oklch(0.66 0.17 150)",
      entryCriteria: ["Contract signed or deal marked won"],
      probability: 1,
      autoManaged: false,
    },
    {
      key: "lost",
      label: "Lost",
      order: 8,
      color: "oklch(0.6 0.19 20)",
      entryCriteria: ["Declined or lost to competitor"],
      probability: 0,
      autoManaged: false,
    },
    {
      key: "customer",
      label: "Customer",
      order: 9,
      color: "oklch(0.62 0.19 264)",
      entryCriteria: ["Onboarded and active after a win"],
      probability: 1,
      autoManaged: false,
    },
  ];

  return [
    {
      id: "pipe_northwind",
      tenantId: TENANT,
      businessId: BIZ1,
      name: "Northwind revenue pipeline",
      isDefault: true,
      states: states(BIZ1),
      conversionTargets: {
        engaged: 0.42,
        qualified: 0.3,
        appointment: 0.22,
        proposal: 0.16,
        won: 0.14,
      },
    },
    {
      id: "pipe_meridian",
      tenantId: TENANT,
      businessId: BIZ2,
      name: "Meridian jobs pipeline",
      isDefault: true,
      states: states(BIZ2),
      conversionTargets: {
        engaged: 0.5,
        qualified: 0.34,
        appointment: 0.28,
        proposal: 0.2,
        won: 0.18,
      },
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Forms + submissions                                                         */
/* -------------------------------------------------------------------------- */

export function buildForms(now: number): { forms: IntakeForm[]; submissions: FormSubmission[] } {
  const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
  const forms: IntakeForm[] = [
    {
      id: "form_patient_intake",
      tenantId: TENANT,
      businessId: BIZ1,
      name: "New Patient Intake",
      description: "Medical history, insurance and consent capture for new patients.",
      kind: "intake",
      status: "live",
      fields: [
        { id: "f1", label: "Full name", type: "text", required: true },
        { id: "f2", label: "Email", type: "email", required: true },
        { id: "f3", label: "Phone", type: "phone", required: true },
        { id: "f4", label: "Date of birth", type: "date", required: true },
        {
          id: "f5",
          label: "Insurance provider",
          type: "select",
          required: true,
          options: ["Delta", "Cigna", "Aetna", "Self-pay"],
        },
        { id: "f6", label: "Medical history", type: "textarea", required: true },
        { id: "f7", label: "Medications", type: "textarea", required: false },
        { id: "f8", label: "Consent to treat (signature)", type: "text", required: true },
      ],
      createdAt: "2025-11-02T09:00:00.000Z",
      submissions: 412,
      completionRate: 0.81,
      averageCompletionMinutes: 6,
      abandonFollowUp: {
        enabled: true,
        afterHours: 12,
        template: "Intake reminder — finish in 2 minutes",
      },
    },
    {
      id: "form_corporate_intake",
      tenantId: TENANT,
      businessId: BIZ1,
      name: "Multi-site Corporate Intake",
      description:
        "Headcount, sites, benefits windows and billing contacts for corporate accounts.",
      kind: "quote",
      status: "live",
      fields: [
        { id: "c1", label: "Company", type: "text", required: true },
        { id: "c2", label: "Headcount", type: "number", required: true },
        { id: "c3", label: "Sites", type: "number", required: true },
        { id: "c4", label: "Site addresses", type: "textarea", required: true },
        { id: "c5", label: "Benefits renewal date", type: "date", required: true },
        { id: "c6", label: "Billing contact", type: "text", required: true },
        { id: "c7", label: "Current provider", type: "text", required: false },
        { id: "c8", label: "Priority outcomes", type: "textarea", required: true },
        { id: "c9", label: "Procurement process notes", type: "textarea", required: false },
      ],
      createdAt: "2025-12-14T09:00:00.000Z",
      submissions: 63,
      completionRate: 0.58,
      averageCompletionMinutes: 11,
      abandonFollowUp: {
        enabled: true,
        afterHours: 6,
        template: "Offer a call to finish the intake together",
      },
    },
    {
      id: "form_wellness_inquiry",
      tenantId: TENANT,
      businessId: BIZ1,
      name: "Corporate Wellness Inquiry",
      description: "Lightweight top-of-funnel enquiry for employer groups.",
      kind: "contact",
      status: "live",
      fields: [
        { id: "w1", label: "Company", type: "text", required: true },
        { id: "w2", label: "Work email", type: "email", required: true },
        { id: "w3", label: "Headcount", type: "number", required: true },
        { id: "w4", label: "What are you solving for?", type: "textarea", required: true },
      ],
      createdAt: "2026-01-08T09:00:00.000Z",
      submissions: 148,
      completionRate: 0.92,
      averageCompletionMinutes: 3,
    },
    {
      id: "form_insurance_precheck",
      tenantId: TENANT,
      businessId: BIZ1,
      name: "Insurance Pre-check",
      description: "Coverage verification before the first appointment.",
      kind: "survey",
      status: "draft",
      fields: [
        {
          id: "i1",
          label: "Provider",
          type: "select",
          required: true,
          options: ["Delta", "Cigna", "Aetna", "Other"],
        },
        { id: "i2", label: "Member ID", type: "text", required: true },
        { id: "i3", label: "Group number", type: "text", required: false },
      ],
      createdAt: "2026-02-01T09:00:00.000Z",
      submissions: 0,
      completionRate: 0,
      averageCompletionMinutes: 2,
    },
    {
      id: "form_roof_inspection",
      tenantId: TENANT,
      businessId: BIZ2,
      name: "Free Roof Inspection Request",
      description: "Property details and access notes for scheduling a survey.",
      kind: "booking",
      status: "live",
      fields: [
        { id: "r1", label: "Property address", type: "text", required: true },
        {
          id: "r2",
          label: "Property type",
          type: "select",
          required: true,
          options: ["Residential", "Commercial", "Multi-unit"],
        },
        { id: "r3", label: "Roof age (years)", type: "number", required: true },
        { id: "r4", label: "Roof area (squares)", type: "number", required: true },
        { id: "r5", label: "Access notes", type: "textarea", required: true },
        { id: "r6", label: "Site contact", type: "text", required: true },
      ],
      createdAt: "2026-01-20T09:00:00.000Z",
      submissions: 219,
      completionRate: 0.64,
      averageCompletionMinutes: 5,
      abandonFollowUp: {
        enabled: true,
        afterHours: 4,
        template: "Two questions and we can schedule",
      },
    },
    {
      id: "form_hail_claim",
      tenantId: TENANT,
      businessId: BIZ2,
      name: "Hail Damage Claim Intake",
      description:
        "Insurance claim details so an estimate can be produced before the adjuster visit.",
      kind: "intake",
      status: "live",
      fields: [
        { id: "h1", label: "Address", type: "text", required: true },
        { id: "h2", label: "Insurance carrier", type: "text", required: true },
        { id: "h3", label: "Claim number", type: "text", required: false },
        { id: "h4", label: "Adjuster visit date", type: "date", required: true },
        { id: "h5", label: "Damage description", type: "textarea", required: true },
      ],
      createdAt: "2026-02-10T09:00:00.000Z",
      submissions: 87,
      completionRate: 0.7,
      averageCompletionMinutes: 6,
      abandonFollowUp: {
        enabled: true,
        afterHours: 2,
        template: "Adjuster timing — let's document first",
      },
    },
  ];

  const submissions: FormSubmission[] = [
    {
      id: "sub_dana",
      tenantId: TENANT,
      businessId: BIZ1,
      formId: "form_corporate_intake",
      prospectId: "p_dana",
      contactId: "ct_dana",
      companyId: "co_xyz",
      status: "partial",
      completion: 78,
      startedAt: ago(2 * 24 * 60 + 18),
      lastActivityAt: ago(2 * 24 * 60 + 18),
      answers: [
        { fieldId: "c1", label: "Company", value: "XYZ Logistics" },
        { fieldId: "c2", label: "Headcount", value: "640" },
        { fieldId: "c3", label: "Sites", value: "4" },
        { fieldId: "c5", label: "Benefits renewal date", value: "2026-11-01" },
        { fieldId: "c6", label: "Billing contact", value: "accounts.payable@xyzlogistics.com" },
        { fieldId: "c7", label: "Current provider", value: "Regional PPO network" },
      ],
      missingFields: ["Site addresses", "Priority outcomes", "Procurement process notes"],
      valueEstimate: 24_000,
      source: "website_form",
    },
    {
      id: "sub_wendy",
      tenantId: TENANT,
      businessId: BIZ2,
      formId: "form_roof_inspection",
      prospectId: "p_wendy",
      contactId: "ct_wendy",
      companyId: "co_granite",
      status: "partial",
      completion: 62,
      startedAt: ago(3 * 24 * 60),
      lastActivityAt: ago(3 * 24 * 60),
      answers: [
        { fieldId: "r1", label: "Property address", value: "9800 E 40th Ave, Aurora CO" },
        { fieldId: "r2", label: "Property type", value: "Commercial" },
        { fieldId: "r3", label: "Roof age (years)", value: "22" },
        { fieldId: "r4", label: "Roof area (squares)", value: "180" },
      ],
      missingFields: ["Access notes", "Site contact"],
      valueEstimate: 27_000,
      reminderSentAt: ago(2 * 24 * 60 + 300),
      source: "website_form",
    },
    {
      id: "sub_miguel",
      tenantId: TENANT,
      businessId: BIZ2,
      formId: "form_roof_inspection",
      prospectId: "p_miguel",
      contactId: "ct_miguel",
      status: "completed",
      completion: 100,
      startedAt: ago(305),
      lastActivityAt: ago(300),
      submittedAt: ago(300),
      answers: [
        { fieldId: "r1", label: "Property address", value: "11412 York St, Thornton CO" },
        { fieldId: "r2", label: "Property type", value: "Residential" },
        { fieldId: "r3", label: "Roof age (years)", value: "27" },
        { fieldId: "r4", label: "Roof area (squares)", value: "22" },
        { fieldId: "r5", label: "Access notes", value: "Side gate code 4412, dog in back yard" },
        { fieldId: "r6", label: "Site contact", value: "Miguel Santos" },
      ],
      missingFields: [],
      valueEstimate: 16_500,
      source: "website_form",
    },
    {
      id: "sub_marcus",
      tenantId: TENANT,
      businessId: BIZ1,
      formId: "form_wellness_inquiry",
      prospectId: "p_marcus",
      contactId: "ct_marcus",
      companyId: "co_harbor",
      status: "completed",
      completion: 100,
      startedAt: ago(132),
      lastActivityAt: ago(128),
      submittedAt: ago(128),
      answers: [
        { fieldId: "w1", label: "Company", value: "Harbor Point Realty" },
        { fieldId: "w2", label: "Work email", value: "marcus@harborpoint.com" },
        { fieldId: "w3", label: "Headcount", value: "45" },
        {
          fieldId: "w4",
          label: "What are you solving for?",
          value: "Pricing before our renewal window closes",
        },
      ],
      missingFields: [],
      valueEstimate: 6_500,
      source: "google_ads",
    },
    {
      id: "sub_sofia",
      tenantId: TENANT,
      businessId: BIZ1,
      formId: "form_wellness_inquiry",
      prospectId: "p_sofia",
      contactId: "ct_sofia",
      status: "completed",
      completion: 100,
      startedAt: ago(44),
      lastActivityAt: ago(40),
      submittedAt: ago(40),
      answers: [
        { fieldId: "w1", label: "Company", value: "Marquez Studio" },
        { fieldId: "w2", label: "Work email", value: "sofia@marquezstudio.com" },
        { fieldId: "w3", label: "Headcount", value: "60" },
        {
          fieldId: "w4",
          label: "What are you solving for?",
          value: "Per-employee pricing and a start date before quarter end",
        },
      ],
      missingFields: [],
      valueEstimate: 7_800,
      source: "website_form",
    },
    {
      id: "sub_karen",
      tenantId: TENANT,
      businessId: BIZ2,
      formId: "form_hail_claim",
      prospectId: "p_karen",
      contactId: "ct_karen",
      status: "completed",
      completion: 100,
      startedAt: ago(2 * 24 * 60 + 30),
      lastActivityAt: ago(2 * 24 * 60),
      submittedAt: ago(2 * 24 * 60),
      answers: [
        { fieldId: "h1", label: "Address", value: "7722 W 16th Ave, Lakewood CO" },
        { fieldId: "h2", label: "Insurance carrier", value: "Statewide Mutual" },
        { fieldId: "h3", label: "Claim number", value: "SW-4471902" },
        { fieldId: "h4", label: "Adjuster visit date", value: "2026-09-30" },
        {
          fieldId: "h5",
          label: "Damage description",
          value: "Hail bruising across south slope, two cracked boots",
        },
      ],
      missingFields: [],
      valueEstimate: 21_000,
      source: "google_ads",
    },
    {
      id: "sub_rachel",
      tenantId: TENANT,
      businessId: BIZ1,
      formId: "form_patient_intake",
      prospectId: "p_rachel",
      contactId: "ct_rachel",
      status: "completed",
      completion: 100,
      startedAt: ago(8 * 24 * 60 + 6),
      lastActivityAt: ago(8 * 24 * 60),
      submittedAt: ago(8 * 24 * 60),
      answers: [
        { fieldId: "f1", label: "Full name", value: "Rachel Nguyen" },
        { fieldId: "f2", label: "Email", value: "rachel.nguyen@gmail.com" },
        { fieldId: "f5", label: "Insurance provider", value: "Delta" },
      ],
      missingFields: [],
      valueEstimate: 3_200,
      source: "walk_in",
    },
    {
      id: "sub_carla",
      tenantId: TENANT,
      businessId: BIZ1,
      formId: "form_patient_intake",
      prospectId: undefined,
      contactId: undefined,
      status: "abandoned",
      completion: 33,
      startedAt: ago(20 * 60),
      lastActivityAt: ago(19 * 60 + 40),
      answers: [
        { fieldId: "f1", label: "Full name", value: "Carla Mendes" },
        { fieldId: "f2", label: "Email", value: "carla.mendes@gmail.com" },
      ],
      missingFields: [
        "Phone",
        "Date of birth",
        "Insurance provider",
        "Medical history",
        "Consent to treat",
      ],
      valueEstimate: 1_400,
      source: "google_ads",
    },
    {
      id: "sub_holly",
      tenantId: TENANT,
      businessId: BIZ1,
      formId: "form_corporate_intake",
      prospectId: undefined,
      status: "abandoned",
      completion: 44,
      startedAt: ago(4 * 24 * 60),
      lastActivityAt: ago(4 * 24 * 60 + 12),
      answers: [
        { fieldId: "c1", label: "Company", value: "Ridgeline Health Group" },
        { fieldId: "c2", label: "Headcount", value: "310" },
        { fieldId: "c3", label: "Sites", value: "2" },
      ],
      missingFields: [
        "Site addresses",
        "Benefits renewal date",
        "Billing contact",
        "Priority outcomes",
      ],
      valueEstimate: 18_500,
      source: "partner",
    },
    {
      id: "sub_vikram",
      tenantId: TENANT,
      businessId: BIZ2,
      formId: "form_roof_inspection",
      status: "partial",
      completion: 55,
      startedAt: ago(26 * 60),
      lastActivityAt: ago(25 * 60 + 20),
      answers: [
        { fieldId: "r1", label: "Property address", value: "3377 S Lincoln St, Englewood CO" },
        { fieldId: "r2", label: "Property type", value: "Residential" },
        { fieldId: "r3", label: "Roof age (years)", value: "19" },
        { fieldId: "r4", label: "Roof area (squares)", value: "28" },
      ],
      missingFields: ["Access notes", "Site contact"],
      valueEstimate: 19_400,
      source: "google_ads",
    },
  ];

  return { forms, submissions };
}

/* -------------------------------------------------------------------------- */
/* Tasks                                                                       */
/* -------------------------------------------------------------------------- */

export function buildTasks(now: number): Task[] {
  const t = (
    id: string,
    businessId: string,
    title: string,
    opts: Partial<Task> & { dueMinutes: number; ownerId: string; reason: string },
  ): Task => ({
    id,
    tenantId: TENANT,
    businessId,
    title,
    prospectId: opts.prospectId,
    contactId: opts.contactId,
    companyId: opts.companyId,
    ownerId: opts.ownerId,
    createdBy: opts.createdBy ?? "u_ava",
    createdByKind: opts.createdByKind ?? "ai",
    type: opts.type ?? "follow_up",
    priority: opts.priority ?? "medium",
    status: opts.status ?? (opts.dueMinutes < 0 ? "open" : "open"),
    dueAt: new Date(now + opts.dueMinutes * 60_000).toISOString(),
    completedAt: opts.completedAt,
    outcome: opts.outcome,
    reason: opts.reason,
    aiRecommendation: opts.aiRecommendation,
    automationId: opts.automationId,
    slaBreached: opts.dueMinutes < 0 && opts.status !== "completed",
    createdAt: opts.createdAt ?? new Date(now + (opts.dueMinutes - 600) * 60_000).toISOString(),
    description: opts.description,
  });

  return [
    // overdue
    t("task_sarah_reply", BIZ1, "Reply to Sarah Williams — corporate plan Thursday/Friday", {
      prospectId: "p_sarah",
      contactId: "ct_sarah",
      companyId: "co_abc",
      dueMinutes: 12,
      ownerId: "u_daniel",
      type: "reply",
      priority: "critical",
      reason: "High-intent email response received 8 minutes ago.",
      aiRecommendation:
        "Reply within the hour with two concrete slots (Thu 10:00, Fri 09:30) and confirm the office manager can join.",
      description: "Draft ready for review in AI Command Center.",
    }),
    t("task_michael_call", BIZ1, "Return missed call — Michael Osei", {
      prospectId: "p_michael",
      contactId: "ct_michael",
      companyId: "co_riverbend",
      dueMinutes: 46,
      ownerId: "u_daniel",
      type: "call",
      priority: "high",
      reason: "Inbound call missed 14 minutes ago from a high-value prospect.",
      aiRecommendation: "Call back now; he asked for a contract review before month end.",
    }),
    t("task_john_pricing", BIZ1, "Send John Whitaker the family-plan pricing answer", {
      prospectId: "p_john",
      contactId: "ct_john",
      companyId: "co_vantage",
      dueMinutes: -1_440,
      ownerId: "u_maria",
      type: "reply",
      priority: "high",
      reason: "Pricing question unanswered for 4 days; promised next-morning reply.",
      aiRecommendation: "Send the per-employee cost and the proration rule by 11:00 today.",
      createdBy: "u_alex",
      createdByKind: "user",
    }),
    t("task_tanya_warranty", BIZ2, "Answer Tanya Brooks on tier warranty difference", {
      prospectId: "p_tanya",
      contactId: "ct_tanya",
      companyId: "co_canyon",
      dueMinutes: -2_880,
      ownerId: "u_mer_lu",
      type: "reply",
      priority: "high",
      reason: "Warranty question unanswered for 5 days (SLA is 4 hours).",
      aiRecommendation: "Answer with the tier comparison matrix and the install-time impact.",
    }),
    t("task_aisha_channel", BIZ1, "Try a different channel for Aisha Bello", {
      prospectId: "p_aisha",
      contactId: "ct_aisha",
      companyId: "co_mosaic",
      dueMinutes: -360,
      ownerId: "u_maria",
      type: "call",
      priority: "medium",
      reason: "Three unanswered touches across email and SMS.",
      aiRecommendation:
        "Switch to a phone attempt before 4pm; email engagement is zero but she opened the first send twice.",
      createdBy: "u_ava",
      createdByKind: "ai",
    }),
    t("task_liam_reschedule", BIZ1, "Reschedule Liam O'Connor's missed consult", {
      prospectId: "p_liam",
      contactId: "ct_liam",
      dueMinutes: -120,
      ownerId: "u_daniel",
      type: "schedule",
      priority: "high",
      reason: "Missed appointment yesterday with no notice.",
      aiRecommendation: "Offer two new slots and ask if the 2pm time is generally difficult.",
    }),
    // today / upcoming
    t("task_hannah_call", BIZ1, "Call Hannah Fischer at 4pm", {
      prospectId: "p_hannah",
      contactId: "ct_hannah",
      companyId: "co_redstone",
      dueMinutes: 210,
      ownerId: "u_priya",
      type: "call",
      priority: "high",
      reason: "She replied asking for a call at 4pm today.",
      aiRecommendation:
        "Lead with the family add-on numbers — that's the decision blocker she named.",
    }),
    t("task_karen_docs", BIZ2, "Document Karen Doyle's damage before Monday", {
      prospectId: "p_karen",
      contactId: "ct_karen",
      dueMinutes: 1_020,
      ownerId: "u_mer_ty",
      type: "follow_up",
      priority: "critical",
      reason: "Insurance adjuster moved the visit to Monday morning.",
      aiRecommendation:
        "Book the crew for tomorrow 9am and send photo documentation to the claim file.",
    }),
    t("task_priyanka_prep", BIZ1, "Prep Lumen walkthrough pack", {
      prospectId: "p_priyanka",
      contactId: "ct_priyanka",
      companyId: "co_lumen",
      dueMinutes: 1_440,
      ownerId: "u_priya",
      type: "document",
      priority: "high",
      reason: "Thursday 9:30am walkthrough with COO joining.",
      aiRecommendation:
        "Include outcomes data, network depth and the comparison criteria Julia sent.",
    }),
    t("task_tom_terms", BIZ1, "Respond to Summit's termination-clause objection", {
      prospectId: "p_tom",
      contactId: "ct_tom",
      companyId: "co_summit",
      dueMinutes: 300,
      ownerId: "u_daniel",
      type: "reply",
      priority: "high",
      reason: "Legal objection raised two days ago on an open proposal.",
      aiRecommendation:
        "Offer 60-day termination with 90-day notice — matches policy and unblocks legal.",
    }),
    t("task_dana_intake", BIZ1, "Finish XYZ Logistics intake with Dana", {
      prospectId: "p_dana",
      contactId: "ct_dana",
      companyId: "co_xyz",
      dueMinutes: 180,
      ownerId: "u_priya",
      type: "follow_up",
      priority: "high",
      reason: "Highest-value intake abandoned at 78%.",
      aiRecommendation:
        "Call to complete the site-addresses step live — the remaining questions take 4 minutes.",
      automationId: "auto_intake_chase",
    }),
    t("task_vincent_terms", BIZ2, "Countersign Plateau's 3% volume discount request", {
      prospectId: "p_vincent",
      contactId: "ct_vincent",
      companyId: "co_plateau",
      dueMinutes: 90,
      ownerId: "u_mer_ty",
      type: "follow_up",
      priority: "high",
      reason: "Prospect asked for volume discount and phased payments to sign this week.",
      aiRecommendation:
        "Approve 3% with a two-quarter phasing; margin still clears the target at 44%.",
    }),
    t("task_miguel_first_touch", BIZ2, "First outreach to Miguel Santos", {
      prospectId: "p_miguel",
      contactId: "ct_miguel",
      dueMinutes: 60,
      ownerId: "u_mer_lu",
      type: "call",
      priority: "medium",
      reason: "New inspection request, no contact yet.",
      aiRecommendation:
        "Call with two survey slots — 27-year-old roof is likely due for replacement.",
    }),
    t("task_omar_arabic", BIZ1, "Send Omar the Arabic plan comparison", {
      prospectId: "p_omar",
      contactId: "ct_omar",
      dueMinutes: 120,
      ownerId: "u_priya",
      type: "reply",
      priority: "high",
      reason: "Board deck due Friday; he asked for a localised comparison.",
      aiRecommendation:
        "Any language model can translate the summary; keep numbers in both currencies.",
    }),
    t("task_marcus_quote", BIZ1, "Quote Harbor Point — 45 staff", {
      prospectId: "p_marcus",
      contactId: "ct_marcus",
      companyId: "co_harbor",
      dueMinutes: -30,
      ownerId: "u_maria",
      type: "reply",
      priority: "high",
      reason: "First-response SLA of 1 hour breached on an inbound quote request.",
      aiRecommendation: "Send the small-team pricing sheet and offer a 15-minute call tomorrow.",
    }),
    t("task_elena_billing", BIZ1, "Answer Elena Costa on school-calendar billing", {
      prospectId: "p_elena",
      contactId: "ct_elena",
      companyId: "co_brightside",
      dueMinutes: 240,
      ownerId: "u_daniel",
      type: "reply",
      priority: "medium",
      reason: "Question received three hours ago; warm education-sector lead.",
      aiRecommendation: "Answer the billing mechanics and confirm there's no minimum enrolment.",
    }),
    t("task_greg_expansion", BIZ1, "Scope Ironwood preventive add-on for Temple site", {
      prospectId: "p_greg",
      contactId: "ct_greg",
      companyId: "co_ironwood",
      dueMinutes: 2 * 1_440,
      ownerId: "u_priya",
      type: "follow_up",
      priority: "medium",
      reason: "Post-sale expansion opportunity on a 890-employee account.",
      aiRecommendation:
        "Pricing the add-on at the standard tier adds $9.4k ARR with minimal implementation risk.",
      createdBy: "u_ava",
      createdByKind: "ai",
    }),
    t("task_angela_survey", BIZ2, "Confirm Redstone walkthrough logistics", {
      prospectId: "p_angela",
      contactId: "ct_angela",
      companyId: "co_redstone",
      dueMinutes: 780,
      ownerId: "u_mer_ty",
      type: "follow_up",
      priority: "high",
      reason: "8am site walk tomorrow across 12 properties.",
      aiRecommendation: "Send the survey checklist to Paul Ikeda so drone access is pre-approved.",
    }),
    t("task_david_ramp", BIZ1, "Send David Kim the ramp-cost model", {
      prospectId: "p_david",
      contactId: "ct_david",
      companyId: "co_summit",
      dueMinutes: 1_080,
      ownerId: "u_daniel",
      type: "document",
      priority: "medium",
      reason: "Finance director asked for onboarding ramp cost on 310 employees.",
      aiRecommendation: "One-page model; attach to the proposal thread so legal sees it too.",
    }),
    // completed
    t("task_greg_kickoff", BIZ1, "Ironwood kickoff call", {
      prospectId: "p_greg",
      contactId: "ct_greg",
      companyId: "co_ironwood",
      dueMinutes: -1_500,
      ownerId: "u_priya",
      type: "call",
      priority: "high",
      status: "completed",
      completedAt: new Date(now - 1_440 * 60_000).toISOString(),
      outcome: "Kickoff completed; two-plant rollout plan agreed.",
      reason: "Deal won — implementation kickoff.",
    }),
    t("task_vanessa_close", BIZ1, "Log Vanessa Ortiz as lost", {
      prospectId: "p_vanessa",
      contactId: "ct_vanessa",
      dueMinutes: -9 * 1_440,
      ownerId: "u_daniel",
      type: "review",
      priority: "low",
      status: "completed",
      completedAt: new Date(now - 9 * 1_440 * 60_000 + 90 * 60_000).toISOString(),
      outcome: "Lost on price. Re-engagement reminder set for 9 months.",
      reason: "Prospect declined after proposal.",
    }),
    t("task_steve_review", BIZ2, "Request a review from Steve Novak", {
      prospectId: "p_steve",
      contactId: "ct_steve",
      dueMinutes: -5 * 1_440,
      ownerId: "u_mer_ty",
      type: "follow_up",
      priority: "low",
      status: "completed",
      completedAt: new Date(now - 5 * 1_440 * 60_000 + 2 * 60 * 60_000).toISOString(),
      outcome: "5-star review received; two neighbour referrals logged.",
      reason: "Post-install follow-up on a won job.",
    }),
    t("task_nina_reminders", BIZ1, "Intake reminder run — 6 candidates", {
      ownerId: "u_nina",
      createdBy: "u_nina",
      createdByKind: "automation",
      type: "send_reminder",
      priority: "medium",
      status: "completed",
      dueMinutes: -20 * 60,
      completedAt: new Date(now - 19.5 * 3_600_000).toISOString(),
      outcome: "5 reminders sent, 2 intakes completed within the hour.",
      reason: "Scheduled autonomous reminder sweep for stalled intakes.",
      automationId: "auto_intake_chase",
    }),
    t("task_rex_dormant", BIZ1, "Re-engagement sweep — dormant over 14 days", {
      ownerId: "u_rex",
      createdBy: "u_rex",
      createdByKind: "automation",
      type: "follow_up",
      priority: "low",
      status: "snoozed",
      dueMinutes: 6 * 1_440,
      reason: "Rex paused after 3 low-confidence decisions; sweep awaiting re-enable.",
      automationId: "auto_reengage",
    }),
  ];
}

/* -------------------------------------------------------------------------- */
/* Appointments                                                                */
/* -------------------------------------------------------------------------- */

export function buildAppointments(now: number): Appointment[] {
  const a = (
    id: string,
    businessId: string,
    title: string,
    kind: Appointment["kind"],
    prospectId: string | undefined,
    contactId: string | undefined,
    companyId: string | undefined,
    ownerId: string,
    startMinutes: number,
    durationMinutes: number,
    status: Appointment["status"],
    createdBy = "u_ava",
    createdByKind: Appointment["scheduledByKind"] = "ai",
    aiPrep?: string,
    location?: string,
  ): Appointment => ({
    id,
    tenantId: TENANT,
    businessId,
    title,
    kind,
    prospectId,
    contactId,
    companyId,
    ownerId,
    startAt: new Date(now + startMinutes * 60_000).toISOString(),
    endAt: new Date(now + (startMinutes + durationMinutes) * 60_000).toISOString(),
    status,
    location,
    scheduledBy: createdBy,
    scheduledByKind: createdByKind,
    aiPrep,
    createdAt: new Date(now + (startMinutes - 4_320) * 60_000).toISOString(),
  });

  return [
    a(
      "appt_lumen",
      BIZ1,
      "Lumen Health Partners — network walkthrough",
      "meeting",
      "p_priyanka",
      "ct_priyanka",
      "co_lumen",
      "u_priya",
      1_530,
      60,
      "confirmed",
      "u_priya",
      "user",
      "Bring outcomes deck, provider map and the criteria matrix Julia sent. COO joins for the final 20 minutes.",
      "Northwind Studio — Boardroom",
    ),
    a(
      "appt_redstone",
      BIZ2,
      "Redstone portfolio roof survey",
      "site_visit",
      "p_angela",
      "ct_angela",
      "co_redstone",
      "u_mer_ty",
      900,
      180,
      "confirmed",
      "u_mer_ty",
      "user",
      "12 properties; start at 8am. Drone access pre-approved via Paul Ikeda.",
      "Denver — 12 properties",
    ),
    a(
      "appt_tom",
      BIZ1,
      "Summit Tech — legal terms call",
      "call",
      "p_tom",
      "ct_tom",
      "co_summit",
      "u_daniel",
      1_620,
      30,
      "scheduled",
      "u_ava",
      "ai",
      "Termination clause is the only open objection. Have the 60-day option priced.",
    ),
    a(
      "appt_karen",
      BIZ2,
      "Karen Doyle — pre-adjuster documentation",
      "site_visit",
      "p_karen",
      "ct_karen",
      undefined,
      "u_mer_ty",
      1_080,
      90,
      "scheduled",
      "u_mer_ty",
      "user",
      "Document damage before Monday's adjuster visit; photograph south slope and boots.",
    ),
    a(
      "appt_vanessa",
      BIZ1,
      "Vanessa Ortiz — renewal check-in",
      "call",
      "p_vanessa",
      "ct_vanessa",
      undefined,
      "u_daniel",
      60 * 24 * 120,
      20,
      "scheduled",
      "u_ava",
      "ai",
      "Scheduled 4 months out after the lost deal; budget cycle reopens then.",
    ),
    a(
      "appt_priyanka_prep",
      BIZ1,
      "Internal — Lumen deal review",
      "meeting",
      undefined,
      undefined,
      "co_lumen",
      "u_priya",
      240,
      45,
      "scheduled",
      "u_priya",
      "user",
      "Align pricing posture before Thursday.",
    ),
    a(
      "appt_rachel_done",
      BIZ1,
      "Rachel Nguyen — exam and x-rays",
      "consult",
      "p_rachel",
      "ct_rachel",
      undefined,
      "u_maria",
      -2 * 1_440,
      60,
      "completed",
      "u_maria",
      "user",
      undefined,
      "Northwind Studio — Chair 3",
    ),
    a(
      "appt_liam_missed",
      BIZ1,
      "Liam O'Connor — benefits consult",
      "consult",
      "p_liam",
      "ct_liam",
      undefined,
      "u_daniel",
      -26 * 60,
      45,
      "missed",
      "u_daniel",
      "user",
    ),
    a(
      "appt_steve_survey",
      BIZ2,
      "Steve Novak — site survey",
      "site_visit",
      "p_steve",
      "ct_steve",
      undefined,
      "u_mer_lu",
      -20 * 1_440,
      120,
      "completed",
      "u_mer_lu",
      "user",
    ),
    a(
      "appt_plateau_recce",
      BIZ2,
      "Plateau — Plateau Lodge re-roof recce",
      "site_visit",
      "p_vincent",
      "ct_vincent",
      "co_plateau",
      "u_mer_ty",
      3 * 1_440,
      240,
      "scheduled",
      "u_mer_ty",
      "user",
    ),
  ];
}

/* -------------------------------------------------------------------------- */
/* Deals & documents                                                           */
/* -------------------------------------------------------------------------- */

export function buildDeals(now: number, prospects: Prospect[]): Deal[] {
  const owned = new Set([
    "p_sarah",
    "p_michael",
    "p_john",
    "p_dana",
    "p_priyanka",
    "p_tom",
    "p_elena",
    "p_marcus",
    "p_aisha",
    "p_greg",
    "p_vanessa",
    "p_david",
    "p_rachel",
    "p_sofia",
    "p_liam",
    "p_hannah",
    "p_omar",
    "p_julia",
    "p_angela",
    "p_vincent",
    "p_derek",
    "p_wendy",
    "p_karen",
    "p_miguel",
    "p_tanya",
    "p_ray",
    "p_steve",
    "p_laura",
  ]);

  return prospects
    .filter((p) => owned.has(p.id))
    .map((p) => {
      const closed = p.state === "won" || p.state === "lost" || p.state === "customer";
      const probability = closed ? (p.state === "lost" ? 0 : 1) : stateProbability(p.state);
      return {
        id: `deal_${p.id.replace("p_", "")}`,
        tenantId: TENANT,
        businessId: p.businessId,
        prospectId: p.id,
        companyId: p.companyId,
        name: `${p.state === "customer" ? "Expansion" : "New business"} — ${p.value >= 40_000 ? "enterprise" : p.value >= 15_000 ? "mid-market" : "standard"} plan`,
        value: p.value,
        currency: "USD",
        state: p.state,
        probability,
        expectedCloseAt: new Date(now + (closed ? -3 : 21) * 86_400_000).toISOString(),
        ownerId: p.ownerId,
        closedAt: closed
          ? new Date(now - (p.id === "p_greg" ? 6 : 9) * 86_400_000).toISOString()
          : undefined,
        won:
          p.state === "won" || p.state === "customer"
            ? true
            : p.state === "lost"
              ? false
              : undefined,
        lostReason: p.state === "lost" ? "Lost on price to a lower-cost provider" : undefined,
        products:
          p.value >= 15_000
            ? [
                { name: "Core plan", value: Math.round(p.value * 0.72) },
                { name: "Preventive add-on", value: p.value - Math.round(p.value * 0.72) },
              ]
            : [{ name: "Core plan", value: p.value }],
        createdAt: new Date(now - 30 * 86_400_000).toISOString(),
        updatedAt: p.updatedAt ?? new Date(now).toISOString(),
      } satisfies Deal;
    });
}

function stateProbability(state: Prospect["state"]): number {
  const map: Record<string, number> = {
    new: 0.05,
    contacted: 0.12,
    engaged: 0.28,
    qualified: 0.45,
    appointment: 0.62,
    proposal: 0.72,
    negotiation: 0.84,
    won: 1,
    lost: 0,
    customer: 1,
  };
  return map[state] ?? 0.3;
}

export function buildDocuments(now: number): Document[] {
  const d = (
    id: string,
    businessId: string,
    name: string,
    kind: Document["kind"],
    prospectId: string | undefined,
    companyId: string | undefined,
    uploadedBy: string,
    uploadedByKind: Document["uploadedByKind"],
    minutesAgo: number,
    sizeKb: number,
    status?: Document["status"],
    viewedMinutesAgo?: number,
  ): Document => ({
    id,
    tenantId: TENANT,
    businessId,
    name,
    kind,
    prospectId,
    companyId,
    uploadedBy,
    uploadedByKind,
    createdAt: new Date(now - minutesAgo * 60_000).toISOString(),
    sizeKb,
    status,
    viewedAt: viewedMinutesAgo
      ? new Date(now - viewedMinutesAgo * 60_000).toISOString()
      : undefined,
    url: "#",
  });

  return [
    d(
      "doc_summit_proposal",
      BIZ1,
      "Northwind-Proposal-Summit.pdf",
      "proposal",
      "p_tom",
      "co_summit",
      "u_daniel",
      "user",
      3 * 1_440,
      1_240,
      "viewed",
      2 * 1_440,
    ),
    d(
      "doc_plateau_proposal",
      BIZ2,
      "Meridian-Proposal-Plateau.pdf",
      "proposal",
      "p_vincent",
      "co_plateau",
      "u_mer_ty",
      "user",
      8 * 1_440,
      2_100,
      "viewed",
      2 * 1_440,
    ),
    d(
      "doc_abc_plan",
      BIZ1,
      "Northwind-Corporate-Plan.pdf",
      "quote",
      "p_sarah",
      "co_abc",
      "u_daniel",
      "user",
      3 * 1_440,
      842,
      "viewed",
      2 * 1_440,
    ),
    d(
      "doc_ironwood_contract",
      BIZ1,
      "Ironwood-Signed-Contract.pdf",
      "contract",
      "p_greg",
      "co_ironwood",
      "u_priya",
      "user",
      6 * 1_440,
      3_400,
      "signed",
      6 * 1_440,
    ),
    d(
      "doc_meridian_cert",
      BIZ2,
      "Meridian-Insurance-Certificate.pdf",
      "other",
      undefined,
      "co_plateau",
      "u_mer_ty",
      "user",
      15 * 1_440,
      520,
      "sent",
    ),
    d(
      "doc_xyz_terms",
      BIZ1,
      "XYZ-Terms-Draft.docx",
      "contract",
      "p_dana",
      "co_xyz",
      "u_ava",
      "ai",
      2 * 1_440,
      410,
      "draft",
    ),
    d(
      "doc_novak_invoice",
      BIZ2,
      "Novak-Invoice-0012.pdf",
      "other",
      "p_steve",
      undefined,
      "u_mer_ty",
      "user",
      4 * 1_440,
      180,
      "sent",
    ),
    d(
      "doc_marquez_cost",
      BIZ1,
      "Marquez-Cost-Model.xlsx",
      "quote",
      "p_sofia",
      undefined,
      "u_ava",
      "ai",
      0,
      96,
      "draft",
    ),
    d(
      "doc_karen_photos",
      BIZ2,
      "Doyle-Damage-Photos.zip",
      "report",
      "p_karen",
      undefined,
      "u_mer_ty",
      "user",
      0,
      12_400,
      "draft",
    ),
  ];
}

/* -------------------------------------------------------------------------- */
/* Integrations                                                                */
/* -------------------------------------------------------------------------- */

export function buildIntegrations(now: number): Integration[] {
  const mk = (
    id: string,
    businessId: string,
    key: Integration["key"],
    name: string,
    category: Integration["category"],
    description: string,
    status: Integration["status"],
    capabilities: Integration["capabilities"],
    adapter: string,
    connectedMinutesAgo?: number,
    lastSyncMinutesAgo?: number,
    lastError?: string,
    eventsHandled?: number,
  ): Integration => ({
    id,
    tenantId: TENANT,
    businessId,
    key,
    name,
    category,
    description,
    status,
    capabilities,
    adapter,
    connectedBy: status === "disconnected" || status === "available" ? undefined : "u_alex",
    connectedAt: connectedMinutesAgo
      ? new Date(now - connectedMinutesAgo * 60_000).toISOString()
      : undefined,
    lastSyncAt: lastSyncMinutesAgo
      ? new Date(now - lastSyncMinutesAgo * 60_000).toISOString()
      : undefined,
    lastError,
    eventsHandled,
  });

  return [
    mk(
      "int_gmail",
      BIZ1,
      "gmail",
      "Gmail",
      "email",
      "Two-way email sync with thread-aware reply detection.",
      "connected",
      ["read_email", "send_email", "webhooks"],
      "adapters/email/gmail",
      60 * 24 * 180,
      3,
      undefined,
      18_420,
    ),
    mk(
      "int_gcal",
      BIZ1,
      "google_calendar",
      "Google Calendar",
      "calendar",
      "Appointment sync and AI scheduling.",
      "connected",
      ["read_calendar", "write_calendar", "webhooks"],
      "adapters/calendar/google",
      60 * 24 * 180,
      11,
      undefined,
      1_260,
    ),
    mk(
      "int_twilio",
      BIZ1,
      "twilio",
      "Twilio Voice & SMS",
      "telephony",
      "Inbound/outbound calls, voicemail, SMS and recordings.",
      "connected",
      ["read_calls", "place_calls", "read_sms", "send_sms", "webhooks"],
      "adapters/telephony/twilio",
      60 * 24 * 140,
      2,
      undefined,
      9_940,
    ),
    mk(
      "int_whatsapp",
      BIZ1,
      "whatsapp_business",
      "WhatsApp Business",
      "messaging",
      "WhatsApp Cloud API for two-way customer conversations.",
      "connected",
      ["read_whatsapp", "send_whatsapp", "webhooks"],
      "adapters/messaging/whatsapp",
      60 * 24 * 90,
      6,
      undefined,
      3_180,
    ),
    mk(
      "int_sheets",
      BIZ1,
      "google_sheets",
      "Google Sheets",
      "data",
      "Import and export business data as sheets.",
      "connected",
      ["import_contacts", "export_data"],
      "adapters/data/sheets",
      60 * 24 * 60,
      60 * 20,
      undefined,
      42,
    ),
    mk(
      "int_webforms",
      BIZ1,
      "webforms",
      "Website forms",
      "data",
      "Native web form capture with partial-submission tracking.",
      "connected",
      ["webhooks", "import_contacts"],
      "adapters/forms/webhook",
      60 * 24 * 200,
      1,
      undefined,
      6_740,
    ),
    mk(
      "int_openai",
      BIZ1,
      "openai",
      "Model provider — primary",
      "ai",
      "Powers classification, drafting, summarisation and research.",
      "connected",
      ["embeddings"],
      "adapters/ai/openai",
      60 * 24 * 180,
      1,
      undefined,
      121_500,
    ),
    mk(
      "int_slack",
      BIZ1,
      "slack",
      "Slack",
      "notifications",
      "Hot-prospect and approval alerts into a channel.",
      "connected",
      ["webhooks"],
      "adapters/notifications/slack",
      60 * 24 * 45,
      4,
      undefined,
      870,
    ),
    mk(
      "int_hubspot",
      BIZ1,
      "hubspot",
      "HubSpot",
      "crm",
      "Bi-directional contact and deal sync.",
      "error",
      ["import_contacts", "export_data"],
      "adapters/crm/hubspot",
      60 * 24 * 30,
      60 * 26,
      "OAuth token expired — reconnect to resume nightly contact sync.",
      1_204,
    ),
    mk(
      "int_outlook",
      BIZ1,
      "outlook",
      "Microsoft 365 / Outlook",
      "email",
      "Alternative email and calendar provider.",
      "available",
      ["read_email", "send_email", "read_calendar", "write_calendar"],
      "adapters/email/outlook",
    ),
    mk(
      "int_salesforce",
      BIZ1,
      "salesforce",
      "Salesforce",
      "crm",
      "Enterprise CRM sync for pipeline and accounts.",
      "available",
      ["import_contacts", "export_data"],
      "adapters/crm/salesforce",
    ),
    mk(
      "int_linkedin",
      BIZ1,
      "linkedin",
      "LinkedIn",
      "social",
      "Prospect research and social signal capture.",
      "available",
      ["import_contacts"],
      "adapters/social/linkedin",
    ),
    mk(
      "int_csv",
      BIZ1,
      "csv",
      "CSV import",
      "data",
      "Bulk import from any spreadsheet export.",
      "connected",
      ["import_contacts"],
      "adapters/data/csv",
      60 * 24 * 120,
      60 * 24 * 12,
      undefined,
      320,
    ),
    mk(
      "int_gmail_mer",
      BIZ2,
      "gmail",
      "Gmail",
      "email",
      "Two-way email sync for the Meridian inbox.",
      "connected",
      ["read_email", "send_email", "webhooks"],
      "adapters/email/gmail",
      60 * 24 * 200,
      9,
      undefined,
      7_310,
    ),
    mk(
      "int_twilio_mer",
      BIZ2,
      "twilio",
      "Twilio Voice & SMS",
      "telephony",
      "Call tracking and SMS for estimates.",
      "connected",
      ["read_calls", "place_calls", "send_sms"],
      "adapters/telephony/twilio",
      60 * 24 * 120,
      14,
      undefined,
      4_120,
    ),
    mk(
      "int_webforms_mer",
      BIZ2,
      "webforms",
      "Website forms",
      "data",
      "Storm-damage and inspection request capture.",
      "connected",
      ["webhooks", "import_contacts"],
      "adapters/forms/webhook",
      60 * 24 * 150,
      5,
      undefined,
      2_890,
    ),
    mk(
      "int_openai_mer",
      BIZ2,
      "anthropic",
      "Model provider — secondary",
      "ai",
      "Secondary provider used for long-form document analysis.",
      "available",
      ["embeddings"],
      "adapters/ai/anthropic",
    ),
  ];
}

/* -------------------------------------------------------------------------- */
/* Automations                                                                 */
/* -------------------------------------------------------------------------- */

export function buildAutomations(now: number): {
  automations: Automation[];
  runs: AutomationRun[];
} {
  const automations: Automation[] = [
    {
      id: "auto_hot_intent",
      tenantId: TENANT,
      businessId: BIZ1,
      name: "Hot intent response sprint",
      description:
        "When a high-intent reply lands, notify the owner, raise priority and draft a response for approval.",
      status: "active",
      trigger: "EMAIL_RECEIVED",
      conditions: [
        { id: "c1", field: "intent", operator: "equals", value: "high_intent", logic: "AND" },
      ],
      actions: [
        {
          id: "a1",
          type: "notify_manager",
          label: "Notify owner",
          params: { channel: "in_app" },
          requiresApproval: false,
        },
        {
          id: "a2",
          type: "update_priority",
          label: "Set priority to critical",
          params: { priority: "critical" },
          requiresApproval: false,
        },
        {
          id: "a3",
          type: "send_email",
          label: "Draft reply for approval",
          params: { template: "high_intent_reply" },
          requiresApproval: true,
        },
      ],
      runCount: 148,
      successCount: 141,
      failureCount: 2,
      lastRunAt: new Date(now - 10 * 60_000).toISOString(),
      createdBy: "u_alex",
      createdByKind: "user",
      createdAt: new Date(now - 120 * 86_400_000).toISOString(),
    },
    {
      id: "auto_missed_call",
      tenantId: TENANT,
      businessId: BIZ1,
      name: "Missed call callback",
      description:
        "Missed inbound call creates a same-hour callback task for the owner of the prospect.",
      status: "active",
      trigger: "CALL_MISSED",
      conditions: [
        { id: "c1", field: "priority", operator: "in", value: ["high", "critical"], logic: "AND" },
      ],
      actions: [
        {
          id: "a1",
          type: "create_task",
          label: "Create callback task (1h SLA)",
          params: { type: "call", sla: 60 },
          requiresApproval: false,
        },
        {
          id: "a2",
          type: "send_sms",
          label: "Send acknowledgement SMS",
          params: { template: "missed_call_ack" },
          requiresApproval: true,
        },
      ],
      runCount: 92,
      successCount: 88,
      failureCount: 4,
      lastRunAt: new Date(now - 14 * 60_000).toISOString(),
      createdBy: "u_priya",
      createdByKind: "user",
      createdAt: new Date(now - 96 * 86_400_000).toISOString(),
    },
    {
      id: "auto_intake_chase",
      tenantId: TENANT,
      businessId: BIZ1,
      name: "Chase incomplete high-value intakes",
      description:
        "Nina requests permission-free reminders for any intake over $10k stalled for 12 hours.",
      status: "active",
      trigger: "FORM_ABANDONED",
      conditions: [
        {
          id: "c1",
          field: "formStatus",
          operator: "in",
          value: ["partial", "abandoned"],
          logic: "AND",
        },
        { id: "c2", field: "value", operator: "greater_than", value: 10_000, logic: "AND" },
      ],
      actions: [
        {
          id: "a1",
          type: "send_intake_reminder",
          label: "Send reminder with resume link",
          params: { afterHours: 12 },
          requiresApproval: false,
        },
        {
          id: "a2",
          type: "create_task",
          label: "Task for account owner after 24h",
          params: { delayHours: 24 },
          requiresApproval: false,
        },
      ],
      runCount: 63,
      successCount: 61,
      failureCount: 0,
      lastRunAt: new Date(now - 2 * 60 * 60_000).toISOString(),
      createdBy: "u_nina",
      createdByKind: "ai",
      aiSuggested: true,
      createdAt: new Date(now - 40 * 86_400_000).toISOString(),
    },
    {
      id: "auto_overdue_followup",
      tenantId: TENANT,
      businessId: BIZ1,
      name: "Escalate overdue follow-ups",
      description: "Any follow-up more than 24 hours overdue escalates to the team manager.",
      status: "active",
      trigger: "TASK_OVERDUE",
      conditions: [
        {
          id: "c1",
          field: "timeSinceLastContactHours",
          operator: "greater_than",
          value: 24,
          logic: "AND",
        },
      ],
      actions: [
        {
          id: "a1",
          type: "notify_manager",
          label: "Notify manager",
          params: { escalation: "L1" },
          requiresApproval: false,
        },
        {
          id: "a2",
          type: "escalate",
          label: "Raise prospect priority",
          params: { priority: "high" },
          requiresApproval: false,
        },
      ],
      runCount: 37,
      successCount: 37,
      failureCount: 0,
      lastRunAt: new Date(now - 26 * 60 * 60_000).toISOString(),
      createdBy: "u_priya",
      createdByKind: "user",
      createdAt: new Date(now - 60 * 86_400_000).toISOString(),
    },
    {
      id: "auto_proposal_nudge",
      tenantId: TENANT,
      businessId: BIZ1,
      name: "Proposal viewed nudge",
      description:
        "Proposal opened twice within 48 hours triggers an AI-drafted follow-up for approval.",
      status: "paused",
      trigger: "PROPOSAL_VIEWED",
      conditions: [
        { id: "c1", field: "state", operator: "equals", value: "proposal", logic: "AND" },
      ],
      actions: [
        {
          id: "a1",
          type: "send_email",
          label: "Draft nudge email",
          params: { template: "proposal_nudge" },
          requiresApproval: true,
        },
      ],
      runCount: 22,
      successCount: 20,
      failureCount: 2,
      lastRunAt: new Date(now - 5 * 86_400_000).toISOString(),
      createdBy: "u_daniel",
      createdByKind: "user",
      createdAt: new Date(now - 30 * 86_400_000).toISOString(),
    },
    {
      id: "auto_reengage",
      tenantId: TENANT,
      businessId: BIZ1,
      name: "Dormant re-engagement sweep",
      description: "Weekly sweep of prospects untouched for 14 days with no reply.",
      status: "draft",
      trigger: "TASK_CREATED",
      conditions: [
        {
          id: "c1",
          field: "timeSinceLastContactHours",
          operator: "greater_than",
          value: 336,
          logic: "AND",
        },
        {
          id: "c2",
          field: "intent",
          operator: "not_in",
          value: ["unsubscribe", "not_interested"],
          logic: "AND",
        },
      ],
      actions: [
        {
          id: "a1",
          type: "create_task",
          label: "Create re-engagement task",
          params: { type: "follow_up" },
          requiresApproval: false,
        },
        {
          id: "a2",
          type: "send_email",
          label: "Send sequence step 1",
          params: { template: "reengage_1" },
          requiresApproval: true,
        },
      ],
      runCount: 0,
      successCount: 0,
      failureCount: 0,
      createdBy: "u_rex",
      createdByKind: "ai",
      aiSuggested: true,
      createdAt: new Date(now - 12 * 86_400_000).toISOString(),
    },
    {
      id: "auto_storm_urgent",
      tenantId: TENANT,
      businessId: BIZ2,
      name: "Storm damage fast-track",
      description:
        "Hail claim intakes with an adjuster visit inside 5 days are pushed to critical and scheduled immediately.",
      status: "active",
      trigger: "FORM_COMPLETED",
      conditions: [
        { id: "c1", field: "tag", operator: "contains", value: "insurance claim", logic: "AND" },
        { id: "c2", field: "priority", operator: "not_in", value: ["low"], logic: "AND" },
      ],
      actions: [
        {
          id: "a1",
          type: "update_priority",
          label: "Set priority to critical",
          params: { priority: "critical" },
          requiresApproval: false,
        },
        {
          id: "a2",
          type: "schedule_follow_up",
          label: "Book documentation visit",
          params: { withinHours: 24 },
          requiresApproval: true,
        },
      ],
      runCount: 41,
      successCount: 40,
      failureCount: 1,
      lastRunAt: new Date(now - 40 * 60_000).toISOString(),
      createdBy: "u_mer_ty",
      createdByKind: "user",
      createdAt: new Date(now - 55 * 86_400_000).toISOString(),
    },
  ];

  const runs: AutomationRun[] = [
    {
      id: "run_1",
      tenantId: TENANT,
      businessId: BIZ1,
      automationId: "auto_hot_intent",
      eventId: "evt_seed_sarah",
      prospectId: "p_sarah",
      status: "success",
      detail: "Notified Daniel Okafor, priority set to critical, reply drafted for approval.",
      startedAt: new Date(now - 10 * 60_000).toISOString(),
      finishedAt: new Date(now - 9.7 * 60_000).toISOString(),
    },
    {
      id: "run_2",
      tenantId: TENANT,
      businessId: BIZ1,
      automationId: "auto_missed_call",
      eventId: "evt_seed_michael",
      prospectId: "p_michael",
      status: "success",
      detail: "Callback task created (1h SLA); acknowledgement SMS queued for approval.",
      startedAt: new Date(now - 13 * 60_000).toISOString(),
      finishedAt: new Date(now - 12.8 * 60_000).toISOString(),
    },
    {
      id: "run_3",
      tenantId: TENANT,
      businessId: BIZ1,
      automationId: "auto_intake_chase",
      eventId: "evt_seed_dana",
      prospectId: "p_dana",
      status: "success",
      detail: "Reminder sent by Nina; task raised for account owner at +24h.",
      startedAt: new Date(now - 2 * 60 * 60_000).toISOString(),
      finishedAt: new Date(now - 119 * 60_000).toISOString(),
    },
    {
      id: "run_4",
      tenantId: TENANT,
      businessId: BIZ2,
      automationId: "auto_storm_urgent",
      eventId: "evt_seed_karen",
      prospectId: "p_karen",
      status: "success",
      detail: "Priority raised to critical; documentation visit proposed for tomorrow 9am.",
      startedAt: new Date(now - 40 * 60_000).toISOString(),
      finishedAt: new Date(now - 39 * 60_000).toISOString(),
    },
    {
      id: "run_5",
      tenantId: TENANT,
      businessId: BIZ1,
      automationId: "auto_hot_intent",
      eventId: "evt_seed_fail",
      prospectId: "p_hannah",
      status: "failed",
      detail: "Gmail reply-send failed: rate limit from provider. Draft retained in AI Activity.",
      startedAt: new Date(now - 25 * 60_000).toISOString(),
      finishedAt: new Date(now - 24.5 * 60_000).toISOString(),
    },
    {
      id: "run_6",
      tenantId: TENANT,
      businessId: BIZ1,
      automationId: "auto_proposal_nudge",
      eventId: "evt_seed_tom",
      prospectId: "p_tom",
      status: "skipped",
      detail: "Automation paused by Priya Shah — skipped proposal nudge for Summit.",
      startedAt: new Date(now - 5 * 86_400_000).toISOString(),
      finishedAt: new Date(now - 5 * 86_400_000).toISOString(),
    },
  ];

  return { automations, runs };
}

/* -------------------------------------------------------------------------- */
/* AI insights, actions, notifications                                         */
/* -------------------------------------------------------------------------- */

export function buildInsights(now: number): AIInsight[] {
  const i = (
    id: string,
    businessId: string,
    kind: AIInsight["kind"],
    title: string,
    body: string,
    bullets: string[] | undefined,
    confidence: number,
    minutesAgo: number,
    prospectId?: string,
    companyId?: string,
  ): AIInsight => ({
    id,
    tenantId: TENANT,
    businessId,
    kind,
    title,
    body,
    bullets,
    confidence,
    model: "lead-intel/reasoner-1",
    createdAt: new Date(now - minutesAgo * 60_000).toISOString(),
    prospectId,
    companyId,
  });

  return [
    i(
      "ins_daily",
      BIZ1,
      "daily_summary",
      "Daily business summary",
      "12 new leads arrived today. 3 responded. 2 are currently high-intent. 4 follow-ups are overdue. 1 high-value prospect has not completed intake. Your most important action is responding to Sarah Williams at ABC Legal Group — she asked for Thursday or Friday and wants her office manager on the call.",
      [
        "12 new leads today, up 20% on yesterday",
        "3 responses, all classified high-intent or scheduling",
        "4 follow-ups overdue (2 in the last 24 hours)",
        "1 high-value intake stalled at 78% — XYZ Logistics, $24k",
        "2 appointments scheduled for tomorrow",
      ],
      0.86,
      6,
    ),
    i(
      "ins_sarah",
      BIZ1,
      "prospect_summary",
      "Sarah Williams — why she is priority #1",
      "Sarah is the highest-signal prospect in the pipeline right now: a referral, engaged across two channels, and she replied 8 minutes ago naming specific days. The decision criteria she volunteered (preventive add-on, 40 staff) map exactly to the corporate plan you already sent twice.",
      [
        "Response latency to date averages 34 minutes — she is actively at her desk",
        "Second decision maker identified: Nadia Rahman, Office Manager",
        "Recommended: reply within the hour with Thursday 10:00 and Friday 09:30",
      ],
      0.91,
      5,
      "p_sarah",
      "co_abc",
    ),
    i(
      "ins_xyz",
      BIZ1,
      "risk",
      "XYZ Logistics intake will go cold today",
      "Dana Whitfield stopped the multi-site intake at 78% two days ago. Historically, intakes abandoned beyond 48 hours complete at 12% instead of 64%. This is the largest open opportunity in the business.",
      [
        "Offer to complete the site-addresses step on a 10-minute call",
        "The remaining questions are procedural, not commercial",
        "Value estimate $24,000 — highest open opportunity",
      ],
      0.78,
      45,
      "p_dana",
      "co_xyz",
    ),
    i(
      "ins_meridian",
      BIZ2,
      "opportunity",
      "Storm season is generating 3x inspection demand",
      "Inspection requests in the last 7 days are 3.1x the trailing average, and 62% of them are hail-related with adjuster visits inside 5 days. Response time is the deciding factor in this category.",
      [
        "Critically urgent: Karen Doyle (adjuster moved to Monday)",
        "Redstone portfolio survey tomorrow — $58k, largest open deal",
        "Consider adding weekend survey capacity while the window is open",
      ],
      0.83,
      20,
    ),
    i(
      "ins_booking",
      BIZ1,
      "coaching",
      "You are losing time on your fastest segment",
      "Inbound website leads are answered in a median of 3.4 hours, but leads answered within 15 minutes convert 2.6x more often. Three of today's leads are still untouched.",
      [
        "Marcus Reed: 2h 08m untimed out, SLA is 1 hour",
        "Sofia Marquez: 40 minutes, unassigned response",
        "Enable the 'inbound sprint' automation for website forms",
      ],
      0.74,
      30,
    ),
    i(
      "ins_forecast",
      BIZ1,
      "forecast",
      "Quarter forecast: $186k weighted pipeline",
      "Weighted pipeline sits at $186k against a $150k target, with Lumen Health Partners ($46k) and Ironwood expansion ($62k) carrying most of the weight.",
      [
        "Ironwood closed at $62k — largest win this quarter",
        "Summit Tech at risk: legal objection open for 2 days",
        "Ironwood preventive add-on adds $9.4k ARR",
      ],
      0.69,
      120,
    ),
    i(
      "ins_automation",
      BIZ1,
      "automation_suggestion",
      "Suggested automation: unassigned website leads",
      "Three inbound website leads were never acknowledged within SLA this week. All three followed the same pattern: form completion outside working hours, no owner assigned until the next morning.",
      [
        "WHEN FORM_COMPLETED, IF source = website_form, THEN notify owner + create 15-minute call task",
        "Would have caught Marcus Reed and Sofia Marquez",
        "Nina already handles the corporate intake variant",
      ],
      0.72,
      60,
    ),
  ];
}

export function buildActions(now: number): AIAction[] {
  const a = (
    id: string,
    businessId: string,
    type: AIAction["type"],
    status: AIAction["status"],
    title: string,
    rationale: string,
    expectedOutcome: string,
    confidence: number,
    minutesAgo: number,
    opts: Partial<AIAction> = {},
  ): AIAction => ({
    id,
    tenantId: TENANT,
    businessId,
    type,
    status,
    title,
    rationale,
    expectedOutcome,
    confidence,
    agentId: opts.agentId ?? "agent_ava",
    prospectId: opts.prospectId,
    contactId: opts.contactId,
    companyId: opts.companyId,
    approvedBy: opts.approvedBy,
    autonomyUsed: opts.autonomyUsed ?? "approve",
    payload: opts.payload ?? {},
    draft: opts.draft,
    createdAt: new Date(now - minutesAgo * 60_000).toISOString(),
    executedAt: opts.executedAt,
    result: opts.result,
    revertible: opts.revertible ?? true,
    revertedAt: opts.revertedAt,
    undo: opts.undo,
    automationId: opts.automationId,
    insightId: opts.insightId,
    taskId: opts.taskId,
  });

  return [
    a(
      "act_sarah_draft",
      BIZ1,
      "send_email",
      "awaiting_approval",
      "Reply to Sarah Williams with two proposed slots",
      "High-intent response naming Thursday/Friday. Response latency is the strongest predictor of conversion in this segment (34-minute median for this prospect).",
      "Book the walkthrough this week and include the office manager — expected to move ABC Legal to Appointment with 62% close probability.",
      0.93,
      6,
      {
        prospectId: "p_sarah",
        contactId: "ct_sarah",
        companyId: "co_abc",
        taskId: "task_sarah_reply",
        automationId: "auto_hot_intent",
        payload: {
          channel: "email",
          to: "sarah.williams@abclegal.com",
          subject: "Thursday 10:00 or Friday 09:30 — 20-minute walkthrough",
        },
        draft:
          "Hi Sarah,\n\nGreat to hear the preventive add-on matters to your team — it's usually the deciding factor for a 40-person group.\n\nI can hold two slots for a 20-minute walkthrough:\n• Thursday 10:00–10:20\n• Friday 09:30–09:50\n\nBoth work for Nadia if you'd like her on the call. I'll bring the onboarded timeline, claims handling and the cost-per-employee breakdown so you can compare it side by side.\n\nWhich suits you better?\n\nDaniel",
        undo: { entity: "communication", id: "draft", patch: {} },
      },
    ),
    a(
      "act_michael_callback",
      BIZ1,
      "place_call",
      "proposed",
      "Call Michael Osei back now",
      "Inbound call missed 14 minutes ago from a $18.5k qualified prospect who is waiting on a contract review before month end.",
      "Reach him inside the hour; he converts quickly when picked up on the first attempt.",
      0.88,
      13,
      {
        prospectId: "p_michael",
        contactId: "ct_michael",
        companyId: "co_riverbend",
        automationId: "auto_missed_call",
        payload: { phone: "+1 (512) 555-0164", sla: "1 hour" },
      },
    ),
    a(
      "act_dana_reminder",
      BIZ1,
      "send_intake_reminder",
      "executed",
      "Intake reminder sent to Dana Whitfield",
      "XL Logistics intake stalled at 78% for 12 hours; automation threshold met and Nina's confidence exceeded the 0.8 floor.",
      "Recover a 48-hour window; historically lifts completion from 12% to 64%.",
      0.84,
      120,
      {
        prospectId: "p_dana",
        contactId: "ct_dana",
        companyId: "co_xyz",
        agentId: "agent_nina",
        autonomyUsed: "autonomous",
        automationId: "auto_intake_chase",
        taskId: "task_dana_intake",
        executedAt: new Date(now - 118 * 60_000).toISOString(),
        result: "Reminder delivered, opened 40 minutes later. Intake still incomplete.",
        payload: { channel: "email", to: "dana.whitfield@xyzlogistics.com", attempt: 2 },
      },
    ),
    a(
      "act_tom_state",
      BIZ1,
      "update_pipeline_state",
      "executed",
      "Moved Summit Tech Collective to Negotiation",
      "Legal objection on termination clause signals commercial discussion beyond initial review.",
      "Keeps forecast accuracy; negotiation probability is 0.84 vs 0.72 for proposal.",
      0.81,
      300,
      {
        prospectId: "p_tom",
        companyId: "co_summit",
        autonomyUsed: "autonomous",
        executedAt: new Date(now - 299 * 60_000).toISOString(),
        result: "State changed proposal → negotiation and audit entry written.",
        undo: { entity: "prospect", id: "p_tom", patch: { state: "proposal" } },
        payload: { from: "proposal", to: "negotiation" },
      },
    ),
    a(
      "act_karen_priority",
      BIZ2,
      "update_priority",
      "executed",
      "Raised Karen Doyle to critical priority",
      "Insurance adjuster moved the visit to Monday; documentation window closes in under 48 hours.",
      "Protects a $21k job where timing decides who gets the work.",
      0.9,
      38,
      {
        prospectId: "p_karen",
        agentId: "agent_meridian",
        autonomyUsed: "autonomous",
        automationId: "auto_storm_urgent",
        executedAt: new Date(now - 37 * 60_000).toISOString(),
        result: "Priority critical, task created for tomorrow 9am documentation.",
        undo: { entity: "prospect", id: "p_karen", patch: { priority: "high" } },
        payload: { from: "high", to: "critical" },
      },
    ),
    a(
      "act_hannah_task",
      BIZ1,
      "create_task",
      "executed",
      "Created 4pm callback task for Hannah Fischer",
      "Inbound SMS explicitly requested a call at 4pm today.",
      "Same-day callback on an explicit request; family add-on is the decision blocker.",
      0.95,
      24,
      {
        prospectId: "p_hannah",
        contactId: "ct_hannah",
        companyId: "co_redstone",
        autonomyUsed: "autonomous",
        taskId: "task_hannah_call",
        executedAt: new Date(now - 23 * 60_000).toISOString(),
        result: "Task assigned to Priya Shah for 4pm.",
        undo: { entity: "task", id: "task_hannah_call", patch: { status: "cancelled" } },
      },
    ),
    a(
      "act_marcus_assign",
      BIZ1,
      "assign_owner",
      "executed",
      "Assigned Marcus Reed to Maria Chen",
      "Inbound website lead with no owner for over 2 hours; Harbor Point matches Maria's small-team book.",
      "Prevents SLA breach cascading into a lost inbound lead.",
      0.79,
      100,
      {
        prospectId: "p_marcus",
        contactId: "ct_marcus",
        companyId: "co_harbor",
        autonomyUsed: "autonomous",
        executedAt: new Date(now - 99 * 60_000).toISOString(),
        result: "Owner set to Maria Chen; quote task created.",
        undo: { entity: "prospect", id: "p_marcus", patch: { ownerId: "u_daniel" } },
      },
    ),
    a(
      "act_overdue_escalate",
      BIZ1,
      "escalate",
      "executed",
      "Escalated 4 overdue follow-ups to Priya Shah",
      "Follow-up SLA breached across four prospects; automation raised an L1 escalation.",
      "Manager visibility into the two oldest breaches within the same hour.",
      0.76,
      26 * 60,
      {
        autonomyUsed: "autonomous",
        automationId: "auto_overdue_followup",
        executedAt: new Date(now - 25.9 * 3_600_000).toISOString(),
        result: "Slack digest sent; two follow-ups completed within 3 hours.",
      },
    ),
    a(
      "act_elena_review",
      BIZ1,
      "send_email",
      "proposed",
      "Answer Elena Costa's billing question and confirm no minimum enrolment",
      "Direct product question on a warm education lead; unanswered questions historically halve reply rates after 48 hours.",
      "Keeps a $12k education account moving into qualification.",
      0.85,
      90,
      {
        prospectId: "p_elena",
        contactId: "ct_elena",
        companyId: "co_brightside",
        payload: { channel: "email", to: "elena.costa@brightsideacademy.org" },
        draft:
          "Hi Elena,\n\nBilling follows the academic calendar: invoices are raised termly against the same annual premium, so your budget profile stays flat across the year. There's no minimum enrolment — part-time staff enrol individually and we can add them mid-term.\n\nHappy to jump on a 15-minute call if it's easier to walk through with your bursar.\n\nDaniel",
      },
    ),
    a(
      "act_tanya_state",
      BIZ2,
      "update_pipeline_state",
      "awaiting_approval",
      "Move Tanya Brooks back to Engaged",
      "Warranty question unanswered for 5 days; the prospect has not disengaged and warrants closer tracking.",
      "Corrects a stale state so reporting reflects real intent.",
      0.68,
      200,
      {
        prospectId: "p_tanya",
        companyId: "co_canyon",
        payload: { from: "qualified", to: "engaged" },
      },
    ),
    a(
      "act_marcus_sms",
      BIZ1,
      "send_sms",
      "rejected",
      "Send SMS nudge to Marcus Reed",
      "Inbound lead untouched past SLA.",
      "Would have sped up contact but email was the preferred channel recorded at intake.",
      0.61,
      95,
      {
        prospectId: "p_marcus",
        approvedBy: "u_maria",
        result: "Rejected by Maria Chen — prefers a call for broker leads.",
      },
    ),
    a(
      "act_rex_paused",
      BIZ1,
      "send_email",
      "reverted",
      "Re-engagement email to Aisha Bello",
      "Three unanswered touches; Rex proposed switching back to email.",
      "Low confidence attempt at re-engagement.",
      0.58,
      30 * 60,
      {
        prospectId: "p_aisha",
        agentId: "agent_rex",
        autonomyUsed: "autonomous",
        approvedBy: "u_priya",
        executedAt: new Date(now - 29.9 * 3_600_000).toISOString(),
        revertedAt: new Date(now - 29 * 3_600_000).toISOString(),
        result: "Reverted within minutes; Rex suspended pending a confidence review.",
        undo: { entity: "communication", id: "com_reverted", patch: { status: "cancelled" } },
      },
    ),
    a(
      "act_xyz_terms",
      BIZ1,
      "draft_proposal",
      "proposed",
      "Draft commercial terms for XYZ Logistics",
      "Largest open opportunity ($24k) and the intake is stuck; a terms draft lets the deal progress while intake completes.",
      "Shortens the path to proposal by an estimated 6 days.",
      0.71,
      150,
      { prospectId: "p_dana", companyId: "co_xyz", payload: { template: "multi_site_terms" } },
    ),
    a(
      "act_omar_escalate",
      BIZ1,
      "notify_manager",
      "executed",
      "Flagged Omar Haddad's Friday board deadline to Priya Shah",
      "Language-specific asset requested with a hard deadline in 3 days; needs a human decision on localisation effort.",
      "Avoids a missed Friday deadline on a cross-border $15.6k opportunity.",
      0.82,
      40,
      {
        prospectId: "p_omar",
        contactId: "ct_omar",
        autonomyUsed: "autonomous",
        executedAt: new Date(now - 39 * 60_000).toISOString(),
        result: "Priya notified; translation task created for Thursday.",
      },
    ),
  ];
}

export function buildNotifications(now: number): Notification[] {
  const n = (
    id: string,
    businessId: string,
    kind: Notification["kind"],
    title: string,
    body: string,
    priority: Notification["priority"],
    minutesAgo: number,
    opts: Partial<Notification> = {},
  ): Notification => ({
    id,
    tenantId: TENANT,
    businessId,
    kind,
    title,
    body,
    priority,
    createdAt: new Date(now - minutesAgo * 60_000).toISOString(),
    readAt: opts.readAt,
    prospectId: opts.prospectId,
    actionLabel: opts.actionLabel,
    actionHref: opts.actionHref,
    actorKind: opts.actorKind ?? "ai",
  });

  return [
    n(
      "ntf_1",
      BIZ1,
      "new_response",
      "Sarah Williams replied — high intent",
      "Asked for Thursday or Friday and wants her office manager on the call.",
      "critical",
      8,
      {
        prospectId: "p_sarah",
        actionLabel: "Review reply",
        actionHref: "/ai-activity",
        actorKind: "ai",
      },
    ),
    n(
      "ntf_2",
      BIZ1,
      "missed_call",
      "Missed call — Michael Osei",
      "Riverbend Property Group called 14 minutes ago. Callback SLA is 1 hour.",
      "critical",
      14,
      { prospectId: "p_michael", actionLabel: "Call back", actionHref: "/prospects/p_michael" },
    ),
    n(
      "ntf_3",
      BIZ1,
      "follow_up_overdue",
      "4 follow-ups are overdue",
      "Two breached in the last 24 hours. Oldest is John Whitaker (1 day).",
      "high",
      90,
      { actionLabel: "Open tasks", actionHref: "/tasks" },
    ),
    n(
      "ntf_4",
      BIZ1,
      "form_incomplete",
      "XYZ Logistics intake stalled at 78%",
      "Largest open opportunity ($24k). Nina sent a reminder 2 hours ago.",
      "high",
      120,
      { prospectId: "p_dana", actionLabel: "Open intake", actionHref: "/forms", actorKind: "ai" },
    ),
    n(
      "ntf_5",
      BIZ1,
      "ai_action",
      "1 AI action needs your approval",
      "Reply to Sarah Williams is drafted and waiting for approval.",
      "critical",
      6,
      { prospectId: "p_sarah", actionLabel: "Approve", actionHref: "/ai-activity" },
    ),
    n(
      "ntf_6",
      BIZ1,
      "automation_failure",
      "Automation failed: Hot intent response sprint",
      "Gmail send failed on Hannah Fischer's draft (provider rate limit). Draft retained.",
      "high",
      25,
      { actionLabel: "Review run", actionHref: "/automations", actorKind: "system" },
    ),
    n(
      "ntf_7",
      BIZ1,
      "integration_issue",
      "HubSpot connection expired",
      "OAuth token expired 26 hours ago — nightly contact sync is paused.",
      "high",
      60 * 26,
      { actionLabel: "Reconnect", actionHref: "/integrations", actorKind: "system" },
    ),
    n(
      "ntf_8",
      BIZ2,
      "new_response",
      "Karen Doyle — adjuster moved to Monday",
      "Documentation visit needed tomorrow. $21k job, timing decides the outcome.",
      "critical",
      12,
      { prospectId: "p_karen", actionLabel: "Open prospect", actionHref: "/prospects/p_karen" },
    ),
    n(
      "ntf_9",
      BIZ1,
      "hot_prospect",
      "New hot prospect: Sofia Marquez (76)",
      "Quote request 40 minutes ago asking for per-employee pricing.",
      "high",
      40,
      { prospectId: "p_sofia", actionLabel: "Reply", actionHref: "/prospects/p_sofia" },
    ),
    n(
      "ntf_10",
      BIZ1,
      "appointment",
      "Lumen walkthrough is tomorrow 9:30am",
      "COO joining for the final 20 minutes. Prep pack due today.",
      "medium",
      180,
      { prospectId: "p_priyanka", actionLabel: "Prep", actionHref: "/calendar" },
    ),
    n(
      "ntf_11",
      BIZ2,
      "opportunity",
      "Redstone portfolio survey tomorrow at 8am",
      "12 properties. Drone access approved via Paul Ikeda.",
      "high",
      240,
      { prospectId: "p_angela", actionLabel: "Open", actionHref: "/prospects/p_angela" },
    ),
    n(
      "ntf_12",
      BIZ1,
      "hot_prospect",
      "Priyanka Raman confirmed Thursday 9:30am",
      "Enterprise $46k opportunity with executive sponsor joining.",
      "medium",
      30 * 24,
      {
        prospectId: "p_priyanka",
        readAt: new Date(now - 30 * 24 * 60 * 60_000 + 3_600_000).toISOString(),
      },
    ),
  ];
}

/* -------------------------------------------------------------------------- */
/* Events + audit — derived from every other record                            */
/* -------------------------------------------------------------------------- */

const CHANNEL_EVENT: Record<Channel, { in: EventType; out: EventType }> = {
  email: { in: "EMAIL_RECEIVED", out: "EMAIL_SENT" },
  call: { in: "CALL_RECEIVED", out: "CALL_COMPLETED" },
  sms: { in: "SMS_RECEIVED", out: "SMS_SENT" },
  whatsapp: { in: "WHATSAPP_RECEIVED", out: "WHATSAPP_SENT" },
  form: { in: "FORM_COMPLETED", out: "FORM_COMPLETED" },
  webchat: { in: "FORM_COMPLETED", out: "EMAIL_SENT" },
  linkedin: { in: "EMAIL_RECEIVED", out: "EMAIL_SENT" },
  meeting: { in: "APPOINTMENT_CREATED", out: "APPOINTMENT_CREATED" },
};

function eventSummary(c: Communication): string {
  const who = c.direction === "inbound" ? "from contact" : "to contact";
  switch (c.channel) {
    case "email":
      return c.status === "opened"
        ? `Email opened by contact`
        : `Email ${c.direction === "inbound" ? "received" : "sent"} ${who}`;
    case "call":
      if (c.status === "missed") return "Inbound call missed";
      return c.direction === "inbound" ? "Inbound call received" : "Outbound call completed";
    case "sms":
      return `SMS ${c.direction === "inbound" ? "received" : "sent"}`;
    case "whatsapp":
      return `WhatsApp ${c.direction === "inbound" ? "received" : "sent"}`;
    case "form":
      return c.direction === "inbound" ? "Form submitted" : "Form reminder sent";
    case "meeting":
      return c.status === "received" ? "Appointment missed" : "Appointment activity";
    default:
      return `${c.channel} activity`;
  }
}

export interface OpsBundle {
  tasks: Task[];
  appointments: Appointment[];
  forms: IntakeForm[];
  submissions: FormSubmission[];
  deals: Deal[];
  documents: Document[];
  automations: Automation[];
  runs: AutomationRun[];
  insights: AIInsight[];
  actions: AIAction[];
  notifications: Notification[];
  integrations: Integration[];
}

export function buildEventsAndAudit(
  now: number,
  prospects: Prospect[],
  communications: Communication[],
  ops: OpsBundle,
): { events: DomainEvent[]; audit: AuditLogEntry[] } {
  const events: DomainEvent[] = [];
  const audit: AuditLogEntry[] = [];
  let evt = 0;
  let aud = 0;

  const push = (e: Omit<DomainEvent, "id">) => {
    events.push({ id: `evt_${String(evt++).padStart(5, "0")}`, ...e });
  };
  const auditPush = (a: Omit<AuditLogEntry, "id">) => {
    audit.push({ id: `aud_${String(aud++).padStart(5, "0")}`, ...a });
  };

  // Lead creation events
  for (const p of prospects) {
    push({
      type: p.source === "csv_import" ? "LEAD_IMPORTED" : "LEAD_CREATED",
      tenantId: p.tenantId,
      businessId: p.businessId,
      prospectId: p.id,
      contactId: p.contactId,
      companyId: p.companyId,
      actorId: p.source === "csv_import" ? "u_alex" : "system",
      actorKind: p.source === "csv_import" ? "user" : "integration",
      channel: undefined,
      occurredAt: p.createdAt,
      summary: `Lead created from ${p.source.replace(/_/g, " ")}`,
      detail: `Initial AI classification: ${p.intent.replace(/_/g, " ")}.`,
      automationEligible: true,
      processedBy: ["enrichment", "scoring", "priority"],
      effects: [{ kind: "score", label: "Initial score computed" }],
    });
  }

  // Communication events + AI enrichment effects
  for (const c of communications) {
    const map = CHANNEL_EVENT[c.channel];
    let type: EventType = c.direction === "inbound" ? map.in : map.out;
    if (c.channel === "call" && c.status === "missed") type = "CALL_MISSED";
    if (c.channel === "email" && c.direction === "outbound" && c.status === "opened")
      type = "EMAIL_OPENED";
    if (c.channel === "meeting" && c.status === "received") type = "APPOINTMENT_MISSED";
    if (c.channel === "form" && c.direction === "outbound") type = "FORM_REMINDER_SENT";

    const effects: EventEffect[] = [];
    if (c.enrichment?.intent) {
      effects.push({
        kind: "intent",
        label: `Classified as ${c.enrichment.intent.replace(/_/g, " ")}`,
        detail: `${Math.round(c.enrichment.intentConfidence * 100)}% confidence`,
        delta: undefined,
      });
    }
    if (c.direction === "inbound" && c.enrichment?.intent === "high_intent") {
      effects.push({
        kind: "score",
        label: "Lead score increased",
        detail: "+12 from recent response and intent strength",
        delta: 12,
      });
      effects.push({ kind: "priority", label: "Priority raised to critical" });
      effects.push({ kind: "state", label: "Pipeline state re-evaluated" });
      effects.push({ kind: "task", label: "Follow-up task created" });
      effects.push({ kind: "action", label: "Reply drafted for approval" });
    }

    push({
      type,
      tenantId: c.tenantId,
      businessId: c.businessId,
      prospectId: c.prospectId,
      contactId: c.contactId,
      companyId: c.companyId,
      actorId: c.actorId,
      actorKind: c.actorKind,
      channel: c.channel,
      occurredAt: c.occurredAt,
      summary: eventSummary(c),
      detail: c.enrichment?.summary,
      payload: {
        status: c.status,
        direction: c.direction,
        intent: c.enrichment?.intent,
        duration: c.call?.durationSeconds,
      },
      effects: effects.length ? effects : undefined,
      automationEligible: c.direction === "inbound",
      processedBy: [
        "enrichment",
        "scoring",
        ...(c.direction === "inbound" ? ["priority", "recommendation", "automation"] : []),
      ],
    });

    if (c.enrichment && c.direction === "inbound") {
      auditPush({
        tenantId: c.tenantId,
        businessId: c.businessId,
        actorId: "agent_ava",
        actorKind: "ai",
        actorName: "Ava",
        action: "classification",
        targetType: "communication",
        targetId: c.id,
        targetLabel: `${c.channel} from contact`,
        newState: {
          intent: c.enrichment.intent,
          sentiment: c.enrichment.sentiment,
          urgency: c.enrichment.urgency,
        },
        reason: `Intent classified from message content with ${Math.round(c.enrichment.intentConfidence * 100)}% confidence.`,
        metadata: { model: c.enrichment.model, topics: c.enrichment.topics },
        occurredAt: c.enrichment.enrichedAt,
        reversible: false,
      });
    }
  }

  // Form submissions
  for (const s of ops.submissions) {
    if (s.status === "completed") {
      push({
        type: "FORM_COMPLETED",
        tenantId: s.tenantId,
        businessId: s.businessId,
        prospectId: s.prospectId,
        contactId: s.contactId,
        companyId: s.companyId,
        actorId: s.contactId ?? "system",
        actorKind: "contact",
        channel: "form",
        occurredAt: s.submittedAt ?? s.lastActivityAt,
        summary: "Intake submitted",
        detail: `${s.answers.length} sections completed in ${Math.round((+new Date(s.submittedAt ?? s.lastActivityAt) - +new Date(s.startedAt)) / 60_000)} minutes.`,
        automationEligible: true,
        processedBy: ["scoring", "automation"],
        effects: [{ kind: "score", label: "Form completion signal added", delta: 6 }],
      });
    } else {
      push({
        type: "FORM_STARTED",
        tenantId: s.tenantId,
        businessId: s.businessId,
        prospectId: s.prospectId,
        contactId: s.contactId,
        companyId: s.companyId,
        actorId: s.contactId ?? "system",
        actorKind: "contact",
        channel: "form",
        occurredAt: s.startedAt,
        summary: "Intake started",
        detail: `${s.completion}% complete`,
        processedBy: ["enrichment", "scoring"],
      });
      push({
        type: "FORM_ABANDONED",
        tenantId: s.tenantId,
        businessId: s.businessId,
        prospectId: s.prospectId,
        contactId: s.contactId,
        companyId: s.companyId,
        actorId: "system",
        actorKind: "system",
        channel: "form",
        occurredAt: s.lastActivityAt,
        summary: `Intake abandoned at ${s.completion}%`,
        detail: `Missing: ${s.missingFields.join(", ")}`,
        automationEligible: true,
        processedBy: ["priority", "recommendation", "automation"],
        effects: [
          { kind: "notification", label: "Intake value assessed" },
          { kind: "task", label: "Reminder scheduled" },
        ],
      });
      if (s.reminderSentAt) {
        push({
          type: "FORM_REMINDER_SENT",
          tenantId: s.tenantId,
          businessId: s.businessId,
          prospectId: s.prospectId,
          actorId: "u_nina",
          actorKind: "ai",
          channel: "email",
          occurredAt: s.reminderSentAt,
          summary: "Intake reminder sent autonomously",
          detail: "Nina · Intake Agent, confidence 0.84",
          processedBy: ["automation"],
        });
      }
    }
  }

  // Tasks
  for (const t of ops.tasks) {
    push({
      type: "TASK_CREATED",
      tenantId: t.tenantId,
      businessId: t.businessId,
      prospectId: t.prospectId,
      contactId: t.contactId,
      companyId: t.companyId,
      actorId: t.createdBy,
      actorKind: t.createdByKind === "automation" ? "automation" : t.createdByKind,
      occurredAt: t.createdAt,
      summary: `Task created: ${t.title}`,
      detail: t.reason,
      automationEligible: true,
      processedBy: ["sla"],
    });
    if (t.status !== "completed" && +new Date(t.dueAt) < now) {
      push({
        type: "TASK_OVERDUE",
        tenantId: t.tenantId,
        businessId: t.businessId,
        prospectId: t.prospectId,
        occurredAt: t.dueAt,
        actorId: "system",
        actorKind: "system",
        summary: `Follow-up overdue: ${t.title}`,
        detail: t.reason,
        automationEligible: true,
        processedBy: ["escalation"],
        effects: [{ kind: "priority", label: "Follow-up signal reduced score" }],
      });
    }
    if (t.status === "completed" && t.completedAt) {
      push({
        type: "TASK_COMPLETED",
        tenantId: t.tenantId,
        businessId: t.businessId,
        prospectId: t.prospectId,
        actorId: t.ownerId,
        actorKind: "user",
        occurredAt: t.completedAt,
        summary: `Task completed: ${t.title}`,
        detail: t.outcome,
        processedBy: ["outcome-learning"],
      });
    }
  }

  // Appointments
  for (const a of ops.appointments) {
    const type: EventType =
      a.status === "missed"
        ? "APPOINTMENT_MISSED"
        : a.status === "completed"
          ? "APPOINTMENT_COMPLETED"
          : "APPOINTMENT_CREATED";
    push({
      type,
      tenantId: a.tenantId,
      businessId: a.businessId,
      prospectId: a.prospectId,
      contactId: a.contactId,
      companyId: a.companyId,
      actorId: a.scheduledBy,
      actorKind: a.scheduledByKind,
      channel: "meeting",
      occurredAt: a.status === "scheduled" ? a.createdAt : a.startAt,
      summary: `${a.title} — ${a.status}`,
      detail: a.aiPrep,
      automationEligible: a.status !== "scheduled",
      processedBy: ["scoring", "calendar"],
    });
  }

  // Deals
  for (const d of ops.deals) {
    if (d.state === "won" || d.state === "customer") {
      push({
        type: "DEAL_WON",
        tenantId: d.tenantId,
        businessId: d.businessId,
        prospectId: d.prospectId,
        companyId: d.companyId,
        actorId: d.ownerId,
        actorKind: "user",
        occurredAt: d.closedAt ?? d.updatedAt,
        summary: `Deal won — $${d.value.toLocaleString()}`,
        detail: `${d.products.length} product lines. Outcome fed to the learning layer.`,
        processedBy: ["outcome-learning", "forecast"],
        effects: [{ kind: "insight", label: "Conversion pattern updated" }],
      });
    } else if (d.state === "lost") {
      push({
        type: "DEAL_LOST",
        tenantId: d.tenantId,
        businessId: d.businessId,
        prospectId: d.prospectId,
        companyId: d.companyId,
        actorId: d.ownerId,
        actorKind: "user",
        occurredAt: d.closedAt ?? d.updatedAt,
        summary: "Deal lost",
        detail: d.lostReason,
        processedBy: ["outcome-learning"],
        effects: [{ kind: "insight", label: "Loss reason recorded" }],
      });
    } else if (d.state === "proposal") {
      push({
        type: "PROPOSAL_SENT",
        tenantId: d.tenantId,
        businessId: d.businessId,
        prospectId: d.prospectId,
        companyId: d.companyId,
        actorId: d.ownerId,
        actorKind: "user",
        channel: "email",
        occurredAt: new Date(+new Date(d.updatedAt) - 3 * 86_400_000).toISOString(),
        summary: `Proposal sent — $${d.value.toLocaleString()}`,
        automationEligible: true,
        processedBy: ["scoring", "automation"],
      });
      push({
        type: "PROPOSAL_VIEWED",
        tenantId: d.tenantId,
        businessId: d.businessId,
        prospectId: d.prospectId,
        actorId: "contact",
        actorKind: "contact",
        channel: "email",
        occurredAt: new Date(+new Date(d.updatedAt) - 2 * 86_400_000).toISOString(),
        summary: "Proposal viewed twice",
        detail: "Document engagement signal",
        automationEligible: true,
        processedBy: ["scoring"],
      });
    }
  }

  // AI actions
  for (const act of ops.actions) {
    const agentName =
      act.agentId === "agent_nina"
        ? "Nina"
        : act.agentId === "agent_rex"
          ? "Rex"
          : act.agentId === "agent_meridian"
            ? "Scout"
            : "Ava";
    push({
      type: "AI_ACTION_PROPOSED",
      tenantId: act.tenantId,
      businessId: act.businessId,
      prospectId: act.prospectId,
      contactId: act.contactId,
      companyId: act.companyId,
      actorId: act.agentId,
      actorKind: "ai",
      occurredAt: act.createdAt,
      summary: `AI proposed: ${act.title}`,
      detail: act.rationale,
      processedBy: ["approval"],
      effects: [
        {
          kind: "action",
          label: `${agentName} · confidence ${(act.confidence * 100).toFixed(0)}%`,
        },
      ],
    });
    auditPush({
      tenantId: act.tenantId,
      businessId: act.businessId,
      actorId: act.agentId,
      actorKind: "ai",
      actorName: agentName,
      action: "proposed_action",
      targetType: "ai_action",
      targetId: act.id,
      targetLabel: act.title,
      newState: { status: "proposed", type: act.type },
      reason: act.rationale,
      metadata: { confidence: act.confidence, autonomy: act.autonomyUsed },
      occurredAt: act.createdAt,
      reversible: false,
    });

    if (act.status === "executed" && act.executedAt) {
      push({
        type: "AI_ACTION_EXECUTED",
        tenantId: act.tenantId,
        businessId: act.businessId,
        prospectId: act.prospectId,
        contactId: act.contactId,
        companyId: act.companyId,
        actorId: act.agentId,
        actorKind: "ai",
        occurredAt: act.executedAt,
        summary: `AI executed: ${act.title}`,
        detail: act.result,
        processedBy: ["audit"],
        effects: [
          {
            kind: "action",
            label:
              act.autonomyUsed === "autonomous"
                ? "Executed autonomously"
                : "Executed after approval",
          },
        ],
      });
      auditPush({
        tenantId: act.tenantId,
        businessId: act.businessId,
        actorId: act.agentId,
        actorKind: "ai",
        actorName: agentName,
        action: act.type,
        targetType: act.prospectId ? "prospect" : "business",
        targetId: act.prospectId ?? act.businessId,
        targetLabel: act.title,
        previousState: act.undo?.patch ? act.undo.patch : undefined,
        newState: act.payload,
        reason: act.expectedOutcome,
        metadata: { confidence: act.confidence, autonomy: act.autonomyUsed },
        occurredAt: act.executedAt,
        reversible: act.revertible,
      });
    }
    if (act.status === "rejected") {
      push({
        type: "AI_ACTION_REJECTED",
        tenantId: act.tenantId,
        businessId: act.businessId,
        prospectId: act.prospectId,
        actorId: act.approvedBy ?? "u_priya",
        actorKind: "user",
        occurredAt: new Date(+new Date(act.createdAt) + 6 * 60_000).toISOString(),
        summary: `AI action rejected: ${act.title}`,
        detail: act.result,
        processedBy: ["learning"],
        effects: [{ kind: "insight", label: "Preference learned: channel choice" }],
      });
    }
    if (act.status === "reverted" && act.revertedAt) {
      push({
        type: "AI_ACTION_REVERTED",
        tenantId: act.tenantId,
        businessId: act.businessId,
        prospectId: act.prospectId,
        actorId: act.approvedBy ?? "u_priya",
        actorKind: "user",
        occurredAt: act.revertedAt,
        summary: `AI action reverted: ${act.title}`,
        detail: act.result,
        processedBy: ["learning", "audit"],
      });
      auditPush({
        tenantId: act.tenantId,
        businessId: act.businessId,
        actorId: act.approvedBy ?? "u_priya",
        actorKind: "user",
        actorName: "Priya Shah",
        action: "revert_ai_action",
        targetType: "ai_action",
        targetId: act.id,
        targetLabel: act.title,
        previousState: { status: "executed" },
        newState: { status: "reverted" },
        reason: "Reversed an autonomous action after review.",
        occurredAt: act.revertedAt,
        reversible: false,
      });
    }
  }

  // Automations
  for (const run of ops.runs) {
    push({
      type: run.status === "failed" ? "AUTOMATION_FAILED" : "AUTOMATION_TRIGGERED",
      tenantId: run.tenantId,
      businessId: run.businessId,
      prospectId: run.prospectId,
      actorId: "system",
      actorKind: "automation",
      occurredAt: run.startedAt,
      summary: `Automation ${run.status}: ${ops.automations.find((a) => a.id === run.automationId)?.name ?? run.automationId}`,
      detail: run.detail,
      processedBy: ["automation"],
    });
  }

  // Insights
  for (const ins of ops.insights) {
    push({
      type: "AI_INSIGHT_CREATED",
      tenantId: ins.tenantId,
      businessId: ins.businessId,
      prospectId: ins.prospectId,
      companyId: ins.companyId,
      actorId: "agent_ava",
      actorKind: "ai",
      occurredAt: ins.createdAt,
      summary: `AI insight: ${ins.title.replace(/^AI\s*/, "")}`,
      detail: ins.body.slice(0, 180),
      processedBy: ["insight"],
    });
  }

  // Integrations
  for (const int of ops.integrations) {
    if (int.connectedAt) {
      push({
        type: "INTEGRATION_CONNECTED",
        tenantId: int.tenantId,
        businessId: int.businessId,
        actorId: int.connectedBy ?? "u_alex",
        actorKind: "user",
        occurredAt: int.connectedAt,
        summary: `${int.name} connected`,
        detail: `${int.capabilities.length} capabilities enabled via ${int.adapter}.`,
        processedBy: ["integration"],
      });
    }
    if (int.status === "error" && int.lastError) {
      push({
        type: "INTEGRATION_ERROR",
        tenantId: int.tenantId,
        businessId: int.businessId,
        actorId: "system",
        actorKind: "integration",
        occurredAt: int.lastSyncAt ?? new Date(now - 60 * 60_000).toISOString(),
        summary: `${int.name} sync failed`,
        detail: int.lastError,
        automationEligible: true,
        processedBy: ["integration"],
      });
    }
  }

  // Score change / pipeline movement from the hero storyline (makes the AI Activity log legible)
  const heroChain: {
    type: EventType;
    minutesAgo: number;
    summary: string;
    detail: string;
    effects?: EventEffect[];
  }[] = [
    {
      type: "EMAIL_RECEIVED",
      minutesAgo: 8,
      summary: "Email received from Sarah Williams",
      detail: "Subject: RE: Northwind Dental — corporate plan for the ABC Legal team",
    },
    {
      type: "AI_INSIGHT_CREATED",
      minutesAgo: 7.5,
      summary: "AI classified as high intent",
      detail: "lead-intel/classifier-1 · intent high_intent · confidence 0.91 · sentiment positive",
      effects: [{ kind: "intent", label: "High intent", detail: "91% confidence" }],
    },
    {
      type: "LEAD_SCORE_CHANGED",
      minutesAgo: 7.4,
      summary: "Priority increased",
      detail:
        "Score 82 → 94 (+12). Recent response, intent strength and deal size drove the change.",
      effects: [
        { kind: "score", label: "Lead score +12", delta: 12 },
        { kind: "priority", label: "Medium → critical" },
      ],
    },
    {
      type: "PIPELINE_STATE_CHANGED",
      minutesAgo: 7.3,
      summary: "Pipeline state changed",
      detail: "Contacted → Engaged. Reason: prospect replied on a two-way thread.",
      effects: [{ kind: "state", label: "Contacted → Engaged" }],
    },
    {
      type: "TASK_CREATED",
      minutesAgo: 7.2,
      summary: "Follow-up task created",
      detail: "Reply to Sarah Williams — SLA 1 hour, owner Daniel Okafor.",
      effects: [{ kind: "task", label: "Reply task created (1h SLA)" }],
    },
    {
      type: "AI_ACTION_PROPOSED",
      minutesAgo: 7,
      summary: "Response drafted",
      detail: "Draft reply with Thursday 10:00 and Friday 09:30 slots, awaiting approval.",
      effects: [{ kind: "action", label: "Draft ready for approval" }],
    },
  ];
  for (const h of heroChain) {
    if (h.type === "EMAIL_RECEIVED") continue; // already emitted from the communication record
    push({
      type: h.type,
      tenantId: TENANT,
      businessId: BIZ1,
      prospectId: "p_sarah",
      contactId: "ct_sarah",
      companyId: "co_abc",
      actorId: "agent_ava",
      actorKind: "ai",
      occurredAt: new Date(now - h.minutesAgo * 60_000).toISOString(),
      summary: h.summary,
      detail: h.detail,
      effects: h.effects,
      processedBy: ["intelligence"],
    });
  }

  events.sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));
  audit.sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));

  return { events, audit };
}
