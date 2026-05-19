# @govsz/guided-flow-engine

A pure, dependency-free step-runner for gov.sz **guided multi-step application
flows**. Given a declarative flow definition, the current session state, and a
user's text message, it validates the input, advances or re-prompts, and
returns the next reply plus an updated session blob.

It is **pure** — no I/O, no network, no database. It does not know about
WhatsApp, USSD, or HTTP. Host portals persist the session blob and perform any
database write themselves when a flow completes.

## Install

```
npm install @govsz/guided-flow-engine
```

Requires Node 22+. ESM only. The only runtime dependency is `zod`.

## Concepts

- **`FlowDefinition`** — a declarative flow: an ordered list of `steps`, each
  with a typed `field` and bilingual (`en` / `ss`) prompts. The last step must
  be a `confirm` step (enforced by `FlowDefinitionSchema`).
- **`FieldSpec`** — the field type of a step: `text`, `number`, `money`,
  `choice`, `msisdn`, `email`, or `confirm`.
- **`FlowSessionState`** — the serialisable progress blob: `flow_key`,
  `flow_version`, `step_index`, `answers`, `locale`. The host persists this
  between turns and should treat it as opaque.
- **`FlowTurnResult`** — `{ sessionState, replies, status, answers? }`, where
  `status` is `in_progress | complete | cancelled`.

All shapes are exported both as TypeScript types and as Zod schemas
(`FlowDefinitionSchema`, `FieldSpecSchema`, `FlowSessionStateSchema`, …) so a
host can validate untrusted input at its boundary.

## API

```ts
import {
  startFlow,
  runFlowTurn,
  renderStep,
  validateField,
} from '@govsz/guided-flow-engine';
```

### `startFlow(flow, locale): FlowTurnResult`

Begins a flow. Returns the first step's prompt and a fresh `in_progress` state.

### `runFlowTurn(flow, state, input): FlowTurnResult`

Processes one user message:

- A `flow_version` mismatch resets the flow with a bilingual notice.
- `back` / `emuva` steps back one step (ignored at step 0, where it is treated
  as ordinary input).
- On a `confirm` step: `yes` → `status: 'complete'` (with the collected
  `answers`); `no` → `status: 'cancelled'`.
- Otherwise it validates the input — invalid → re-prompt with a bilingual
  error; valid → store the answer and advance to the next step.

### `renderStep(flow, state): string`

Renders the current step's user-facing text. Useful when a host resumes a
saved session and needs to re-emit the current question.

### `validateField(spec, raw): ValidationResult`

Validates a raw string against a single `FieldSpec`. Exposed for host use.

## Host responsibilities

- **Persist `sessionState`** between turns, keyed by the user.
- **Check `status` before calling `runFlowTurn`** — never call it on a session
  whose status is already `complete` or `cancelled`.
- **On `status: 'complete'`** — read `answers` and perform the application
  write. `replies` is empty on completion: the host owns the completion
  message, because only the host knows `flow.completion.mode` and any portal
  deep-link.
- **On `status: 'cancelled'`** — discard the session and inform the user.

## Bilingual

Every prompt, choice-option label, and validation error carries both `en`
(English) and `ss` (siSwati). The active language is `state.locale`.

## Licence

Internal — Government of Eswatini. Not for public distribution.
