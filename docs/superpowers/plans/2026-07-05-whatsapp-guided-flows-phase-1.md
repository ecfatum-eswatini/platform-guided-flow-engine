# WhatsApp Guided-Step Flows — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `@govsz/guided-flow-engine` with dynamic-choice and optional-step support, then convert the brp sole-proprietor flow and add a net-new road-permits apply flow so both drive the user through guided steps instead of parsing free-form text.

**Architecture:** The engine stays pure and synchronous; portals resolve dynamic option lists (async DB calls) and inject them through a new optional `ctx` argument. Each portal wraps the engine in a `BotState` union (`IDLE` / read-only states / `APPLY_FLOW`) exactly as `mopwt/building-permits` already does. Roadworthiness is a separate later plan.

**Tech Stack:** TypeScript, Zod, Vitest, Fastify, Prisma (road-permits only).

## Global Constraints

- The engine is a **separate git repo** at `_platform/guided-flow-engine/` (its own package `@govsz/guided-flow-engine`). All three engine changes are **additive and backward-compatible** — the existing `test/` suite must stay green unchanged.
- **building-permits must not need any code change.** It calls `startFlow`/`runFlowTurn` with no `ctx`; the new `ctx` param defaults to `{}`.
- Wire JSON is **snake_case**; internal TypeScript is **camelCase**. Map at the HTTP boundary.
- Money is **integer minor units**. IDs/refNos follow each portal's existing convention.
- **PII redaction** in logs (msisdn, national ID) — never inline in log messages.
- **siSwati first-class** alongside English on every applicant-facing string. New siSwati copy is **provisional — add a `// TODO: siSwati review` comment** at each new siSwati block.
- **No `Co-Authored-By: Claude`** (or any AI) commit trailer.
- The WhatsApp turn contract (`replies` / `session_state` / `terminal`) is unchanged — central-whatsapp-service needs no change.
- Work happens on the `whatsapp-guided-flows` branch in the engine repo, and a new `whatsapp-guided-flows` branch in each portal repo (`mcit/brp`, `mopwt/road-permits`). Never commit to `main`.
- Reference implementation to mirror throughout: `mopwt/building-permits/apps/server/src/whatsapp/{apply-flow.ts,bot.ts,route.ts}`.

---

## PHASE A — Engine extension (`_platform/guided-flow-engine`)

Work in `_platform/guided-flow-engine/` on branch `whatsapp-guided-flows`.

### Task 1: Optional-step support

**Files:**
- Modify: `src/types.ts` (add `optional` to `FlowStepSchema`)
- Modify: `src/engine.ts` (skip-token handling, render hint, confirm summary shows `-`)
- Test: `test/engine.optional.test.ts` (create)

**Interfaces:**
- Consumes: existing `FlowDefinition`, `startFlow`, `runFlowTurn`, `renderStep`.
- Produces: a step may carry `optional: true`. When set, an input of `skip` / `-` / `none` / `yeka` advances without storing the answer.

- [ ] **Step 1: Write the failing test**

Create `test/engine.optional.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { FlowDefinition } from '../src/index.js';
import { startFlow, runFlowTurn } from '../src/index.js';

const flow: FlowDefinition = {
  key: 'optdemo',
  version: 1,
  title: { en: 'Opt demo', ss: 'Opt demo' },
  completion: { mode: 'submit_in_chat' },
  steps: [
    { key: 'a', prompt: { en: 'A?', ss: 'A?' }, field: { type: 'text', min: 1 } },
    { key: 'b', prompt: { en: 'B?', ss: 'B?' }, optional: true, field: { type: 'text', min: 1 } },
    { key: 'confirm', prompt: { en: 'OK?', ss: 'OK?' }, field: { type: 'confirm' } },
  ],
};

describe('optional steps', () => {
  it('renders a skip hint on an optional step', () => {
    let turn = startFlow(flow, 'en');
    turn = runFlowTurn(flow, turn.sessionState, 'first');
    expect(turn.replies[0]).toContain('skip');
  });

  it('advances past an optional step on a skip token without storing', () => {
    let turn = startFlow(flow, 'en');
    turn = runFlowTurn(flow, turn.sessionState, 'first');
    turn = runFlowTurn(flow, turn.sessionState, 'skip');
    expect(turn.sessionState.answers).toEqual({ a: 'first' });
    expect(turn.sessionState.step_index).toBe(2);
  });

  it('still stores a real answer on an optional step', () => {
    let turn = startFlow(flow, 'en');
    turn = runFlowTurn(flow, turn.sessionState, 'first');
    turn = runFlowTurn(flow, turn.sessionState, 'second');
    expect(turn.sessionState.answers).toEqual({ a: 'first', b: 'second' });
  });

  it('shows "-" for a skipped optional step in the confirm summary', () => {
    let turn = startFlow(flow, 'en');
    turn = runFlowTurn(flow, turn.sessionState, 'first');
    turn = runFlowTurn(flow, turn.sessionState, 'skip');
    expect(turn.replies[0]).toContain('-');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd _platform/guided-flow-engine && npx vitest run test/engine.optional.test.ts`
Expected: FAIL — `optional` not recognized / no skip handling.

- [ ] **Step 3: Add `optional` to the step schema**

In `src/types.ts`, replace the `FlowStepSchema` block with:

```ts
export const FlowStepSchema = z.object({
  key: z.string().min(1),
  prompt: LocalizedTextSchema,
  help: LocalizedTextSchema.optional(),
  summary_label: LocalizedTextSchema.optional(),
  optional: z.boolean().optional(),
  field: FieldSpecSchema,
});
export type FlowStep = z.infer<typeof FlowStepSchema>;
```

- [ ] **Step 4: Add skip handling + render hint in the engine**

In `src/engine.ts`, add these helpers just below the `t()` function:

```ts
const SKIP_WORDS = ['skip', '-', 'none', 'yeka'];

function skipHint(locale: Locale): string {
  return locale === 'ss'
    ? '(Loba "yeka" kute uyekele.)' // TODO: siSwati review
    : '(Reply "skip" to leave this blank.)';
}

function isSkip(input: string): boolean {
  return SKIP_WORDS.includes(input.trim().toLowerCase());
}
```

In `renderStep`, immediately before the final `return body;`, add:

```ts
  if (step.optional) body += `\n${skipHint(state.locale)}`;
```

In `runFlowTurn`, immediately **after** the `confirm` block and **before** the `// Data step` validation, add:

```ts
  // Optional step — a skip token advances without storing an answer.
  if (step.optional && isSkip(trimmed)) {
    const nextState: FlowSessionState = { ...state, step_index: state.step_index + 1 };
    return { sessionState: nextState, replies: [renderStep(flow, nextState)], status: 'in_progress' };
  }
```

(The confirm-summary already renders `-` for any `answers[key] === undefined`, so a skipped step shows `-` with no further change.)

- [ ] **Step 5: Run test to verify it passes + existing suite stays green**

Run: `cd _platform/guided-flow-engine && npx vitest run`
Expected: PASS (new file + all existing tests).

- [ ] **Step 6: Commit**

```bash
cd _platform/guided-flow-engine
git add src/types.ts src/engine.ts test/engine.optional.test.ts
git commit -m "feat(engine): optional steps with skip-token advance"
```

---

### Task 2: `dynamic_choice` field type with injected options

**Files:**
- Modify: `src/types.ts` (add `dynamic_choice` to `FieldSpecSchema`, `answer_labels` to `FlowSessionStateSchema`, `FlowContext` type)
- Modify: `src/validators.ts` (extract `matchChoice`, handle `dynamic_choice` via injected options)
- Modify: `src/engine.ts` (thread `ctx` through `startFlow`/`renderStep`/`runFlowTurn`; render + validate + label dynamic choices)
- Test: `test/engine.dynamic.test.ts` (create)

