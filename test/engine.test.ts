import { describe, it, expect } from 'vitest';
import { startFlow, renderStep, runFlowTurn } from '../src/engine.js';
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

  it('appends a reply-with-a-number affordance to a choice step (en)', () => {
    const state = startFlow(demoFlow, 'en').sessionState;
    const rendered = renderStep(demoFlow, { ...state, step_index: 1 });
    expect(rendered).toContain('Reply with a number from 1 to 2.');
  });

  it('appends a reply-with-a-number affordance to a choice step (ss)', () => {
    const state = startFlow(demoFlow, 'ss').sessionState;
    const rendered = renderStep(demoFlow, { ...state, step_index: 1 });
    expect(rendered).toContain('Phendvula ngenombolo kusukela ku-1 kuya ku-2.');
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

describe('runFlowTurn — progression', () => {
  it('stores a valid answer and advances to the next step', () => {
    const state = startFlow(demoFlow, 'en').sessionState;
    const r = runFlowTurn(demoFlow, state, 'Sipho Dlamini');
    expect(r.status).toBe('in_progress');
    expect(r.sessionState.step_index).toBe(1);
    expect(r.sessionState.answers).toEqual({ name: 'Sipho Dlamini' });
    expect(r.replies[0]).toContain('Your role?');
  });

  it('re-prompts with a bilingual error on invalid input, state unchanged', () => {
    const state = startFlow(demoFlow, 'en').sessionState;
    const r = runFlowTurn(demoFlow, state, '   ');
    expect(r.status).toBe('in_progress');
    expect(r.sessionState.step_index).toBe(0);
    expect(r.replies[0]).toContain('Please enter a value.');
    expect(r.replies[1]).toContain('What is your name?');
  });

  it('renders the confirm summary after the last data step', () => {
    let state = startFlow(demoFlow, 'en').sessionState;
    state = runFlowTurn(demoFlow, state, 'Sipho').sessionState;
    const r = runFlowTurn(demoFlow, state, '1');
    expect(r.sessionState.step_index).toBe(2);
    expect(r.replies[0]).toContain('Name: Sipho');
    expect(r.replies[0]).toContain('Role: Owner');
  });
});

function atConfirm(locale: 'en' | 'ss' = 'en') {
  let state = startFlow(demoFlow, locale).sessionState;
  state = runFlowTurn(demoFlow, state, 'Sipho').sessionState;
  state = runFlowTurn(demoFlow, state, '1').sessionState;
  return state; // step_index === 2, the confirm step
}

describe('runFlowTurn — confirm and completion', () => {
  it('completes the flow on a "yes" at the confirm step', () => {
    const r = runFlowTurn(demoFlow, atConfirm(), 'yes');
    expect(r.status).toBe('complete');
    expect(r.answers).toEqual({ name: 'Sipho', role: 'owner' });
  });

  it('cancels the flow on a "no" at the confirm step', () => {
    const r = runFlowTurn(demoFlow, atConfirm(), 'no');
    expect(r.status).toBe('cancelled');
  });

  it('re-prompts on an unrecognised confirm answer', () => {
    const r = runFlowTurn(demoFlow, atConfirm(), 'maybe');
    expect(r.status).toBe('in_progress');
    expect(r.replies[0]).toContain("Please reply 'yes' or 'no'.");
  });
});

describe('runFlowTurn — back', () => {
  it('steps back one step and re-prompts', () => {
    let state = startFlow(demoFlow, 'en').sessionState;
    state = runFlowTurn(demoFlow, state, 'Sipho').sessionState; // now at step 1
    const r = runFlowTurn(demoFlow, state, 'back');
    expect(r.sessionState.step_index).toBe(0);
    expect(r.replies[0]).toContain('What is your name?');
  });

  it('ignores "back" at step 0 and treats it as input', () => {
    const state = startFlow(demoFlow, 'en').sessionState;
    const r = runFlowTurn(demoFlow, state, 'back');
    expect(r.sessionState.step_index).toBe(1);
    expect(r.sessionState.answers).toEqual({ name: 'back' });
  });
});

describe('runFlowTurn — version mismatch', () => {
  it('resets to step 0 with a notice when flow_version differs', () => {
    const stale = { ...startFlow(demoFlow, 'en').sessionState, flow_version: 0, step_index: 1 };
    const r = runFlowTurn(demoFlow, stale, 'anything');
    expect(r.status).toBe('in_progress');
    expect(r.sessionState.step_index).toBe(0);
    expect(r.sessionState.flow_version).toBe(1);
    expect(r.replies[0]).toContain('This form was updated');
  });
});

describe('engine — additional coverage', () => {
  it('handles "back" from the confirm step', () => {
    const r = runFlowTurn(demoFlow, atConfirm(), 'back');
    expect(r.status).toBe('in_progress');
    expect(r.sessionState.step_index).toBe(1);
    expect(r.replies[0]).toContain('Your role?');
  });

  it('accepts the siSwati back word "emuva"', () => {
    let state = startFlow(demoFlow, 'ss').sessionState;
    state = runFlowTurn(demoFlow, state, 'Sipho').sessionState;
    const r = runFlowTurn(demoFlow, state, 'emuva');
    expect(r.sessionState.step_index).toBe(0);
  });

  it('shows the siSwati notice on a version mismatch', () => {
    const stale = { ...startFlow(demoFlow, 'ss').sessionState, flow_version: 0 };
    const r = runFlowTurn(demoFlow, stale, 'x');
    expect(r.replies[0]).toContain('Leli fomu livuselelisiwe');
  });

  it('renders a money answer as a formatted amount in the confirm summary', () => {
    const moneyFlow: FlowDefinition = {
      key: 'm',
      version: 1,
      title: { en: 'M', ss: 'M' },
      steps: [
        {
          key: 'cost',
          prompt: { en: 'Cost?', ss: 'Litali?' },
          summary_label: { en: 'Cost', ss: 'Litali' },
          field: { type: 'money' },
        },
        { key: 'confirm', prompt: { en: 'OK?', ss: 'Kulungile?' }, field: { type: 'confirm' } },
      ],
      completion: { mode: 'submit_in_chat' },
    };
    const rendered = renderStep(moneyFlow, {
      flow_key: 'm',
      flow_version: 1,
      step_index: 1,
      answers: { cost: 2500050 },
      locale: 'en',
    });
    expect(rendered).toContain('Cost: 25,000.50');
  });
});
