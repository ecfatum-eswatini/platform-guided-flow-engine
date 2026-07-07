import { describe, it, expect } from 'vitest';
import type { FlowDefinition, FlowContext } from '../src/index.js';
import { startFlow, runFlowTurn, renderStep, FlowDefinitionSchema } from '../src/index.js';

// ---------------------------------------------------------------------------
// Backward-compat: a plain flow with none of the v0.4.0 fields (no branches,
// no vars, no interpolation tokens) must render + advance + complete exactly
// as it did pre-v0.4.0.
// ---------------------------------------------------------------------------

const plainFlow: FlowDefinition = {
  key: 'plain',
  version: 1,
  title: { en: 'Plain', ss: 'Plain' },
  completion: { mode: 'submit_in_chat' },
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
};

describe('backward-compat: plain flow unaffected by v0.4.0', () => {
  it('full traversal renders + advances + completes exactly as before', () => {
    let turn = startFlow(plainFlow, 'en');
    expect(turn.sessionState.step_index).toBe(0);
    expect(turn.replies[0]).toContain('What is your name?');

    turn = runFlowTurn(plainFlow, turn.sessionState, 'Sipho');
    expect(turn.sessionState.step_index).toBe(1);
    expect(turn.replies[0]).toContain('Your role?');
    expect(turn.replies[0]).toContain('1️⃣ Owner');
    expect(turn.replies[0]).toContain('2️⃣ Agent');

    turn = runFlowTurn(plainFlow, turn.sessionState, '1');
    expect(turn.sessionState.step_index).toBe(2);
    expect(turn.replies[0]).toContain('Name: Sipho');
    expect(turn.replies[0]).toContain('Role: Owner');

    const done = runFlowTurn(plainFlow, turn.sessionState, 'yes');
    expect(done.status).toBe('complete');
    expect(done.answers).toEqual({ name: 'Sipho', role: 'owner' });
  });
});

// ---------------------------------------------------------------------------
// A. Branch actions
// ---------------------------------------------------------------------------

const branchFlow: FlowDefinition = {
  key: 'branchdemo',
  version: 1,
  title: { en: 'Branch demo', ss: 'Branch demo' },
  completion: { mode: 'submit_in_chat' },
  steps: [
    {
      key: 'plate',
      prompt: { en: 'Plate?', ss: 'Plate?' },
      summary_label: { en: 'Plate', ss: 'Plate' },
      field: { type: 'text', min: 1 },
    },
    {
      key: 'centre',
      prompt: { en: 'Centre?', ss: 'Centre?' },
      summary_label: { en: 'Centre', ss: 'Centre' },
      field: { type: 'dynamic_choice', source: 'centres' },
    },
    {
      key: 'done_choice',
      prompt: { en: 'What next?', ss: 'Kutsi ini?' },
      summary_label: { en: 'Next', ss: 'Next' },
      field: {
        type: 'choice',
        options: [
          { value: '1', label: { en: 'Finish now', ss: 'Cedza nyalo' } },
          { value: '2', label: { en: 'Change centre', ss: 'Shintja centre' } },
          { value: '3', label: { en: 'Keep going', ss: 'Chubeka' } },
        ],
      },
      branches: {
        '1': { action: 'complete' },
        '2': { action: 'goto', goto: 'centre', clear_from: 'centre' },
        // '3' has no entry -> normal advance
      },
    },
    { key: 'confirm', prompt: { en: 'OK?', ss: 'OK?' }, field: { type: 'confirm' } },
  ],
};

const branchCtx: FlowContext = {
  options: {
    centre: [
      { value: 'c1', label: { en: 'Manzini Centre', ss: 'Manzini Centre' } },
      { value: 'c2', label: { en: 'Mbabane Centre', ss: 'Mbabane Centre' } },
    ],
  },
};

function toDoneChoice() {
  let turn = startFlow(branchFlow, 'en', branchCtx);
  turn = runFlowTurn(branchFlow, turn.sessionState, 'ABC123', branchCtx); // plate
  turn = runFlowTurn(branchFlow, turn.sessionState, '1', branchCtx); // centre = c1
  return turn; // now at done_choice (index 2)
}