**Interfaces:**
- Consumes: Task 1's engine.
- Produces:
  - `FieldSpec` gains `{ type: 'dynamic_choice'; source: string }`.
  - `FlowContext = { options?: Record<string, ChoiceOption[]> }`.
  - `renderStep(flow, state, ctx?)`, `startFlow(flow, locale, ctx?)`, `runFlowTurn(flow, state, input, ctx?)` — `ctx` defaults to `{}`.
  - `validateField(spec, raw, ctxOptions?)` — `ctxOptions` used for `dynamic_choice`.
  - `FlowSessionState` gains optional `answer_labels: Record<string,string>`; the engine writes the chosen display label there for each `dynamic_choice` answer.

- [ ] **Step 1: Write the failing test**

Create `test/engine.dynamic.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { FlowDefinition, FlowContext } from '../src/index.js';
import { startFlow, runFlowTurn, renderStep } from '../src/index.js';

const flow: FlowDefinition = {
  key: 'dyndemo',
  version: 1,
  title: { en: 'Dyn demo', ss: 'Dyn demo' },
  completion: { mode: 'submit_in_chat' },
  steps: [
    {
      key: 'centre',
      prompt: { en: 'Which centre?', ss: 'Yiliphi?' },
      summary_label: { en: 'Centre', ss: 'Centre' },
      field: { type: 'dynamic_choice', source: 'centres' },
    },
    { key: 'confirm', prompt: { en: 'OK?', ss: 'OK?' }, field: { type: 'confirm' } },
  ],
};

const ctx: FlowContext = {
  options: {
    centre: [
      { value: 'c1', label: { en: 'Manzini Centre', ss: 'Manzini Centre' } },
      { value: 'c2', label: { en: 'Mbabane Centre', ss: 'Mbabane Centre' } },
    ],
  },
};

describe('dynamic_choice', () => {
  it('renders the injected options as a numbered list', () => {
    const turn = startFlow(flow, 'en', ctx);
    expect(turn.replies[0]).toContain('1. Manzini Centre');
    expect(turn.replies[0]).toContain('2. Mbabane Centre');
  });

  it('stores the chosen value and its display label', () => {
    const turn = startFlow(flow, 'en', ctx);
    const next = runFlowTurn(flow, turn.sessionState, '2', ctx);
    expect(next.sessionState.answers.centre).toBe('c2');
    expect(next.sessionState.answer_labels?.centre).toBe('Mbabane Centre');
  });

  it('renders the label (not the raw value) in the confirm summary', () => {
    const turn = startFlow(flow, 'en', ctx);
    const next = runFlowTurn(flow, turn.sessionState, '1', ctx);
    expect(renderStep(flow, next.sessionState, ctx)).toContain('Centre: Manzini Centre');
  });

  it('rejects input when no options are injected', () => {
    const turn = startFlow(flow, 'en', {});
    const next = runFlowTurn(flow, turn.sessionState, '1', {});
    expect(next.status).toBe('in_progress');
    expect(next.sessionState.step_index).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd _platform/guided-flow-engine && npx vitest run test/engine.dynamic.test.ts`
Expected: FAIL — `dynamic_choice` unknown / `ctx`/`answer_labels` absent.

- [ ] **Step 3: Extend the type schemas**

In `src/types.ts`, add a `dynamic_choice` variant to the `FieldSpecSchema` union, immediately after the `choice` variant line:

```ts
  z.object({ type: z.literal('dynamic_choice'), source: z.string().min(1) }),
```

Replace `FlowSessionStateSchema` with (adds `answer_labels`):

```ts
export const FlowSessionStateSchema = z.object({
  flow_key: z.string(),
  flow_version: z.number().int(),
  step_index: z.number().int().nonnegative(),
  answers: z.record(z.string(), z.union([z.string(), z.number()])),
  answer_labels: z.record(z.string(), z.string()).optional(),
  locale: LocaleSchema,
});
export type FlowSessionState = z.infer<typeof FlowSessionStateSchema>;
```

At the end of `src/types.ts`, add the context type:

```ts
export interface FlowContext {
  /** Resolved options for dynamic_choice steps, keyed by step.key. */
  options?: Record<string, ChoiceOption[]>;
}
```

- [ ] **Step 4: Handle `dynamic_choice` in the validator**

Replace the whole `case 'choice':` block in `src/validators.ts` with the two blocks below, and add the shared helper + the `ChoiceOption` import.

Update the import line at the top of `src/validators.ts`:

```ts
import type { FieldSpec, LocalizedText, AnswerValue, ChoiceOption } from './types.js';
```

Change the signature line to accept injected options:

```ts
export function validateField(spec: FieldSpec, raw: string, ctxOptions?: ChoiceOption[]): ValidationResult {
```

Replace the `case 'choice': { ... }` block with:

```ts
    case 'choice':
      return matchChoice(spec.options, input);
    case 'dynamic_choice': {
      if (!ctxOptions || ctxOptions.length === 0)
        return err(
          'No options are available right now. Please try again shortly.',
          'Akukho lokungakhetfwa kwanyalo. Sicela uzame futsi ngemuva kwesikhashana.', // TODO: siSwati review
        );
      return matchChoice(ctxOptions, input);
    }
```

Add this helper below the `err()` function:

```ts
function matchChoice(options: ChoiceOption[], input: string): ValidationResult {
  const idx = Number(input);
  if (Number.isInteger(idx) && idx >= 1 && idx <= options.length)
    return { ok: true, value: options[idx - 1].value };
  const byValue = options.find((o) => o.value.toLowerCase() === input.toLowerCase());
  if (byValue) return { ok: true, value: byValue.value };
  return err(
    `Please reply with a number from 1 to ${options.length}.`,
    `Sicela uphendvule ngenombolo kusukela ku-1 kuya ku-${options.length}.`,
  );
}
```

- [ ] **Step 5: Thread `ctx` through the engine**

Replace the entire contents of `src/engine.ts` with:

