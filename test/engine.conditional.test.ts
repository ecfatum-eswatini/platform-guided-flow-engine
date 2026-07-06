import { describe, it, expect } from 'vitest';
import type { FlowDefinition, FlowContext } from '../src/index.js';
import { startFlow, runFlowTurn } from '../src/index.js';

const flow: FlowDefinition = {
  key: 'conddemo',
  version: 1,
  title: { en: 'Cond demo', ss: 'Cond demo' },
  completion: { mode: 'submit_in_chat' },
  steps: [
    {
      key: 'plate',
      prompt: { en: 'Plate?', ss: 'Plate?' },
      summary_label: { en: 'Plate', ss: 'Plate' },
      prefill: 'vehicle',
      field: { type: 'text', min: 1 },
    },
    {
      key: 'owner',
      prompt: { en: 'Owner?', ss: 'Owner?' },
      summary_label: { en: 'Owner', ss: 'Owner' },
      skip_when: [{ key: 'vehicle_known', equals: 'yes' }],
      field: { type: 'text', min: 1 },
    },
    {
      key: 'engine',
      prompt: { en: 'Engine number?', ss: 'Engine number?' },
      summary_label: { en: 'Engine', ss: 'Engine' },
      skip_when: [
        { key: 'vehicle_known', equals: 'yes' },
        { key: 'category', equals: 'TRAILER' },
      ],
      field: { type: 'text', min: 1 },
    },
    {
      key: 'category',
      prompt: { en: 'Category?', ss: 'Category?' },
      summary_label: { en: 'Category', ss: 'Category' },
      field: {
        type: 'choice',
        options: [
          { value: 'CAR', label: { en: 'Car', ss: 'Car' } },
          { value: 'TRAILER', label: { en: 'Trailer', ss: 'Trailer' } },
        ],
      },
    },
    { key: 'confirm', prompt: { en: 'OK?', ss: 'OK?' }, field: { type: 'confirm' } },
  ],
};

describe('conditional steps (skip_when + prefill)', () => {
  it('backward-compat: no prefill, no skips -> all steps run in order', () => {
    let turn = startFlow(flow, 'en');
    expect(turn.sessionState.step_index).toBe(0);

    turn = runFlowTurn(flow, turn.sessionState, 'ABC123'); // plate
    expect(turn.sessionState.step_index).toBe(1);

    turn = runFlowTurn(flow, turn.sessionState, 'Jane Doe'); // owner
    expect(turn.sessionState.step_index).toBe(2);

    turn = runFlowTurn(flow, turn.sessionState, 'ENG-999'); // engine
    expect(turn.sessionState.step_index).toBe(3);

    turn = runFlowTurn(flow, turn.sessionState, '1'); // category = CAR
    expect(turn.sessionState.step_index).toBe(4);
    expect(turn.sessionState.answers).toEqual({
      plate: 'ABC123',
      owner: 'Jane Doe',
      engine: 'ENG-999',
      category: 'CAR',
    });
  });

  it('prefill on the plate turn drives a skip past the owner step', () => {
    const turn0 = startFlow(flow, 'en');
    const ctx: FlowContext = { prefill: { vehicle_known: 'yes' } };
    const turn1 = runFlowTurn(flow, turn0.sessionState, 'ABC123', ctx);

    // owner (index 1) is skipped because vehicle_known === 'yes';
    // engine (index 2) is also skip_when vehicle_known === 'yes' -> also skipped;
    // lands on category (index 3).
    expect(turn1.sessionState.step_index).toBe(3);
    expect(turn1.sessionState.answers).toEqual({ plate: 'ABC123', vehicle_known: 'yes' });
  });

  it('skip_when equals and in both work', () => {
    // equals: vehicle_known === 'yes' skips owner
    const turn0 = startFlow(flow, 'en');
    const ctxEquals: FlowContext = { prefill: { vehicle_known: 'yes' } };
    const turn1 = runFlowTurn(flow, turn0.sessionState, 'ABC123', ctxEquals);
    expect(turn1.sessionState.step_index).toBe(3); // owner + engine both skipped

    // in: category === 'TRAILER' skips engine (via a second flow path, no vehicle_known)
    let turn = startFlow(flow, 'en');
    turn = runFlowTurn(flow, turn.sessionState, 'ABC123'); // plate, no prefill
    expect(turn.sessionState.step_index).toBe(1); // owner
    turn = runFlowTurn(flow, turn.sessionState, 'Jane Doe'); // owner
    expect(turn.sessionState.step_index).toBe(2); // engine

    // Simulate category already answered as TRAILER via prefill to test `in` semantics
    // directly against condMatches through skip_when on the engine step: answer category
    // step first by walking forward normally, but check that when category ends up
    // TRAILER (chosen further down), engine before it isn't retroactively re-evaluated.
    // Instead, verify `in` semantics using a dedicated inline flow.
    const inFlow: FlowDefinition = {
      key: 'indemo',
      version: 1,
      title: { en: 'In demo', ss: 'In demo' },
      completion: { mode: 'submit_in_chat' },
      steps: [
        {
          key: 'category',
          prompt: { en: 'Category?', ss: 'Category?' },
          field: {
            type: 'choice',
            options: [
              { value: 'CAR', label: { en: 'Car', ss: 'Car' } },
              { value: 'TRAILER', label: { en: 'Trailer', ss: 'Trailer' } },
              { value: 'MOTORCYCLE', label: { en: 'Motorcycle', ss: 'Motorcycle' } },
            ],
          },
        },
        {
          key: 'gross_weight',
          prompt: { en: 'Gross weight?', ss: 'Gross weight?' },
          skip_when: [{ key: 'category', in: ['TRAILER', 'MOTORCYCLE'] }],
          field: { type: 'number' },
        },
        { key: 'confirm', prompt: { en: 'OK?', ss: 'OK?' }, field: { type: 'confirm' } },
      ],
    };
    let inTurn = startFlow(inFlow, 'en');
    inTurn = runFlowTurn(inFlow, inTurn.sessionState, '3'); // category = MOTORCYCLE
    expect(inTurn.sessionState.answers.category).toBe('MOTORCYCLE');
    expect(inTurn.sessionState.step_index).toBe(2); // gross_weight skipped -> confirm
  });

  it('back from a step lands on the previous VISIBLE step, skipping a skipped one', () => {
    const turn0 = startFlow(flow, 'en');
    const ctx: FlowContext = { prefill: { vehicle_known: 'yes' } };
    const turn1 = runFlowTurn(flow, turn0.sessionState, 'ABC123', ctx);
    expect(turn1.sessionState.step_index).toBe(3); // category (owner + engine skipped)

    const back = runFlowTurn(flow, turn1.sessionState, 'back', ctx);
    // owner and engine are both skipped given vehicle_known === 'yes' in answers,
    // so back from category (3) should land on plate (0).
    expect(back.sessionState.step_index).toBe(0);
  });

  it('confirm summary omits skipped steps', () => {
    const turn0 = startFlow(flow, 'en');
    const ctx: FlowContext = { prefill: { vehicle_known: 'yes' } };
    let turn = runFlowTurn(flow, turn0.sessionState, 'ABC123', ctx); // -> category (index 3)
    turn = runFlowTurn(flow, turn.sessionState, '2', ctx); // category = TRAILER -> confirm

    expect(turn.sessionState.step_index).toBe(4);
    const summary = turn.replies[0];
    expect(summary).toContain('Plate');
    expect(summary).toContain('Category');
    expect(summary).not.toContain('Owner');
    expect(summary).not.toContain('Engine');
  });
});
