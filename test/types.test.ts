import { describe, it, expect } from 'vitest';
import { FlowDefinitionSchema, FieldSpecSchema } from '../src/types.js';

const confirmStep = {
  key: 'confirm',
  prompt: { en: 'Confirm?', ss: 'Uyaqinisekisa?' },
  field: { type: 'confirm' },
};

describe('FieldSpecSchema', () => {
  it('accepts a choice field with options', () => {
    const parsed = FieldSpecSchema.safeParse({
      type: 'choice',
      options: [
        { value: 'a', label: { en: 'A', ss: 'A' } },
        { value: 'b', label: { en: 'B', ss: 'B' } },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a choice field with fewer than 2 options', () => {
    const parsed = FieldSpecSchema.safeParse({
      type: 'choice',
      options: [{ value: 'a', label: { en: 'A', ss: 'A' } }],
    });
    expect(parsed.success).toBe(false);
  });
});

describe('FlowDefinitionSchema', () => {
  it('accepts a flow whose last step is a confirm step', () => {
    const parsed = FlowDefinitionSchema.safeParse({
      key: 'demo',
      version: 1,
      title: { en: 'Demo', ss: 'Demo' },
      steps: [
        { key: 'name', prompt: { en: 'Name?', ss: 'Ligama?' }, field: { type: 'text' } },
        confirmStep,
      ],
      completion: { mode: 'submit_in_chat' },
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a flow whose last step is not a confirm step', () => {
    const parsed = FlowDefinitionSchema.safeParse({
      key: 'demo',
      version: 1,
      title: { en: 'Demo', ss: 'Demo' },
      steps: [{ key: 'name', prompt: { en: 'Name?', ss: 'Ligama?' }, field: { type: 'text' } }],
      completion: { mode: 'submit_in_chat' },
    });
    expect(parsed.success).toBe(false);
  });
});