describe('branch actions', () => {
  it('a terminal choice step with a complete branch: answering that value completes the flow', () => {
    const atChoice = toDoneChoice();
    expect(atChoice.sessionState.step_index).toBe(2);

    const done = runFlowTurn(branchFlow, atChoice.sessionState, '1', branchCtx);
    expect(done.status).toBe('complete');
    expect(done.answers).toEqual({ plate: 'ABC123', centre: 'c1', done_choice: '1' });
  });

  it('a goto branch jumps to the target step without completing', () => {
    const atChoice = toDoneChoice();
    const jumped = runFlowTurn(branchFlow, atChoice.sessionState, '2', branchCtx);
    expect(jumped.status).toBe('in_progress');
    expect(jumped.sessionState.step_index).toBe(1); // centre
  });

  it('goto + clear_from clears answers at/after the target step and does not store this answer', () => {
    const atChoice = toDoneChoice();
    expect(atChoice.sessionState.answers).toEqual({ plate: 'ABC123', centre: 'c1' });

    const jumped = runFlowTurn(branchFlow, atChoice.sessionState, '2', branchCtx);
    expect(jumped.sessionState.step_index).toBe(1); // plate index of 'centre' target
    expect(jumped.sessionState.answers).toEqual({ plate: 'ABC123' });
    expect(jumped.sessionState.answers.centre).toBeUndefined();
    expect(jumped.sessionState.answers.done_choice).toBeUndefined();
  });

  it('an option with no branch entry falls through to normal advance', () => {
    const atChoice = toDoneChoice();
    const advanced = runFlowTurn(branchFlow, atChoice.sessionState, '3', branchCtx);
    expect(advanced.status).toBe('in_progress');
    expect(advanced.sessionState.step_index).toBe(3); // confirm
    expect(advanced.sessionState.answers.done_choice).toBe('3');
  });

  it('a confirm step WITHOUT branches keeps its existing yes/no behavior exactly', () => {
    const atChoice = toDoneChoice();
    const advanced = runFlowTurn(branchFlow, atChoice.sessionState, '3', branchCtx); // -> confirm
    const yes = runFlowTurn(branchFlow, advanced.sessionState, 'yes', branchCtx);
    expect(yes.status).toBe('complete');

    const no = runFlowTurn(branchFlow, advanced.sessionState, 'no', branchCtx);
    expect(no.status).toBe('cancelled');
  });

  it('a confirm step WITH branches uses branch actions instead of default yes/no', () => {
    const branchedConfirmFlow: FlowDefinition = {
      key: 'confirmbranch',
      version: 1,
      title: { en: 'CB', ss: 'CB' },
      completion: { mode: 'submit_in_chat' },
      steps: [
        {
          key: 'name',
          prompt: { en: 'Name?', ss: 'Ligama?' },
          summary_label: { en: 'Name', ss: 'Ligama' },
          field: { type: 'text' },
        },
        {
          key: 'confirm',
          prompt: { en: 'Restart or finish?', ss: 'Cala kabusha nome cedza?' },
          field: { type: 'confirm' },
          branches: {
            no: { action: 'goto', goto: 'name', clear_from: 'name' },
          },
        },
      ],
    };
    let turn = startFlow(branchedConfirmFlow, 'en');
    turn = runFlowTurn(branchedConfirmFlow, turn.sessionState, 'Sipho');
    expect(turn.sessionState.step_index).toBe(1);

    const restarted = runFlowTurn(branchedConfirmFlow, turn.sessionState, 'no');
    expect(restarted.status).toBe('in_progress');
    expect(restarted.sessionState.step_index).toBe(0);
    expect(restarted.sessionState.answers.name).toBeUndefined();

    const finished = runFlowTurn(branchedConfirmFlow, turn.sessionState, 'yes');
    expect(finished.status).toBe('complete');
    expect(finished.answers).toEqual({ name: 'Sipho' });
  });
});

// ---------------------------------------------------------------------------
// B. Prompt {token} interpolation
// ---------------------------------------------------------------------------

