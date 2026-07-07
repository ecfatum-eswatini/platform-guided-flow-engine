import { describe, it, expect } from 'vitest';
import type { FlowDefinition, FlowContext, ChoiceOption } from '../src/index.js';
import { startFlow, renderStep } from '../src/index.js';

const choiceFlow: FlowDefinition = {
  key: 'emoji_choice',
  version: 1,
  title: { en: 'Emoji', ss: 'Emoji' },
  completion: { mode: 'submit_in_chat' },
  steps: [
    {
      key: 'category',
      prompt: { en: 'Choose:', ss: 'Choose:' },
      field: {
        type: 'choice',
        options: [
          { value: 'A', label: { en: 'Alpha', ss: 'Alpha' } },
          { value: 'B', label: { en: 'Beta', ss: 'Beta' } },
        ],
      },
    },
    { key: 'confirm', prompt: { en: 'OK?', ss: 'OK?' }, field: { type: 'confirm' } },
  ],
};

describe('keycap-emoji option numbering', () => {
  it('renders choice options with keycap emojis, not plain "1."', () => {
    const rendered = startFlow(choiceFlow, 'en').replies[0];
    expect(rendered).toContain('1️⃣ Alpha');
    expect(rendered).toContain('2️⃣ Beta');
    expect(rendered).not.toContain('1. Alpha');
    // The numeric-range hint is still appended.
    expect(rendered).toContain('Reply with a number from 1 to 2.');
  });

  it('uses 🔟 for the 10th option and plain "11." beyond (no keycap exists)', () => {
    const dynFlow: FlowDefinition = {
      key: 'emoji_dyn',
      version: 1,
      title: { en: 'D', ss: 'D' },
      completion: { mode: 'submit_in_chat' },
      steps: [
        {
          key: 'slot',
          prompt: { en: 'Pick a slot:', ss: 'Pick a slot:' },
          field: { type: 'dynamic_choice', source: 'slots' },
        },
        { key: 'confirm', prompt: { en: 'OK?', ss: 'OK?' }, field: { type: 'confirm' } },
      ],
    };
    const options: ChoiceOption[] = Array.from({ length: 11 }, (_, i) => ({
      value: `s${i + 1}`,
      label: { en: `Slot ${i + 1}`, ss: `Slot ${i + 1}` },
    }));
    const ctx: FlowContext = { options: { slot: options } };
    const rendered = renderStep(dynFlow, startFlow(dynFlow, 'en', ctx).sessionState, ctx);
    expect(rendered).toContain('9️⃣ Slot 9');
    expect(rendered).toContain('🔟 Slot 10');
    expect(rendered).toContain('11. Slot 11');
  });
});
