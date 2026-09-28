# Lead Intelligence — AI lead operations & business command center

A multi-tenant, multi-business command center for lead operations. Opening the app answers, in order:
**what is happening**, **what did I miss**, **what matters most**, **what do I do next**.

Every business owns its own leads, communications, pipelines, intake forms, AI configuration,
automations, integrations, users and permissions. Tenant/business isolation is enforced in the
data + service layer (`src/lib/services/queries.ts`), never only in the UI.

```
Platform → Tenant → Business → Teams / Users / AI Agents → Leads / Contacts / Companies / Activities
```

## Screens

| Screen                                 | What it does                                                                                                                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard** (`/`)                    | Attention-first: new responses → missed activity → hottest prospects → overdue actions → incomplete intakes, plus pipeline snapshot and an AI business summary.                                                 |
| **AI Command Center** (`/ai`)          | Conversational console. Natural-language commands route through the provider interface to real answers with recommendations (_Recommended action / Why / Expected outcome / Execute / Edit / Dismiss_).         |
| **Prospects** (`/prospects`)           | Filter chips (hot, warm, cold, new, responded, no response, follow-up overdue, missed call, email received, form incomplete, appointment, proposal, won, lost), sorting, saved views, contextual quick actions. |
| **Prospect 360** (`/prospects/$id`)    | 11 tabs (overview, timeline, communications, calls, forms, tasks, appointments, documents, deal, AI intelligence, activity) + “Ask anything about this prospect…”.                                              |
| **Companies** (`/companies`)           | Company 360 with contacts, opportunities, communications, documents and appointments.                                                                                                                           |
| **Communications** (`/communications`) | Email / calls / SMS / WhatsApp / forms in one stream, AI-classified (intent, urgency, sentiment, required action), linked to prospect/contact/company/user-or-AI/timestamp.                                     |
| **Tasks** (`/tasks`)                   | Today, overdue, upcoming, AI created, manual, assigned to me, team, completed.                                                                                                                                  |
| **Pipeline** (`/pipeline`)             | Kanban, list and analytics views; the AI infers and moves states, humans can override (recorded as a manual change).                                                                                            |
| **Forms & intake** (`/forms`)          | Started / partial / completed / abandoned with abandonment follow-up on the exact missing fields.                                                                                                               |
| **Calendar** (`/calendar`)             | Appointments, calls, follow-ups, tasks, AI-scheduled items plus conflict detection.                                                                                                                             |
| **AI Activity** (`/ai-activity`)       | Decision log: what, why, confidence, action, actor, timestamp, reversibility — with Pause AI, Undo, Override, Review and Change rule.                                                                           |
| **Analytics** (`/analytics`)           | Lead volume, contact/response/appointment/conversion rates, revenue, sources, response time, missed opportunities, AI performance, pipeline movement, team performance and natural-language analytics.          |
| **Automations** (`/automations`)       | WHEN → IF → THEN builder over the canonical event catalog, with AI-suggested automations and a run log.                                                                                                         |
| **Integrations** (`/integrations`)     | Provider-agnostic adapters (email, calendar, telephony, SMS, WhatsApp, Sheets, CSV, LinkedIn, CRMs, web forms, AI providers) with capability lists and sync health.                                             |
| **Team** (`/team`)                     | Members, roles, teams, granular permission overrides, AI agents, invites.                                                                                                                                       |
| **Settings** (`/settings`)             | Profile, AI behaviour, automation, notifications, communications, scoring, pipeline, forms, integrations, permissions, security, data, billing placeholder, API.                                                |

## Architecture

```
src/lib/domain/        single domain contract (types.ts) + permission catalog & roles (permissions.ts)
src/lib/intelligence/  scoring (16 weighted signals, versioned breakdowns) + attention engine
src/lib/ai/            provider abstraction (chat/classify/summarize/extract/embed) + local reasoner
src/lib/data/          seeded demo state (seed-*.ts) + observable store with event/audit reducer
src/lib/services/      scoped read models used by every screen (queries.ts)
src/hooks/             useBusiness / useTasks / useForms / useHydrated client-store hooks
src/components/app/    shell (nav, business switcher, ⌘K palette, notifications) + UI kit
src/routes/            TanStack Start file-based routes (_app.*.tsx)
```

**Event-driven core.** Activity → events → intelligence → priorities → recommended actions →
outcomes → learning. Every mutation in `src/lib/data/store.ts` writes a `DomainEvent` **and** an
`AuditLogEntry` (actor, actor kind, previous/new state, reason, reversibility) before the state is
re-hydrated, so scores, inferred stages, next-best actions and the attention queue are always derived
from the log rather than hardcoded.

**Scoring is data, not a constant.** `computeScore` evaluates 16 signals (recency, response speed,
engagement, call/message activity, form completion, appointments, deal value, source, follow-up
status, history, intent, AI opportunity, …). Weights come from `BusinessSettings.scoringWeights`
per business, and every prospect keeps its own `ScoreBreakdown` with the model version that produced it.

**AI is provider-agnostic and accountable.** `AIProvider` exposes chat, classification, extraction,
summarization and embeddings; the repository ships a deterministic local reasoner so the demo runs
offline, and a remote model can be plugged in without touching a screen. Autonomy is
`Assist / Approve / Autonomous`, configurable per business, agent, user, action type and workflow,
with a global kill switch and reversible actions.

## Demo data

The seed is generated relative to _now_, so the dashboard always looks alive:

| Scenario              | Example                                |
| --------------------- | -------------------------------------- |
| Hot reply minutes ago | Sarah Williams (score 93, high intent) |
| New leads             | Marcus Reed, Sofia Márquez             |
| Missed calls          | Michael Osei, Derek Molina             |
| Overdue follow-ups    | John Whitaker, Aisha Bello             |
| Incomplete intakes    | Dana Whitfield, Wendy Park             |
| Appointment           | Priyanka Raman                         |
| Proposals sent        | Tom Becker, Vincent Cole               |
| Won deals             | Greg Sullivan, Steve Novak             |
| Lost deals            | Vanessa Ortiz, Ben Carter              |

Two businesses ship in the demo tenant (Northwind Dental Studio, Meridian Roofing) so you can
verify that switching the business switcher changes **all** data.

Demo state lives in `localStorage` (`lead-intelligence/state/v4`); reloading re-anchors timestamps to
the current time. "Simulate event" buttons on prospects inject new events to watch the intelligence
pipeline react.

## Development

You need Node.js and npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)).

```sh
npm i
npm run dev      # dev server
npm run build     # production build
npm run lint      # eslint + prettier
npm run format    # prettier --write .
```

Routing conventions live in [`src/routes/README.md`](src/routes/README.md) — file-based routes only
(`_app.*.tsx`, `$id.tsx`, `{-$category}.tsx`, `$.tsx`); `src/routeTree.gen.ts` is generated and must
not be edited by hand.

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cbf6cabf-d547-4658-8288-0761d85af7f0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable.