```ts
import type {
  ChoiceOption,
  FlowContext,
  FlowDefinition,
  FlowSessionState,
  FlowStep,
  FlowTurnResult,
  Locale,
  LocalizedText,
} from './types.js';
import { validateField } from './validators.js';

function t(text: LocalizedText, locale: Locale): string {
  return text[locale];
}

const SKIP_WORDS = ['skip', '-', 'none', 'yeka'];
const BACK_WORDS = ['back', 'emuva'];

function skipHint(locale: Locale): string {
  return locale === 'ss'
    ? '(Loba "yeka" kute uyekele.)' // TODO: siSwati review
    : '(Reply "skip" to leave this blank.)';
}

function isSkip(input: string): boolean {
  return SKIP_WORDS.includes(input.trim().toLowerCase());
}

function optionsFor(step: FlowStep, ctx: FlowContext): ChoiceOption[] {
  return ctx.options?.[step.key] ?? [];
}

export function renderStep(
  flow: FlowDefinition,
  state: FlowSessionState,
  ctx: FlowContext = {},
): string {
  const step = flow.steps[state.step_index];
  const locale = state.locale;

  if (step.field.type === 'confirm') {
    const lines = flow.steps
      .filter((s) => s.field.type !== 'confirm')
      .map((s) => {
        const label = s.summary_label ? t(s.summary_label, locale) : s.key;
        const ans = state.answers[s.key];
        let display: string;
        if (s.field.type === 'choice' && ans !== undefined) {
          const opt = s.field.options.find((o) => o.value === ans);
          display = opt ? t(opt.label, locale) : String(ans);
        } else if (s.field.type === 'dynamic_choice' && ans !== undefined) {
          display = state.answer_labels?.[s.key] ?? String(ans);
        } else if (s.field.type === 'money' && typeof ans === 'number') {
          display = (ans / 100).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        } else {
          display = ans !== undefined ? String(ans) : '-';
        }
        return `• ${label}: ${display}`;
      });
    return [t(step.prompt, locale), '', ...lines].join('\n');
  }

  let body = t(step.prompt, locale);
  if (step.help) body += `\n${t(step.help, locale)}`;
  if (step.field.type === 'choice') {
    const opts = step.field.options.map((o, i) => `${i + 1}. ${t(o.label, locale)}`);
    body += `\n${opts.join('\n')}`;
  } else if (step.field.type === 'dynamic_choice') {
    const opts = optionsFor(step, ctx).map((o, i) => `${i + 1}. ${t(o.label, locale)}`);
    if (opts.length > 0) body += `\n${opts.join('\n')}`;
  }
  if (step.optional) body += `\n${skipHint(locale)}`;
  return body;
}

export function startFlow(
  flow: FlowDefinition,
  locale: Locale,
  ctx: FlowContext = {},
): FlowTurnResult {
  const state: FlowSessionState = {
    flow_key: flow.key,
    flow_version: flow.version,
    step_index: 0,
    answers: {},
    answer_labels: {},
    locale,
  };
  return { sessionState: state, replies: [renderStep(flow, state, ctx)], status: 'in_progress' };
}

export function runFlowTurn(
  flow: FlowDefinition,
  state: FlowSessionState,
  input: string,
  ctx: FlowContext = {},
): FlowTurnResult {
  const locale = state.locale;
  const trimmed = input.trim();

  // Stale resumed session — reset to a fresh flow.
  if (state.flow_version !== flow.version) {
    const fresh = startFlow(flow, locale, ctx);
    const notice =
      locale === 'ss'
        ? 'Leli fomu livuselelisiwe. Asicaleni kabusha.'
        : 'This form was updated. Let us start over.';
    return { ...fresh, replies: [notice, ...fresh.replies] };
  }

  const step = flow.steps[state.step_index];

  // "back" — step back one (ignored at step 0, where it falls through as input).
  if (BACK_WORDS.includes(trimmed.toLowerCase()) && state.step_index > 0) {
    const prev: FlowSessionState = { ...state, step_index: state.step_index - 1 };
    return { sessionState: prev, replies: [renderStep(flow, prev, ctx)], status: 'in_progress' };
  }

  // Confirm step — "yes" completes, "no" cancels.
  if (step.field.type === 'confirm') {
    const confirmResult = validateField(step.field, trimmed);
    if (!confirmResult.ok) {
      return {
        sessionState: state,
        replies: [confirmResult.error[locale], renderStep(flow, state, ctx)],
        status: 'in_progress',
      };
    }
    if (confirmResult.value === 'yes') {
      return { sessionState: state, replies: [], status: 'complete', answers: { ...state.answers } };
    }
    return { sessionState: state, replies: [], status: 'cancelled' };
  }

  // Optional step — a skip token advances without storing an answer.
  if (step.optional && isSkip(trimmed)) {
    const nextState: FlowSessionState = { ...state, step_index: state.step_index + 1 };
    return { sessionState: nextState, replies: [renderStep(flow, nextState, ctx)], status: 'in_progress' };
  }

  // Dynamic choice — validate against injected options and record the label.
  if (step.field.type === 'dynamic_choice') {
    const opts = optionsFor(step, ctx);
    const result = validateField(step.field, trimmed, opts);
    if (!result.ok) {
      return {
        sessionState: state,
        replies: [result.error[locale], renderStep(flow, state, ctx)],
        status: 'in_progress',
      };
    }
    const chosen = opts.find((o) => o.value === result.value);
    const nextState: FlowSessionState = {
      ...state,
      step_index: state.step_index + 1,
      answers: { ...state.answers, [step.key]: result.value },
      answer_labels: {
        ...(state.answer_labels ?? {}),
        [step.key]: chosen ? chosen.label[locale] : String(result.value),
      },
    };
    return { sessionState: nextState, replies: [renderStep(flow, nextState, ctx)], status: 'in_progress' };
  }

  // Data step — validate, store, advance.
  const result = validateField(step.field, trimmed);
  if (!result.ok) {
    return {
      sessionState: state,
      replies: [result.error[locale], renderStep(flow, state, ctx)],
      status: 'in_progress',
    };
  }
  const nextState: FlowSessionState = {
    ...state,
    step_index: state.step_index + 1,
    answers: { ...state.answers, [step.key]: result.value },
  };
  return { sessionState: nextState, replies: [renderStep(flow, nextState, ctx)], status: 'in_progress' };
}
```

- [ ] **Step 6: Run the full suite**

Run: `cd _platform/guided-flow-engine && npx vitest run`
Expected: PASS — new dynamic + optional tests plus every pre-existing test.

- [ ] **Step 7: Commit**

```bash
cd _platform/guided-flow-engine
git add src/types.ts src/validators.ts src/engine.ts test/engine.dynamic.test.ts
git commit -m "feat(engine): dynamic_choice field with portal-injected options"
```

---

### Task 3: Publish engine 0.2.0

**Files:**
- Modify: `package.json` (version bump)
- Build: `dist/` via the package's build script

**Interfaces:**
- Produces: `@govsz/guided-flow-engine@0.2.0` with the new exports resolvable by portals.

- [ ] **Step 1: Bump the version**

In `_platform/guided-flow-engine/package.json`, change `"version": "0.1.0"` to `"version": "0.2.0"`.

- [ ] **Step 2: Build the dist**

Run: `cd _platform/guided-flow-engine && npm run build`
Expected: `dist/` rebuilt with the new `index.d.ts` exporting `FlowContext` and the `dynamic_choice` field.

- [ ] **Step 3: Verify the new exports are present**

Run: `cd _platform/guided-flow-engine && grep -l FlowContext dist/index.d.ts && grep -l dynamic_choice dist/types.d.ts`
Expected: both files match.

- [ ] **Step 4: Commit**

```bash
cd _platform/guided-flow-engine
git add package.json dist
git commit -m "chore(engine): release 0.2.0 (dynamic_choice + optional steps)"
```

---

## PHASE B — `mcit/brp` sole-proprietor flow → engine

Work in `mcit/brp/` on a new branch `whatsapp-guided-flows`. First re-pin the engine dependency to `0.2.0` (however the portal resolves it — git ref/tarball; match the existing pin style in `apps/server/package.json`) and run `pnpm install`.

### Task 4: Define `soleProprietorApplyFlow`

**Files:**
- Create: `mcit/brp/apps/server/src/whatsapp/apply-flow.ts`
- Test: `mcit/brp/apps/server/src/whatsapp/apply-flow.test.ts`

**Interfaces:**
- Produces: `export const soleProprietorApplyFlow: FlowDefinition` with step keys `proprietor_name`, `business_name_1`, `business_name_2` (optional), `business_name_3` (optional), `business_activity`, `trading_address`, `confirm`.

- [ ] **Step 1: Write the failing test**

