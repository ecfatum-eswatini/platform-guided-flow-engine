import { describe, it, expect } from 'vitest';
import { startFlow, renderStep } from '../src/engine.js';
import type { FlowDefinition } from '../src/types.js';

export const demoFlow: FlowDefinition = {
  key: 'demo',
  version: 1,
  title: { en: 'Demo', ss: 'Demo' },
  steps: [
    {
      key: 'name',
      prompt: { en: 'What is your name?', ss: 'Ngubani ligama lakho?' },
      summary_label: { en: 'Name', ss: 'Ligama' },
      field: { type: 'text' },
    },
    {
      key: 'role',
      prompt: { en: 'Your role?', ss: 'Indzima yakho?' },
      summary_label: { en: 'Role', ss: 'Indzima' },
      field: {
        type: 'choice',
        options: [
          { value: 'owner', label: { en: 'Owner', ss: 'Umnikati' } },
          { value: 'agent', label: { en: 'Agent', ss: 'Ummeli' } },
        ],
      },
    },
    {
      key: 'confirm',
      prompt: { en: 'Please confirm:', ss: 'Sicela uqinisekise:' },
      field: { type: 'confirm' },
    },
  ],
  completion: { mode: 'submit_in_chat' },
};

describe('startFlow', () => {
  it('returns step 0 prompt and a fresh in_progress state', () => {
    const r = startFlow(demoFlow, 'en');
    expect(r.status).toBe('in_progress');
    expect(r.sessionState.step_index).toBe(0);
    expect(r.sessionState.answers).toEqual({});
    expect(r.replies[0]).toContain('What is your name?');
  });
});

describe('renderStep', () => {
  it('renders a choice step with numbered options', () => {
    const state = startFlow(demoFlow, 'en').sessionState;
    const rendered = renderStep(demoFlow, { ...state, step_index: 1 });
    expect(rendered).toContain('1. Owner');
    expect(rendered).toContain('2. Agent');
  });

  it('renders siSwati prompts when locale is ss', () => {
    const state = startFlow(demoFlow, 'ss').sessionState;
    expect(renderStep(demoFlow, state)).toContain('Ngubani ligama lakho?');
  });

  it('renders the confirm step as a summary of prior answers', () => {
    const rendered = renderStep(demoFlow, {
      flow_key: 'demo',
      flow_version: 1,
      step_index: 2,
      answers: { name: 'Sipho', role: 'owner' },
      locale: 'en',
    });
    expect(rendered).toContain('Name: Sipho');
    expect(rendered).toContain('Role: Owner');
  });
});
