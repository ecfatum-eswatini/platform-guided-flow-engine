# WhatsApp guided-step flows — portfolio conversion

**Date:** 2026-07-05
**Status:** Approved (design) — pending implementation plan
**Scope:** `@govsz/guided-flow-engine` (shared) + `mcit/brp` + `mopwt/road-permits` + `mopwt/roadworthiness`

## Problem

Across the gov.sz portfolio, WhatsApp apply/booking flows are inconsistent.
Only `mopwt/building-permits` drives the applicant through discrete, validated,
numbered guided steps via `@govsz/guided-flow-engine`. The other flows either
parse free-form natural-language input (brp sole-proprietor), have no apply
flow at all (road-permits), or run a large bespoke state machine with free-text
data entry (roadworthiness). The goal: **every WhatsApp flow guides the user
one validated step at a time instead of asking them to type natural language
that the bot must interpret.**

The one deliberate exception is roadworthiness's free-form LLM `askAssistant`
Q&A path — that answers open questions and is not step-filling, so it stays.

## Decisions (locked during brainstorming)

1. **Scope = all three portals**: brp, road-permits (net-new flow), roadworthiness.
2. **Dynamic choices**: extend the shared engine with a `dynamic_choice` field
   type rather than snapshotting options or keeping bespoke code.
3. **AI assistant**: keep roadworthiness's `askAssistant` as-is (separate Q&A
   fallback, not a step).
4. **Sequencing**: prove the engine extension on brp + road-permits first;
   migrate roadworthiness (the large, live state machine) as its own later phase.

## Non-negotiables inherited from the portfolio

- API routes under `/v1/*`; WhatsApp turn endpoint stays `POST /v1/channels/whatsapp/turn`, bearer-authenticated by central-whatsapp-service.
- Wire JSON snake_case; internal TypeScript camelCase.
- Money in integer minor units; IDs per each portal's existing convention.
- PII redacted in logs (msisdn, national ID, etc.).
- siSwati first-class alongside English on every applicant-facing string. New siSwati copy is **provisional** — flag for native-speaker review.
- No `Co-Authored-By: Claude` (or any AI) commit trailer.
- Deploy independence: the only shared change is a `@govsz/guided-flow-engine`
  version bump; each portal re-pins on its own cadence. No portal imports
  another portal's source.

---

## Section 1 — Engine extension (`@govsz/guided-flow-engine`)

Two additive, backward-compatible capabilities. Existing static flows
(building-permits) must be byte-for-byte unaffected; the current test suite
stays green and new tests are added.

### 1a. `dynamic_choice` field type

The engine remains **pure and synchronous**. The *portal* resolves options
(async DB calls) before invoking the engine and injects them via a new optional
`ctx` argument.

New field spec (added to the `FieldSpec` discriminated union):

```ts
{ type: 'dynamic_choice', source: string }   // 'source' names which portal resolver produces the options
```

New engine signatures (the `ctx` param defaults to `{}` so existing callers are
unchanged):

```ts
interface FlowContext {
  /** Resolved options for dynamic_choice steps, keyed by step.key. */
  options?: Record<string, ChoiceOption[]>;
}
renderStep(flow, state, ctx?: FlowContext): string
runFlowTurn(flow, state, input, ctx?: FlowContext): FlowTurnResult
startFlow(flow, locale, ctx?: FlowContext): FlowTurnResult
```

Behaviour:

- **Render**: a `dynamic_choice` step renders its prompt followed by the
  numbered `ctx.options[step.key]` list, identical in shape to a static choice.
- **Validate**: reuse the existing choice logic (numeric index or value match)
  against `ctx.options[step.key]`. If `ctx.options[step.key]` is missing/empty,
  the engine returns a "no options available" validation error rather than
  throwing — the portal is expected to always supply options for the current
  dynamic step.
- **Store**: the answer value is the chosen option's `value` (e.g. a centreId
  or slot ISO timestamp). Because dynamic option labels are not in the
  `FlowDefinition`, the engine also records the chosen option's **label** in a
  new `answer_labels: Record<string, string>` map on `FlowSessionState`, so the
  `confirm` summary can render the human label without re-resolving.

Dependent options (slot list depends on chosen centre) are handled entirely in
the portal: it reads `state.answers['centre']` to compute
`ctx.options['slot']` before calling the engine. The engine has no async
awareness.

### 1b. Optional steps

Add `optional?: boolean` to `FlowStep`. When a step is optional:

- Its prompt shows a skip hint.
- An input matching a skip token — `skip`, `-`, `none`, or siSwati `yeka` —
  stores nothing (the key is absent from `answers`) and advances.
- The `confirm` summary renders `-` for a skipped optional step.

Needed for brp's 2nd/3rd business-name alternatives.

### Engine testing

- `validators.test.ts`: dynamic_choice validation against an injected list;
  optional skip-token handling.
- `engine.test.ts`: render + advance + back + confirm-summary rendering for
  dynamic_choice (with `answer_labels`) and optional steps; a stale-version
  reset still works with `ctx`.
- The existing building-permits-oriented suite must remain green unchanged.

### Versioning

Bump `@govsz/guided-flow-engine` (0.1.0 → 0.2.0, additive minor). Publish the
tarball/git ref the portals resolve. Each portal re-pins independently.

---

## Section 2 — `mcit/brp` sole-proprietor flow → engine

