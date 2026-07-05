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
