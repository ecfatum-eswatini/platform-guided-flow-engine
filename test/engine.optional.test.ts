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