Replace the hand-rolled `apps/server/src/whatsapp/sole-prop.ts` step machine
with a `FlowDefinition` and the `BotState`-union wrapper pattern
building-permits uses.

**Flow `sole_proprietor_apply` (v1)** steps:

| key | field | notes |
|---|---|---|
| `proprietor_name` | text (min 2, max 120) | |
| `business_name_1` | text (min 2, max 120) | primary preference |
| `business_name_2` | text, **optional** | alternate |
| `business_name_3` | text, **optional** | alternate |
| `business_activity` | text (min 3, max 200) | |
| `trading_address` | text (min 3, max 160) | |
| `confirm` | confirm | |

- Removes `parseBusinessNames`, the "type the part you want to correct" free-text
  correction, and the `SOLE PROP` / `YES` keyword parsing. Menu entry starts the
  flow; `back` edits a prior step; `confirm` (yes/no) submits/cancels.
- Completion (`mode: draft_then_portal`): keep the existing
  `SoleProprietorDraftStore.create` — it now receives structured `answers`.
  `businessNameOptions` is assembled from the 1–3 name steps present.
- The `control` verbs (`save`/`resume`/`cancel`) currently handled in the route
  are preserved at the route layer, mapped onto engine session state.
- Tests: rewrite `whatsapp-turn.test.ts` for the guided flow (each step,
  validation errors, optional skips, confirm submit/cancel, draft creation).

## Section 3 — `mopwt/road-permits` net-new guided apply flow

road-permits' bot is read-only today (status/verify/apply_info). Add an apply
flow mirroring the building-permits shape.

**Flow `road_permit_apply` (v1)** steps:

| key | field | notes |
|---|---|---|
| `intake_type` | choice: `FIRST_TIME` / `RENEWAL` | maps to `RtspIntakeType` |
| `operator_name` | text (min 2, max 160) | |
| `applicant_name` | text (min 2, max 120) | |
| `service_class` | choice: `TAXI`/`KOMBI`/`BUS`/`FREIGHT`/`OTHER` | maps to `RtspServiceClass` |
| `vehicle_reg` | text (min 2, max 20) | |
| `route_description` | text (min 3, max 300) | |
| `contact_msisdn` | msisdn | defaults to sender; still confirmed |
| `confirm` | confirm | |

- Completion (`mode: draft_then_portal`): new `createApplication` dep writes a
  `DRAFT` `RtspApplication` with a `RTSP-YYYY-NNNNNN` refNo (sequence mirroring
  building-permits' `building_permit_refno_seq`), `intakeChannel = WHATSAPP`,
  and an initial `RtspApplicationEvent`. Returns a portal deep link.
- **Schema change**: add `DRAFT` to `RtspApplicationStatus` (dev-phase clean
  migration — squash to a clean baseline, never create-then-drop). `DRAFT` sorts
  before `SUBMITTED`. `RtspApplication.refNo` already exists (unique) — add a
  Postgres sequence for `RTSP-YYYY-NNNNNN` generation, and an `intakeChannel`
  field only if the current schema lacks one (verify before writing the migration).
- `handleMessage` gains an `APPLY_FLOW` branch and a menu option "3. Apply".
- Tests: extend `whatsapp/route.test.ts` + add a bot apply-flow test.

## Section 4 — `mopwt/roadworthiness` booking/reschedule → engine (later phase)

The largest and only high-risk conversion — a live ~2,158-line state machine.
Approach: **behaviour-parity migration guarded by the existing bot tests.**

- Booking becomes a `FlowDefinition`:
  - Vehicle details (plate, owner name, chassis, engine, make, model, colour,
    year, gross weight, address) → `text` / `number` steps.
  - Category → static `choice`.
  - Centre → `dynamic_choice` (source `centres`, resolver = `listCentres`).
  - Date → `dynamic_choice` (source `dates`, derived from availability).
  - Slot → `dynamic_choice` (source `slots`, resolver = `listSlots(centreId)`).
  - `confirm`.
- The **plate-lookup short-circuit** (existing vehicle found → skip detail
  steps) and the **`askAssistant` LLM Q&A path** stay outside the flow,
  unchanged.
- Reschedule flow migrates the same way (centre/date/slot dynamic_choice).
- This is sequenced **after** brp + road-permits land, so the engine extension
  is proven on the two simpler portals first. It gets its own implementation
  plan.
- Tests: the existing `packages/bot/src/state-machine.test.ts` conversation-branch
  coverage is the parity oracle; rewritten against the engine-backed flow.

## Rollout / build independence

- Ship order: (1) engine 0.2.0 → (2) brp → (3) road-permits → (4) roadworthiness.
- Each portal PR bumps only its own `@govsz/guided-flow-engine` pin; no
  cross-portal rebuilds.
- No Meta credentials touch any portal — central-whatsapp-service unchanged; the
  turn contract (`replies` / `session_state` / `terminal`) is preserved, so the
  gateway needs no change.

## Open items for the plan

- Exact `RtspApplication` refNo sequence + `intakeChannel`/`DRAFT` migration
  details (verify current schema state before writing the migration).
- Confirm the `@govsz/guided-flow-engine` publish mechanism the portals resolve
  (git tarball ref vs. registry) so the version bump propagates.
- siSwati copy for all new steps — provisional, flag for review.