describe('prompt interpolation', () => {
  const interpFlow: FlowDefinition = {
    key: 'interp',
    version: 1,
    title: { en: 'Interp', ss: 'Interp' },
    completion: { mode: 'submit_in_chat' },
    steps: [
      {
        key: 'plate',
        prompt: { en: 'Plate?', ss: 'Plate?' },
        summary_label: { en: 'Plate', ss: 'Plate' },
        field: { type: 'text', min: 1 },
      },
      {
        key: 'greet',
        prompt: { en: 'Hi {botName}, plate {plate}', ss: 'Sawubona {botName}, plate {plate}' },
        field: { type: 'text' },
      },
      { key: 'confirm', prompt: { en: 'OK?', ss: 'OK?' }, field: { type: 'confirm' } },
    ],
  };

  it('interpolates ctx.vars and state.answers into the rendered body, answers winning', () => {
    const ctx: FlowContext = { vars: { botName: 'MOPWT' } };
    let turn = startFlow(interpFlow, 'en', ctx);
    turn = runFlowTurn(interpFlow, turn.sessionState, 'SD123', ctx);
    expect(turn.replies[0]).toBe('Hi MOPWT, plate SD123');
  });

  it('a missing token is replaced with an empty string', () => {
    let turn = startFlow(interpFlow, 'en', {});
    turn = runFlowTurn(interpFlow, turn.sessionState, 'SD123', {});
    expect(turn.replies[0]).toBe('Hi , plate SD123');
  });

  it('answers override ctx.vars for the same token name', () => {
    const ctx: FlowContext = { vars: { botName: 'DefaultBot', plate: 'ZZZ' } };
    let turn = startFlow(interpFlow, 'en', ctx);
    turn = runFlowTurn(interpFlow, turn.sessionState, 'SD123', ctx);
    expect(turn.replies[0]).toBe('Hi DefaultBot, plate SD123');
  });

  it('a flow with no {token} syntax is unaffected', () => {
    const state = startFlow(plainFlow, 'en', { vars: { anything: 'x' } }).sessionState;
    expect(renderStep(plainFlow, state, { vars: { anything: 'x' } })).toBe(
      renderStep(plainFlow, state),
    );
  });
});

// ---------------------------------------------------------------------------
// Schema: last-step relaxation
// ---------------------------------------------------------------------------

describe('FlowDefinitionSchema — last step relaxation for complete branches', () => {
  it('accepts a flow whose last step is a choice with a complete branch', () => {
    const parsed = FlowDefinitionSchema.safeParse({
      key: 'demo',
      version: 1,
      title: { en: 'Demo', ss: 'Demo' },
      steps: [
        { key: 'name', prompt: { en: 'Name?', ss: 'Ligama?' }, field: { type: 'text' } },
        {
          key: 'finish',
          prompt: { en: 'Finish?', ss: 'Cedza?' },
          field: {
            type: 'choice',
            options: [
              { value: 'a', label: { en: 'A', ss: 'A' } },
              { value: 'b', label: { en: 'B', ss: 'B' } },
            ],
          },
          branches: { a: { action: 'complete' } },
        },
      ],
      completion: { mode: 'submit_in_chat' },
    });
    expect(parsed.success).toBe(true);
  });

  it('still rejects a last step that is a bare non-confirm step with no complete branch', () => {
    const parsed = FlowDefinitionSchema.safeParse({
      key: 'demo',
      version: 1,
      title: { en: 'Demo', ss: 'Demo' },
      steps: [
        { key: 'name', prompt: { en: 'Name?', ss: 'Ligama?' }, field: { type: 'text' } },
        {
          key: 'finish',
          prompt: { en: 'Finish?', ss: 'Cedza?' },
          field: {
            type: 'choice',
            options: [
              { value: 'a', label: { en: 'A', ss: 'A' } },
              { value: 'b', label: { en: 'B', ss: 'B' } },
            ],
          },
        },
      ],
      completion: { mode: 'submit_in_chat' },
    });
    expect(parsed.success).toBe(false);
  });

  it('still rejects a last step that is a choice with branches but none marked complete', () => {
    const parsed = FlowDefinitionSchema.safeParse({
      key: 'demo',
      version: 1,
      title: { en: 'Demo', ss: 'Demo' },
      steps: [
        { key: 'name', prompt: { en: 'Name?', ss: 'Ligama?' }, field: { type: 'text' } },
        {
          key: 'finish',
          prompt: { en: 'Finish?', ss: 'Cedza?' },
          field: {
            type: 'choice',
            options: [
              { value: 'a', label: { en: 'A', ss: 'A' } },
              { value: 'b', label: { en: 'B', ss: 'B' } },
            ],
          },
          branches: { a: { action: 'goto', goto: 'name' } },
        },
      ],
      completion: { mode: 'submit_in_chat' },
    });
    expect(parsed.success).toBe(false);
  });
});