Create `apply-flow.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FlowDefinitionSchema } from '@govsz/guided-flow-engine';
import { soleProprietorApplyFlow } from './apply-flow.js';

describe('soleProprietorApplyFlow', () => {
  it('is a valid FlowDefinition', () => {
    expect(() => FlowDefinitionSchema.parse(soleProprietorApplyFlow)).not.toThrow();
  });

  it('collects proprietor, up to three names, activity, address then confirms', () => {
    expect(soleProprietorApplyFlow.steps.map((s) => s.key)).toEqual([
      'proprietor_name',
      'business_name_1',
      'business_name_2',
      'business_name_3',
      'business_activity',
      'trading_address',
      'confirm',
    ]);
  });

  it('marks the 2nd and 3rd business names optional', () => {
    const opt = soleProprietorApplyFlow.steps.filter((s) => s.optional).map((s) => s.key);
    expect(opt).toEqual(['business_name_2', 'business_name_3']);
  });

  it('uses draft_then_portal completion', () => {
    expect(soleProprietorApplyFlow.completion.mode).toBe('draft_then_portal');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcit/brp && pnpm --filter @brp/server exec vitest run apps/server/src/whatsapp/apply-flow.test.ts`
(If the filter name differs, use the server package name from `apps/server/package.json`.)
Expected: FAIL — module not found.

- [ ] **Step 3: Create the flow definition**

Create `apply-flow.ts`:

```ts
import type { FlowDefinition } from '@govsz/guided-flow-engine';

// TODO: siSwati review — provisional copy throughout.
export const soleProprietorApplyFlow: FlowDefinition = {
  key: 'sole_proprietor_apply',
  version: 1,
  title: {
    en: 'Register a sole proprietor business name',
    ss: 'Bhalisa libito lebhizinisi lomuntfu munye',
  },
  completion: {
    mode: 'draft_then_portal',
    portal_deeplink_path: '/sole-proprietor/drafts/',
  },
  steps: [
    {
      key: 'proprietor_name',
      prompt: { en: 'What is the proprietor full name?', ss: 'Ngubani libito leliphelele lomnikati?' },
      summary_label: { en: 'Proprietor', ss: 'Umnikati' },
      field: { type: 'text', min: 2, max: 120 },
    },
    {
      key: 'business_name_1',
      prompt: { en: 'What is your first-choice business name?', ss: 'Ngiliphi libito lebhizinisi lokhetsa kucala?' },
      summary_label: { en: 'Business name (1st)', ss: 'Libito (1)' },
      field: { type: 'text', min: 2, max: 120 },
    },
    {
      key: 'business_name_2',
      prompt: { en: 'Second-choice business name?', ss: 'Libito lebhizinisi lesibili?' },
      summary_label: { en: 'Business name (2nd)', ss: 'Libito (2)' },
      optional: true,
      field: { type: 'text', min: 2, max: 120 },
    },
    {
      key: 'business_name_3',
      prompt: { en: 'Third-choice business name?', ss: 'Libito lebhizinisi lesitsatfu?' },
      summary_label: { en: 'Business name (3rd)', ss: 'Libito (3)' },
      optional: true,
      field: { type: 'text', min: 2, max: 120 },
    },
    {
      key: 'business_activity',
      prompt: { en: 'What will the business do? (e.g. retail grocery shop)', ss: 'Bhizinisi litakwenta ini?' },
      summary_label: { en: 'Activity', ss: 'Umsebenti' },
      field: { type: 'text', min: 3, max: 200 },
    },
    {
      key: 'trading_address',
      prompt: { en: 'What is the trading address or town?', ss: 'Yiliphi likheli kumbe lidolobha lekutsengisela?' },
      summary_label: { en: 'Address', ss: 'Likheli' },
      field: { type: 'text', min: 3, max: 160 },
    },
    {
      key: 'confirm',
      prompt: { en: 'Please review your draft:', ss: 'Sicela ubukete lidlafu lakho:' },
      field: { type: 'confirm' },
    },
  ],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mcit/brp && pnpm --filter @brp/server exec vitest run apps/server/src/whatsapp/apply-flow.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd mcit/brp
git add apps/server/src/whatsapp/apply-flow.ts apps/server/src/whatsapp/apply-flow.test.ts
git commit -m "feat(brp): guided sole-proprietor apply flow definition"
```

---

### Task 5: Engine-backed bot state machine for brp

**Files:**
- Create: `mcit/brp/apps/server/src/whatsapp/bot.ts`
- Modify: `mcit/brp/apps/server/src/whatsapp/sole-prop.ts` (keep `SoleProprietorDraftStore` + `InMemorySoleProprietorDraftStore` + `SolePropDraftInput`/`SolePropDraft`; delete `handleSolePropTurn`, `SolePropSessionState`, `SolePropStep`, and the free-text helpers)
- Test: `mcit/brp/apps/server/src/whatsapp/bot.test.ts`

**Interfaces:**
- Consumes: `soleProprietorApplyFlow`; `SoleProprietorDraftStore` (`create(input: SolePropDraftInput)`).
- Produces: `handleMessage(state, message, deps)` returning `{ newState, replies, terminal, flow }`, mirroring `building-permits/apps/server/src/whatsapp/bot.ts`. `BotState = { tag: 'IDLE'; locale } | { tag: 'APPLY_FLOW'; locale; flow: FlowSessionState }`.

- [ ] **Step 1: Write the failing test**

Create `bot.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { handleMessage, type BotState } from './bot.js';
import { InMemorySoleProprietorDraftStore } from './sole-prop.js';

function deps() {
  return { webBaseUrl: 'https://brp.example', draftStore: new InMemorySoleProprietorDraftStore() };
}

describe('brp WhatsApp bot', () => {
  it('greets with a menu that offers the guided registration', async () => {
    const r = await handleMessage(null, { msisdn: '+26876000000', text: 'hi' }, deps());
    expect(r.replies[0].body.toLowerCase()).toContain('register');
    expect(r.flow).toBe('menu');
  });

  it('runs the guided flow and creates a draft on confirm', async () => {
    const d = deps();
    let state: BotState | null = null;
    const send = async (text: string) => {
      const r = await handleMessage(state, { msisdn: '+26876000000', text }, d);
      state = r.terminal ? null : r.newState;
      return r;
    };
    await send('1'); // start apply from the menu
    await send('Sipho Dlamini'); // proprietor_name
    await send('Sipho Groceries'); // business_name_1
    await send('skip'); // business_name_2
    await send('skip'); // business_name_3
    await send('Retail grocery shop'); // business_activity
    await send('Manzini'); // trading_address
    const done = await send('yes'); // confirm
    expect(done.terminal).toBe(true);
    expect(done.replies[0].body).toContain('BRP-SP-');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcit/brp && pnpm --filter @brp/server exec vitest run apps/server/src/whatsapp/bot.test.ts`
Expected: FAIL — `bot.js` not found.

- [ ] **Step 3: Trim `sole-prop.ts` to the store contract**

In `mcit/brp/apps/server/src/whatsapp/sole-prop.ts`, delete `SolePropStep`, `SolePropSessionState`, `isSolePropStart`, `isCompanyStart`, `parseBusinessNames`, `renderReview`, and `handleSolePropTurn`. Keep `SolePropDraftInput`, `SolePropDraft`, `SoleProprietorDraftStore`, and `InMemorySoleProprietorDraftStore`. (These are the only symbols `bot.ts` and the store consumers need.)

- [ ] **Step 4: Create `bot.ts`**

Create `bot.ts` (mirrors the building-permits bot, minus the read-only lookups brp does not have):

