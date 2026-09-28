import type { AIInsight, AppState, Communication, Intent, Prospect } from "@/lib/domain/types";

/**
 * AI provider abstraction.
 *
 * The application never talks to a model directly. It talks to an
 * `AIProvider`, and providers are registered by capability. V1 ships a
 * deterministic local provider that reasons over the event store (so the
 * product works with zero configuration and zero data egress), plus a
 * remote-provider slot for OpenAI/Anthropic/Bedrock etc.
 */

export type AICapability =
  "chat" | "classification" | "extraction" | "summarization" | "embeddings" | "agent_actions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  /** Grounding context assembled by the app (tenant/business scoped). */
  context?: unknown;
  maxTokens?: number;
  temperature?: number;
  tools?: string[];
}

export interface ChatResponse {
  content: string;
  model: string;
  providerId: string;
  confidence: number;
  /** Structured payload a richer UI can render (tables, prospect cards...). */
  data?: unknown;
  latencyMs: number;
}

export interface ClassifyRequest {
  text: string;
  subjects: Intent[];
  context?: { channel?: Communication["channel"]; history?: string[] };
}

export interface Classification {
  label: Intent;
  confidence: number;
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  urgency: "critical" | "high" | "medium" | "low";
  topics: string[];
  summary: string;
  requiredAction: string;
}

export interface SummarizeRequest {
  scope: "prospect" | "business" | "day" | "thread";
  prospect?: Prospect;
  communications?: Communication[];
  state?: AppState;
  businessId?: string;
}

export interface ExtractRequest {
  text: string;
  fields: string[];
}

export interface EmbedRequest {
  texts: string[];
}

export interface AIProvider {
  id: string;
  name: string;
  model: string;
  capabilities: AICapability[];
  /** True when the provider runs entirely inside the app (no data leaves). */
  local: boolean;
  chat(request: ChatRequest): Promise<ChatResponse>;
  classify(request: ClassifyRequest): Promise<Classification>;
  summarize(request: SummarizeRequest): Promise<AIInsight>;
  extract(request: ExtractRequest): Promise<Record<string, string>>;
  embed(request: EmbedRequest): Promise<number[][]>;
}

const INTENT_SIGNALS: { intent: Intent; patterns: RegExp[]; weight: number }[] = [
  {
    intent: "high_intent",
    patterns: [
      /\byes\b/i,
      /interested/i,
      /let'?s (do|talk|book|move)/i,
      /sign(ed)?\b/i,
      /ready to (start|move)/i,
      /confirmed/i,
    ],
    weight: 1,
  },
  {
    intent: "scheduling",
    patterns: [
      /thursday|friday|monday|tuesday|wednesday/i,
      /schedule/i,
      /book/i,
      /call me at/i,
      /available/i,
      /what time/i,
    ],
    weight: 0.95,
  },
  {
    intent: "pricing",
    patterns: [/price|pricing|cost|quote|discount|per employee|\$/i, /budget/i, /invoice/i],
    weight: 0.9,
  },
  {
    intent: "objection",
    patterns: [/too expensive|can'?t do|concern|objection|clause|competitor|cheaper/i],
    weight: 0.85,
  },
  {
    intent: "question",
    patterns: [/\?/, /how does|what about|can you (explain|clarify)/i],
    weight: 0.6,
  },
  {
    intent: "unsubscribe",
    patterns: [/remove me|unsubscribe|stop (emailing|contacting)/i],
    weight: 1,
  },
  {
    intent: "not_interested",
    patterns: [/not interested|no thanks|went with|decided to go/i],
    weight: 1,
  },
  { intent: "spam", patterns: [/seo services|guest post|crypto/i], weight: 1 },
];

const TOPIC_PATTERNS: { topic: string; re: RegExp }[] = [
  { topic: "pricing", re: /price|pricing|cost|quote|discount|\$/i },
  { topic: "scheduling", re: /schedule|book|call|time|meeting|slot/i },
  { topic: "contract", re: /contract|clause|terms|agreement/i },
  { topic: "onboarding", re: /onboard|implementation|kickoff|rollout|ramp/i },
  { topic: "insurance", re: /insurance|claim|adjuster|carrier/i },
  { topic: "support", re: /support|issue|problem|broken|fix/i },
  { topic: "urgency", re: /today|asap|urgent|deadline|tomorrow/i },
];

export function classifyHeuristically(text: string): Classification {
  let best: { intent: Intent; score: number } = { intent: "neutral", score: 0.3 };
  for (const signal of INTENT_SIGNALS) {
    const hits = signal.patterns.filter((p) => p.test(text)).length;
    if (hits > 0) {
      const score = Math.min(0.98, 0.55 + hits * 0.14) * (signal.weight >= 1 ? 1.05 : 1);
      if (score > best.score) best = { intent: signal.intent, score };
    }
  }

  const negative = /not interested|remove me|unsubscribe|cheaper|too expensive|disappointed/i.test(
    text,
  );
  const positive = /thank|great|helpful|interested|yes|happy|works for me|confirmed/i.test(text);
  const sentiment =
    negative && positive ? "mixed" : negative ? "negative" : positive ? "positive" : "neutral";
  const urgency = /asap|urgent|today|deadline|tomorrow|monday/i.test(text)
    ? "critical"
    : best.intent === "high_intent" || best.intent === "pricing"
      ? "high"
      : "medium";

  const topics = TOPIC_PATTERNS.filter((t) => t.re.test(text)).map((t) => t.topic);
  const requiredAction =
    best.intent === "unsubscribe" || best.intent === "not_interested" || best.intent === "spam"
      ? "review"
      : best.intent === "scheduling"
        ? "schedule"
        : "reply";

  return {
    label: best.intent,
    confidence: Number(Math.min(0.97, best.score).toFixed(2)),
    sentiment,
    urgency,
    topics: topics.length ? topics : ["general"],
    summary: text.replace(/\s+/g, " ").slice(0, 140),
    requiredAction,
  };
}

/**
 * Deterministic analysis functions the local provider is built from. Kept in
 * this module so remote providers can reuse the same grounding payloads.
 */

export function buildGroundingContext(state: AppState, businessId: string, prospectId?: string) {
  const prospects = state.prospects.filter((p) => p.businessId === businessId);
  const scope = prospectId ? prospects.filter((p) => p.id === prospectId) : prospects;
  return {
    businessId,
    prospectCount: scope.length,
    hotProspects: scope.filter((p) => p.score >= 70).length,
    overdueTasks: state.tasks.filter(
      (t) =>
        t.businessId === businessId && t.status !== "completed" && +new Date(t.dueAt) < Date.now(),
    ).length,
    awaitingApproval: state.actions.filter(
      (a) =>
        a.businessId === businessId &&
        (a.status === "awaiting_approval" || a.status === "proposed"),
    ).length,
    openIntakes: state.submissions.filter(
      (s) => s.businessId === businessId && s.status !== "completed",
    ).length,
  };
}

export interface ProviderRegistry {
  providers: AIProvider[];
  active(providerId?: string): AIProvider;
}

export function createRegistry(providers: AIProvider[], defaultId: string): ProviderRegistry {
  return {
    providers,
    active: (providerId?: string) =>
      providers.find((p) => p.id === providerId) ??
      providers.find((p) => p.id === defaultId) ??
      providers[0],
  };
}
