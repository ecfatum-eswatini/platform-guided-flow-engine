import { describe, it, expect } from 'vitest';
import { validateField } from '../src/validators.js';
import type { FieldSpec } from '../src/types.js';

describe('validateField', () => {
  it('text: trims and accepts non-empty input', () => {
    const r = validateField({ type: 'text' }, '  Sipho Dlamini  ');
    expect(r).toEqual({ ok: true, value: 'Sipho Dlamini' });
  });

  it('text: rejects empty input', () => {
    const r = validateField({ type: 'text' }, '   ');
    expect(r.ok).toBe(false);
  });

  it('number: parses an integer when integer is required', () => {
    const r = validateField({ type: 'number', integer: true }, '3');
    expect(r).toEqual({ ok: true, value: 3 });
  });

  it('number: rejects a non-integer when integer is required', () => {
    const r = validateField({ type: 'number', integer: true }, '3.5');
    expect(r.ok).toBe(false);
  });

  it('number: enforces min', () => {
    const r = validateField({ type: 'number', min: 1 }, '0');
    expect(r.ok).toBe(false);
  });

  it('money: converts a decimal amount to integer minor units', () => {
    const r = validateField({ type: 'money' }, '25 000.50');
    expect(r).toEqual({ ok: true, value: 2500050 });
  });

  it('money: rejects non-numeric input', () => {
    const r = validateField({ type: 'money' }, 'a lot');
    expect(r.ok).toBe(false);
  });

  it('choice: selects an option by 1-based index', () => {
    const spec: FieldSpec = {
      type: 'choice',
      options: [
        { value: 'owner', label: { en: 'Owner', ss: 'Umnikati' } },
        { value: 'agent', label: { en: 'Agent', ss: 'Ummeli' } },
      ],
    };
    expect(validateField(spec, '2')).toEqual({ ok: true, value: 'agent' });
  });

  it('choice: rejects an out-of-range index', () => {
    const spec: FieldSpec = {
      type: 'choice',
      options: [
        { value: 'a', label: { en: 'A', ss: 'A' } },
        { value: 'b', label: { en: 'B', ss: 'B' } },
      ],
    };
    expect(validateField(spec, '5').ok).toBe(false);
  });

  it('msisdn: normalises an 8-digit Eswatini number to +268 E.164', () => {
    expect(validateField({ type: 'msisdn' }, '7612 3456')).toEqual({
      ok: true,
      value: '+26876123456',
    });
  });

  it('msisdn: rejects a too-short number', () => {
    expect(validateField({ type: 'msisdn' }, '1234').ok).toBe(false);
  });

  it('email: accepts a valid address and rejects an invalid one', () => {
    expect(validateField({ type: 'email' }, 'a@b.co').ok).toBe(true);
    expect(validateField({ type: 'email' }, 'not-an-email').ok).toBe(false);
  });

  it('confirm: maps yes/no words (en + ss) to a value', () => {
    expect(validateField({ type: 'confirm' }, 'Yebo')).toEqual({ ok: true, value: 'yes' });
    expect(validateField({ type: 'confirm' }, 'no')).toEqual({ ok: true, value: 'no' });
    expect(validateField({ type: 'confirm' }, 'maybe').ok).toBe(false);
  });

  it('returns a bilingual error object on failure', () => {
    const r = validateField({ type: 'text' }, '');
    if (r.ok) throw new Error('expected failure');
    expect(typeof r.error.en).toBe('string');
    expect(typeof r.error.ss).toBe('string');
  });

  it('text: enforces min length', () => {
    expect(validateField({ type: 'text', min: 3 }, 'ab').ok).toBe(false);
  });

  it('text: enforces max length', () => {
    expect(validateField({ type: 'text', max: 3 }, 'abcd').ok).toBe(false);
  });

  it('number: enforces max', () => {
    expect(validateField({ type: 'number', max: 10 }, '11').ok).toBe(false);
  });
});