```ts
import { startFlow, runFlowTurn, type FlowSessionState } from '@govsz/guided-flow-engine';
import { soleProprietorApplyFlow } from './apply-flow.js';
import type { SoleProprietorDraftStore } from './sole-prop.js';

export type Locale = 'en' | 'ss';

export type BotState =
  | { tag: 'IDLE'; locale: Locale }
  | { tag: 'APPLY_FLOW'; locale: Locale; flow: FlowSessionState };

export interface BotMessage {
  msisdn: string;
  text: string;
}

export interface BotDeps {
  webBaseUrl: string;
  draftStore: SoleProprietorDraftStore;
}

export type BotFlow = 'menu' | 'apply';

export interface HandleResult {
  newState: BotState;
  replies: Array<{ body: string }>;
  terminal: boolean;
  flow: BotFlow;
}

// TODO: siSwati review — provisional copy.
const MENU: Record<Locale, string> = {
  en:
    'Welcome to EasyBusiness Business Registration.\n\n' +
    'Reply with a number:\n' +
    '1. Register a sole proprietor business name',
  ss:
    'Wemukelekile ku-EasyBusiness Business Registration.\n\n' +
    'Phendvula ngenombolo:\n' +
    '1. Bhalisa libito lebhizinisi lomuntfu munye',
};

function detectLocale(text: string, fallback: Locale): Locale {
  const t = text.trim().toLowerCase();
  if (t === 'ss' || t === 'siswati' || t === 'lusuthu') return 'ss';
  if (t === 'en' || t === 'english') return 'en';
  return fallback;
}

export async function handleMessage(
  state: BotState | null,
  message: BotMessage,
  deps: BotDeps,
): Promise<HandleResult> {
  const current: BotState = state ?? { tag: 'IDLE', locale: 'en' };
  const locale = detectLocale(message.text, current.locale);
  const text = message.text.trim();

  // Continue an in-progress guided flow first, so typed answers are never
  // swallowed by the greeting/menu shortcuts.
  if (current.tag === 'APPLY_FLOW') {
    const turn = runFlowTurn(soleProprietorApplyFlow, current.flow, message.text);
    if (turn.status === 'in_progress') {
      return {
        newState: { tag: 'APPLY_FLOW', locale: current.locale, flow: turn.sessionState },
        replies: turn.replies.map((body) => ({ body })),
        terminal: false,
        flow: 'apply',
      };
    }
    if (turn.status === 'cancelled') {
      const body =
        current.locale === 'ss'
          ? 'Lidlafu lakho licishiwe. Loba "menu" kute ucale futsi.'
          : 'Your draft has been cancelled. Reply "menu" to start again.';
      return { newState: { tag: 'IDLE', locale: current.locale }, replies: [{ body }], terminal: true, flow: 'apply' };
    }
    // complete
    const a = turn.answers as Record<string, string>;
    const names = [a.business_name_1, a.business_name_2, a.business_name_3].filter(Boolean) as string[];
    const draft = await deps.draftStore.create({
      proprietorName: a.proprietor_name,
      businessNameOptions: names,
      businessActivity: a.business_activity,
      tradingAddress: a.trading_address,
      contactMsisdn: message.msisdn,
    });
    const url = `${deps.webBaseUrl.replace(/\/+$/u, '')}/auth/login?next=/sole-proprietor/drafts/${encodeURIComponent(draft.reference)}`;
    const body =
      current.locale === 'ss'
        ? `Lidlafu ${draft.reference} lakhiwe. Vula ${url} kute ungene nge-gov.sz IAM, ubukete, ufake sicelo semtsetfo.`
        : `Draft ${draft.reference} created. Open ${url} to sign in with gov.sz IAM, review, and legally submit.`;
    return { newState: { tag: 'IDLE', locale: current.locale }, replies: [{ body }], terminal: true, flow: 'apply' };
  }

  // IDLE — a menu digit or an apply intent starts the guided flow.
  if (text === '1') {
    const r = startFlow(soleProprietorApplyFlow, locale);
    return {
      newState: { tag: 'APPLY_FLOW', locale, flow: r.sessionState },
      replies: r.replies.map((body) => ({ body })),
      terminal: false,
      flow: 'apply',
    };
  }

  // Anything else in IDLE — greeting or unrecognised — shows the menu.
  return { newState: { tag: 'IDLE', locale }, replies: [{ body: MENU[locale] }], terminal: true, flow: 'menu' };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd mcit/brp && pnpm --filter @brp/server exec vitest run apps/server/src/whatsapp/bot.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd mcit/brp
git add apps/server/src/whatsapp/bot.ts apps/server/src/whatsapp/bot.test.ts apps/server/src/whatsapp/sole-prop.ts
git commit -m "feat(brp): engine-backed WhatsApp bot for sole-proprietor apply"
```

---

### Task 6: Wire the new bot into the turn route

**Files:**
- Modify: `mcit/brp/apps/server/src/whatsapp/route.ts` (call `handleMessage`; parse/return the `BotState` session)
- Modify: `mcit/brp/apps/server/src/server.ts` (unchanged wiring shape — still passes `draftStore`; verify it compiles against the new route options)
- Rewrite: `mcit/brp/apps/server/src/__tests__/whatsapp-turn.test.ts`

**Interfaces:**
- Consumes: `handleMessage`, `BotState` from `./bot.js`.
- Produces: `POST /v1/channels/whatsapp/turn` returning `{ replies, session_state, terminal, audit }` with `session_state` being the `BotState` (or `null` when terminal).

- [ ] **Step 1: Rewrite the route**

Replace the whole body of `mcit/brp/apps/server/src/whatsapp/route.ts` with:

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { isBearerValid } from '../auth.js';
import { FlowSessionStateSchema } from '@govsz/guided-flow-engine';
import { handleMessage, type BotState } from './bot.js';
import type { SoleProprietorDraftStore } from './sole-prop.js';

const TurnBody = z.object({
  msisdn: z.string().regex(/^\+\d{8,15}$/u),
  message_id: z.string().min(1).max(200),
  text: z.string().trim().min(1).max(4000),
  timestamp: z.string(),
  locale: z.enum(['en', 'ss']).default('en'),
  source: z.string().optional(),
  session_state: z.unknown().optional().nullable(),
});

const IdleState = z.object({ tag: z.literal('IDLE'), locale: z.enum(['en', 'ss']) });
const ApplyState = z.object({
  tag: z.literal('APPLY_FLOW'),
  locale: z.enum(['en', 'ss']),
  flow: FlowSessionStateSchema,
});
const SessionState = z.union([IdleState, ApplyState]);

export interface WhatsAppTurnRouteOptions {
  serviceApiKey: string;
  draftStore: SoleProprietorDraftStore;
  webBaseUrl: string;
}

function parseSessionState(input: unknown): BotState | null {
  if (input === null || input === undefined) return null;
  const parsed = SessionState.safeParse(input);
  return parsed.success ? (parsed.data as BotState) : null;
}

export async function registerWhatsAppTurnRoute(
  app: FastifyInstance,
  opts: WhatsAppTurnRouteOptions,
): Promise<void> {
  app.post('/v1/channels/whatsapp/turn', async (request, reply) => {
    if (!isBearerValid(request.headers.authorization, opts.serviceApiKey)) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    const parsed = TurnBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'validation_failed', details: parsed.error.issues });
    }
    const body = parsed.data;

    const previous = parseSessionState(body.session_state);
    const state: BotState = previous ?? { tag: 'IDLE', locale: body.locale };

    const result = await handleMessage(state, { msisdn: body.msisdn, text: body.text }, {
      webBaseUrl: opts.webBaseUrl,
      draftStore: opts.draftStore,
    });

    return reply.code(200).send({
      replies: result.replies,
      session_state: result.terminal ? null : result.newState,
      terminal: result.terminal,
      audit: { flow: result.flow, message_id: body.message_id, channel: 'central_whatsapp' },
    });
  });
}
```

- [ ] **Step 2: Rewrite the route test**

Replace `mcit/brp/apps/server/src/__tests__/whatsapp-turn.test.ts` with a test that drives the guided flow end-to-end through the HTTP route. Use the existing test's app-builder/bearer setup (read the current file for the exact `buildServer`/token helper it uses), then:

```ts
// ...existing imports + app build with a valid bearer token (BEARER) and an
// InMemorySoleProprietorDraftStore injected via buildServer({ draftStore })...

