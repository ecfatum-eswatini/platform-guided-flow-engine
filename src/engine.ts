import type { FlowDefinition, FlowSessionState, FlowTurnResult, Locale, LocalizedText } from './types.js';
import { validateField } from './validators.js';

function t(text: LocalizedText, locale: Locale): string {
  return text[locale];
}

export function renderStep(flow: FlowDefinition, state: FlowSessionState): string {
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
  }
  return body;
}

export function startFlow(flow: FlowDefinition, locale: Locale): FlowTurnResult {
  const state: FlowSessionState = {
    flow_key: flow.key,
    flow_version: flow.version,
    step_index: 0,
    answers: {},
    locale,
  };
  return { sessionState: state, replies: [renderStep(flow, state)], status: 'in_progress' };
}

const BACK_WORDS = ['back', 'emuva'];

export function runFlowTurn(
  flow: FlowDefinition,
  state: FlowSessionState,
  input: string,
): FlowTurnResult {
  const locale = state.locale;
  const trimmed = input.trim();
  const step = flow.steps[state.step_index];

  const result = validateField(step.field, trimmed);
  if (!result.ok) {
    return {
      sessionState: state,
      replies: [result.error[locale], renderStep(flow, state)],
      status: 'in_progress',
    };
  }

  const nextState: FlowSessionState = {
    ...state,
    step_index: state.step_index + 1,
    answers: { ...state.answers, [step.key]: result.value },
  };
  return { sessionState: nextState, replies: [renderStep(flow, nextState)], status: 'in_progress' };
}