async function turn(app, token, text, session_state = null) {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/channels/whatsapp/turn',
    headers: { authorization: `Bearer ${token}` },
    payload: { msisdn: '+26876000000', message_id: `m-${Math.random()}`, text, timestamp: '2026-07-05T00:00:00Z', session_state },
  });
  return res.json();
}

it('walks the guided sole-proprietor flow to a draft', async () => {
  let s = null;
  const step = async (text) => { const j = await turn(app, BEARER, text, s); s = j.session_state; return j; };
  await step('1');
  await step('Sipho Dlamini');
  await step('Sipho Groceries');
  await step('skip');
  await step('skip');
  await step('Retail grocery shop');
  await step('Manzini');
  const done = await step('yes');
  expect(done.terminal).toBe(true);
  expect(done.replies[0].body).toContain('BRP-SP-');
});

it('rejects a missing/invalid bearer with 401', async () => {
  const res = await app.inject({
    method: 'POST', url: '/v1/channels/whatsapp/turn',
    headers: { authorization: 'Bearer wrong' },
    payload: { msisdn: '+26876000000', message_id: 'm1', text: 'hi', timestamp: '2026-07-05T00:00:00Z' },
  });
  expect(res.statusCode).toBe(401);
});
```

- [ ] **Step 3: Run the full server test suite**

Run: `cd mcit/brp && pnpm --filter @brp/server exec vitest run`
Expected: PASS (route + bot + flow tests; no references to the deleted `handleSolePropTurn`).

- [ ] **Step 4: Typecheck**

Run: `cd mcit/brp && pnpm --filter @brp/server exec tsc --noEmit`
Expected: no errors (confirms `server.ts` still compiles against the new route options).

- [ ] **Step 5: Commit**

```bash
cd mcit/brp
git add apps/server/src/whatsapp/route.ts apps/server/src/__tests__/whatsapp-turn.test.ts
git commit -m "feat(brp): route the WhatsApp turn through the guided bot"
```

---

## PHASE C — `mopwt/road-permits` net-new guided apply flow

Work in `mopwt/road-permits/` on a new branch `whatsapp-guided-flows`. Re-pin `@govsz/guided-flow-engine` to `0.2.0` in `apps/server/package.json` (match the existing pin style) and `pnpm install`.

### Task 7: `DRAFT` status + refNo sequence migration

**Files:**
- Modify: `mopwt/road-permits/packages/db/prisma/schema.prisma` (add `DRAFT` to `RtspApplicationStatus`; add `intakeChannel`)
- Create: a Prisma migration under `mopwt/road-permits/packages/db/prisma/migrations/`

**Interfaces:**
- Produces: `RtspApplicationStatus.DRAFT`; `RtspApplication.intakeChannel String @default("WEB")`; SQL sequence `road_permit_refno_seq`.

- [ ] **Step 1: Confirm current migration state**

Run: `cd mopwt/road-permits && ls packages/db/prisma/migrations && grep -n "RtspApplicationStatus" packages/db/prisma/schema.prisma`
Expected: note whether a baseline migration exists. If the DB is still resettable dev-phase, prefer folding this into the baseline (per the portal's clean-slate migration hygiene) rather than create-then-drop; otherwise add a new migration as below.

- [ ] **Step 2: Edit the schema**

In `schema.prisma`, add `DRAFT` as the **first** value of `enum RtspApplicationStatus`:

```prisma
enum RtspApplicationStatus {
  DRAFT
  SUBMITTED
  EVIDENCE_REVIEW
  BOARD_REFERRAL
  HEARING_SCHEDULED
  DECISION_RECORDED
  ISSUED
  REFUSED
  WITHDRAWN
}
```

In `model RtspApplication`, add below `currentStatus`:

```prisma
  intakeChannel     String                  @default("WEB")
```

- [ ] **Step 3: Generate the migration**

Run: `cd mopwt/road-permits && pnpm --filter @mopwt-rp/db exec prisma migrate dev --name whatsapp_apply_flow`
(Use the db package name from `packages/db/package.json` if it differs.)

- [ ] **Step 4: Add the refNo sequence to the migration SQL**

Append to the generated `.../migrations/<timestamp>_whatsapp_apply_flow/migration.sql`:

```sql
-- Race-free reference-number allocator for WhatsApp-created applications.
-- Started at 100000 so RTSP-<year>-1NNNNN refNos never collide with any
-- counter-based allocator's RTSP-<year>-0NNNNN range.
CREATE SEQUENCE IF NOT EXISTS road_permit_refno_seq START 100000;
```

Then re-apply: `pnpm --filter @mopwt-rp/db exec prisma migrate dev`
Expected: migration applies cleanly; `prisma generate` refreshes the client with `DRAFT` + `intakeChannel`.

- [ ] **Step 5: Commit**

```bash
cd mopwt/road-permits
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat(road-permits): DRAFT status + refNo sequence for WhatsApp intake"
```

---

### Task 8: Define `roadPermitApplyFlow`

**Files:**
- Create: `mopwt/road-permits/apps/server/src/whatsapp/apply-flow.ts`
- Test: `mopwt/road-permits/apps/server/src/whatsapp/apply-flow.test.ts`

**Interfaces:**
- Produces: `export const roadPermitApplyFlow: FlowDefinition` with keys `intake_type`, `operator_name`, `applicant_name`, `service_class`, `vehicle_reg`, `route_description`, `contact_msisdn`, `confirm`. Choice `value`s equal the Prisma enum values.

- [ ] **Step 1: Write the failing test**

Create `apply-flow.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FlowDefinitionSchema } from '@govsz/guided-flow-engine';
import { roadPermitApplyFlow } from './apply-flow.js';

describe('roadPermitApplyFlow', () => {
  it('is a valid FlowDefinition', () => {
    expect(() => FlowDefinitionSchema.parse(roadPermitApplyFlow)).not.toThrow();
  });
  it('has the expected step order', () => {
    expect(roadPermitApplyFlow.steps.map((s) => s.key)).toEqual([
      'intake_type', 'operator_name', 'applicant_name', 'service_class',
      'vehicle_reg', 'route_description', 'contact_msisdn', 'confirm',
    ]);
  });
  it('maps service_class options to the RtspServiceClass enum', () => {
    const sc = roadPermitApplyFlow.steps.find((s) => s.key === 'service_class');
    const values = sc?.field.type === 'choice' ? sc.field.options.map((o) => o.value) : [];
    expect(values).toEqual(['TAXI', 'KOMBI', 'BUS', 'FREIGHT', 'OTHER']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mopwt/road-permits && pnpm --filter @mopwt-rp/server exec vitest run apps/server/src/whatsapp/apply-flow.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the flow definition**

Create `apply-flow.ts`:

```ts
import type { FlowDefinition } from '@govsz/guided-flow-engine';

// TODO: siSwati review — provisional copy throughout.
export const roadPermitApplyFlow: FlowDefinition = {
  key: 'road_permit_apply',
  version: 1,
  title: { en: 'Apply for a road transportation permit', ss: 'Faka sicelo semvume yetekuhamba' },
  completion: { mode: 'draft_then_portal', portal_deeplink_path: '/services/rtsp/applications/' },
  steps: [
    {
      key: 'intake_type',
      prompt: { en: 'Is this a first-time application or a renewal?', ss: 'Ngumsebenti wekucala kumbe kuvuselela?' },
      summary_label: { en: 'Type', ss: 'Luhlobo' },
      field: { type: 'choice', options: [
        { value: 'FIRST_TIME', label: { en: 'First-time', ss: 'Kwekucala' } },
        { value: 'RENEWAL', label: { en: 'Renewal', ss: 'Kuvuselela' } },
      ] },
    },
    {
      key: 'operator_name',
      prompt: { en: 'What is the operator (business) name?', ss: 'Ngubani libito lebhizinisi lelisebentako?' },
      summary_label: { en: 'Operator', ss: 'Umnikati wenshini' },
      field: { type: 'text', min: 2, max: 160 },
    },
    {
      key: 'applicant_name',
      prompt: { en: 'What is your full name?', ss: 'Ngubani libito lakho leliphelele?' },
      summary_label: { en: 'Applicant', ss: 'Lofaka sicelo' },
      field: { type: 'text', min: 2, max: 120 },
    },
    {
      key: 'service_class',
      prompt: { en: 'What class of service?', ss: 'Luhlobo luni lwenkonzo?' },
      summary_label: { en: 'Service class', ss: 'Luhlobo lwenkonzo' },
      field: { type: 'choice', options: [
        { value: 'TAXI', label: { en: 'Taxi', ss: 'Themksi' } },
        { value: 'KOMBI', label: { en: 'Kombi', ss: 'Khombi' } },
        { value: 'BUS', label: { en: 'Bus', ss: 'Bhasi' } },
        { value: 'FREIGHT', label: { en: 'Freight / goods', ss: 'Timphahla' } },
        { value: 'OTHER', label: { en: 'Other', ss: 'Lokunye' } },
      ] },
    },
    {
      key: 'vehicle_reg',
      prompt: { en: 'What is the vehicle registration number?', ss: 'Ngiyiphi inombolo yekubhaliswa kwemoto?' },
      summary_label: { en: 'Vehicle', ss: 'Imoto' },
      field: { type: 'text', min: 2, max: 20 },
    },
    {
      key: 'route_description',
      prompt: { en: 'Describe the route (origin — via — destination).', ss: 'Chaza indlela (lapho ucala — udlula — uphelela khona).' },
      summary_label: { en: 'Route', ss: 'Indlela' },
      field: { type: 'text', min: 3, max: 300 },
    },
    {
      key: 'contact_msisdn',
      prompt: { en: 'Confirm your contact phone number.', ss: 'Cinisekisa inombolo yakho yelucingo.' },
      summary_label: { en: 'Contact', ss: 'Inombolo' },
      field: { type: 'msisdn' },
    },
    {
      key: 'confirm',
      prompt: { en: 'Please review your application:', ss: 'Sicela ubukete sicelo sakho:' },
      field: { type: 'confirm' },
    },
  ],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mopwt/road-permits && pnpm --filter @mopwt-rp/server exec vitest run apps/server/src/whatsapp/apply-flow.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd mopwt/road-permits
git add apps/server/src/whatsapp/apply-flow.ts apps/server/src/whatsapp/apply-flow.test.ts
git commit -m "feat(road-permits): guided road-permit apply flow definition"
```

---

### Task 9: Add the `APPLY_FLOW` branch + `createApplication` dep

**Files:**
- Modify: `mopwt/road-permits/apps/server/src/whatsapp/bot.ts` (add `APPLY_FLOW` state, menu option 3 → apply, `createApplication` dep, completion handler)
- Test: `mopwt/road-permits/apps/server/src/whatsapp/bot.apply.test.ts` (create)

**Interfaces:**
- Consumes: `roadPermitApplyFlow`; `startFlow`/`runFlowTurn`/`FlowSessionState`.
- Produces:
  - `BotState` gains `| { tag: 'APPLY_FLOW'; locale: Locale; flow: FlowSessionState }`.
  - `BotDeps` gains `createApplication(input: { contactMsisdn: string; answers: Record<string, string> }): Promise<string>` (returns refNo).
  - `BotFlow` gains `'apply'`.

- [ ] **Step 1: Write the failing test**

Create `bot.apply.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { handleMessage, type BotState, type BotDeps } from './bot.js';

function deps(): BotDeps {
  return {
    webBaseUrl: 'https://rp.example',
    lookupApplication: async () => null,
    lookupPermit: async () => null,
    createApplication: async () => 'RTSP-2026-100001',
  };
}

describe('road-permits guided apply', () => {
  it('menu option 3 starts the guided flow (not a web link)', async () => {
    const r = await handleMessage({ tag: 'IDLE', locale: 'en' }, { msisdn: '+26876000000', text: '3' }, deps());
    expect(r.flow).toBe('apply');
    expect(r.terminal).toBe(false);
    expect(r.replies[0].body).toContain('first-time');
  });

  it('walks the flow and creates a DRAFT application on confirm', async () => {
    const d = deps();
    let state: BotState | null = { tag: 'IDLE', locale: 'en' };
    const send = async (text: string) => {
      const r = await handleMessage(state, { msisdn: '+26876000000', text }, d);
      state = r.terminal ? null : r.newState;
      return r;
    };
    await send('3');            // intake_type prompt
    await send('1');            // FIRST_TIME
    await send('Sipho Transport'); // operator_name
    await send('Sipho Dlamini');   // applicant_name
    await send('1');            // TAXI
    await send('ABC 123 SD');   // vehicle_reg
    await send('Manzini - Matsapha - Mbabane'); // route_description
    await send('76000000');     // contact_msisdn
    const done = await send('yes'); // confirm
    expect(done.terminal).toBe(true);
    expect(done.replies[0].body).toContain('RTSP-2026-100001');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mopwt/road-permits && pnpm --filter @mopwt-rp/server exec vitest run apps/server/src/whatsapp/bot.apply.test.ts`
Expected: FAIL — `createApplication` / `APPLY_FLOW` not present.

- [ ] **Step 3: Extend `bot.ts`**

In `mopwt/road-permits/apps/server/src/whatsapp/bot.ts`:

(a) Add imports at the top:

```ts
import { startFlow, runFlowTurn, type FlowSessionState } from '@govsz/guided-flow-engine';
import { roadPermitApplyFlow } from './apply-flow.js';
```

(b) Extend the `BotState` union:

```ts
export type BotState =
  | { tag: 'IDLE'; locale: Locale }
  | { tag: 'AWAIT_STATUS_REF'; locale: Locale }
  | { tag: 'AWAIT_VERIFY_SERIAL'; locale: Locale }
  | { tag: 'APPLY_FLOW'; locale: Locale; flow: FlowSessionState };
```

(c) Extend `BotFlow`:

```ts
export type BotFlow = 'menu' | 'status' | 'verify' | 'apply_info' | 'apply';
```

(d) Add to the `BotDeps` interface:

```ts
  /** Persists a DRAFT WhatsApp application; resolves to its refNo. */
  createApplication(input: { contactMsisdn: string; answers: Record<string, string> }): Promise<string>;
```

(e) At the **top** of `handleMessage`, immediately after `const current: BotState = ...`, add the in-progress-flow branch (before the keyword shortcuts, so typed answers are not swallowed):

```ts
  if (current.tag === 'APPLY_FLOW') {
    const turn = runFlowTurn(roadPermitApplyFlow, current.flow, message.text);
    if (turn.status === 'in_progress') {
      return {
        newState: { tag: 'APPLY_FLOW', locale: current.locale, flow: turn.sessionState },
        replies: turn.replies.map((body) => ({ body })),
        terminal: false,
        flow: 'apply',
      };
    }
    if (turn.status === 'cancelled') {
      const body =
        current.locale === 'ss'
          ? 'Sicelo sakho sicishiwe. Loba "menu" kute ucale futsi.'
          : 'Your application has been cancelled. Reply "menu" to start again.';
      return { newState: { tag: 'IDLE', locale: current.locale }, replies: [{ body }], terminal: true, flow: 'apply' };
    }
    const refNo = await deps.createApplication({
      contactMsisdn: message.msisdn,
      answers: turn.answers as Record<string, string>,
    });
    const link = `${deps.webBaseUrl.replace(/\/+$/u, '')}/services/rtsp/applications/${refNo}`;
    const body =
      current.locale === 'ss'
        ? `Sicelo sakho sicalisiwe. Inombolo yakho: ${refNo}. Kute ucedze, layisha emaphepha lafunekako lapha: ${link}`
        : `Your application has been started. Your reference: ${refNo}. To finish, upload the required documents here: ${link}`;
    return { newState: { tag: 'IDLE', locale: current.locale }, replies: [{ body }], terminal: true, flow: 'apply' };
  }
```

(f) Replace the **menu option 3** block (currently the `if (text === '3')` that returns `applyInfo`) with a flow start:

```ts
  if (text === '3') {
    const r = startFlow(roadPermitApplyFlow, locale);
    return {
      newState: { tag: 'APPLY_FLOW', locale, flow: r.sessionState },
      replies: r.replies.map((body) => ({ body })),
      terminal: false,
      flow: 'apply',
    };
  }
```

(g) Replace the `APPLY_START` keyword block (the `if (APPLY_START.test(text)) { ...applyInfo... }`) with the same flow start so "apply"/"renew" also begins the guided flow:

```ts
  if (APPLY_START.test(text)) {
    const r = startFlow(roadPermitApplyFlow, locale);
    return {
      newState: { tag: 'APPLY_FLOW', locale, flow: r.sessionState },
      replies: r.replies.map((body) => ({ body })),
      terminal: false,
      flow: 'apply',
    };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mopwt/road-permits && pnpm --filter @mopwt-rp/server exec vitest run apps/server/src/whatsapp/bot.apply.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd mopwt/road-permits
git add apps/server/src/whatsapp/bot.ts apps/server/src/whatsapp/bot.apply.test.ts
git commit -m "feat(road-permits): guided apply flow in the WhatsApp bot"
```

---

### Task 10: Wire `createApplication` + `APPLY_FLOW` session into the route

**Files:**
- Modify: `mopwt/road-permits/apps/server/src/whatsapp/route.ts` (add `createApplication` to the Prisma-backed deps; accept the `APPLY_FLOW` session shape)
- Test: `mopwt/road-permits/apps/server/src/whatsapp/route.test.ts` (extend)

**Interfaces:**
- Consumes: Task 9's `BotDeps.createApplication`; `FlowSessionStateSchema` from the engine.
- Produces: the Prisma-backed `createApplication` writing a `DRAFT` `RtspApplication` + initial `RtspApplicationEvent`; the route's `parseSessionState` accepting `APPLY_FLOW`.

- [ ] **Step 1: Extend the session-state schema in the route**

In `mopwt/road-permits/apps/server/src/whatsapp/route.ts`, add the engine import and widen `SessionState`:

```ts
import { FlowSessionStateSchema } from '@govsz/guided-flow-engine';
```

Replace the `const SessionState = z.object({...})` with:

```ts
const ReadOnlyState = z.object({
  tag: z.enum(['IDLE', 'AWAIT_STATUS_REF', 'AWAIT_VERIFY_SERIAL']),
  locale: z.enum(['en', 'ss']),
});
const ApplyState = z.object({
  tag: z.literal('APPLY_FLOW'),
  locale: z.enum(['en', 'ss']),
  flow: FlowSessionStateSchema,
});
const SessionState = z.union([ReadOnlyState, ApplyState]);
```

- [ ] **Step 2: Add `createApplication` to the Prisma-backed deps**

Inside `createPrismaBackedBotDeps`, add this method to the returned object (after `lookupPermit`):

```ts
    async createApplication(input) {
      const year = new Date().getUTCFullYear();
      const rows = await prisma.$queryRaw<Array<{ nextval: bigint }>>`
        SELECT nextval('road_permit_refno_seq')`;
      const seq = Number(rows[0]?.nextval ?? 0);
      const refNo = `RTSP-${year}-${String(seq).padStart(6, '0')}`;
      const a = input.answers;
      await prisma.rtspApplication.create({
        data: {
          refNo,
          intakeType: a.intake_type as never,
          operatorName: a.operator_name,
          applicantName: a.applicant_name,
          serviceClass: a.service_class as never,
          vehicleReg: a.vehicle_reg,
          routeDescription: a.route_description,
          contactMsisdn: input.contactMsisdn,
          currentStage: 'WhatsApp draft',
          currentStatus: 'DRAFT',
          intakeChannel: 'WHATSAPP',
          history: {
            create: { stage: 'WhatsApp draft', status: 'DRAFT', notePublic: 'Started on WhatsApp' },
          },
        },
      });
      return refNo;
    },
```

- [ ] **Step 3: Extend the route test**

In `mopwt/road-permits/apps/server/src/whatsapp/route.test.ts`, add a guided-flow walk. Follow the file's existing app-build + bearer + Prisma-mock pattern; stub `rtspApplication.create` and the `$queryRaw` sequence call so `createApplication` returns a deterministic refNo, then drive `1,Sipho Transport,Sipho Dlamini,1,ABC 123 SD,route,76000000,yes` (prefixed by `3`) through the route, threading `session_state` each turn, and assert the final reply contains `RTSP-` and `terminal === true`. (Match the mock style already used for `lookupApplication`/`lookupPermit` in that file.)

- [ ] **Step 4: Run the full server suite + typecheck**

Run: `cd mopwt/road-permits && pnpm --filter @mopwt-rp/server exec vitest run && pnpm --filter @mopwt-rp/server exec tsc --noEmit`
Expected: PASS + no type errors.

- [ ] **Step 5: Commit**

```bash
cd mopwt/road-permits
git add apps/server/src/whatsapp/route.ts apps/server/src/whatsapp/route.test.ts
git commit -m "feat(road-permits): persist DRAFT applications from the guided WhatsApp flow"
```

---

## Post-phase verification

- [ ] Engine: `cd _platform/guided-flow-engine && npx vitest run` — all green; `building-permits` untouched.
- [ ] brp: guided flow reaches a `BRP-SP-` draft; `handleSolePropTurn` fully removed (`grep -r handleSolePropTurn mcit/brp/apps/server/src` returns nothing).
- [ ] road-permits: menu option 3 now opens the guided flow (no `/services/rtsp/apply` web link in the apply path); a `DRAFT` `RtspApplication` is written with an `RTSP-YYYY-NNNNNN` refNo.
- [ ] No portal other than the one edited rebuilds — only the `@govsz/guided-flow-engine` pin changed in brp and road-permits.

## Deferred to a follow-up plan

- **roadworthiness** booking/reschedule migration onto the engine (dynamic_choice for centre/date/slot; keep the plate short-circuit and `askAssistant` Q&A). Its parity oracle is `mopwt/roadworthiness/packages/bot/src/state-machine.test.ts`. Write that plan after this phase lands and the engine extension is proven.
- siSwati review pass over every `// TODO: siSwati review` block added in this phase.
```
