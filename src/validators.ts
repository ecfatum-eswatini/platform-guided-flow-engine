import type { FieldSpec, LocalizedText, AnswerValue } from './types.js';

export type ValidationResult =
  | { ok: true; value: AnswerValue }
  | { ok: false; error: LocalizedText };

function err(en: string, ss: string): ValidationResult {
  return { ok: false, error: { en, ss } };
}

export function validateField(spec: FieldSpec, raw: string): ValidationResult {
  const input = raw.trim();
  switch (spec.type) {
    case 'text': {
      if (input.length === 0) return err('Please enter a value.', 'Sicela ufake umniningwane.');
      if (spec.min !== undefined && input.length < spec.min)
        return err(
          `Please enter at least ${spec.min} characters.`,
          `Sicela ufake okungenani tinhlamvu letingu-${spec.min}.`,
        );
      if (spec.max !== undefined && input.length > spec.max)
        return err(
          `Please keep it under ${spec.max} characters.`,
          `Sicela wehlise ngephansi kwetinhlamvu letingu-${spec.max}.`,
        );
      return { ok: true, value: input };
    }
    case 'number': {
      const n = Number(input);
      if (input.length === 0 || !Number.isFinite(n))
        return err('Please enter a number.', 'Sicela ufake inombolo.');
      if (spec.integer && !Number.isInteger(n))
        return err('Please enter a whole number.', 'Sicela ufake inombolo lephelele.');
      if (spec.min !== undefined && n < spec.min)
        return err(`Please enter ${spec.min} or more.`, `Sicela ufake ${spec.min} nangetulu.`);
      if (spec.max !== undefined && n > spec.max)
        return err(`Please enter ${spec.max} or less.`, `Sicela ufake ${spec.max} nangaphansi.`);
      return { ok: true, value: n };
    }
    case 'money': {
      const cleaned = input.replace(/[,\s]/g, '');
      if (!/^\d+(\.\d{1,2})?$/.test(cleaned))
        return err('Please enter an amount, e.g. 25000.', 'Sicela ufake inani, sib. 25000.');
      return { ok: true, value: Math.round(parseFloat(cleaned) * 100) };
    }
    case 'choice': {
      const idx = Number(input);
      if (Number.isInteger(idx) && idx >= 1 && idx <= spec.options.length)
        return { ok: true, value: spec.options[idx - 1].value };
      const byValue = spec.options.find((o) => o.value.toLowerCase() === input.toLowerCase());
      if (byValue) return { ok: true, value: byValue.value };
      return err(
        `Please reply with a number from 1 to ${spec.options.length}.`,
        `Sicela uphendvule ngenombolo kusukela ku-1 kuya ku-${spec.options.length}.`,
      );
    }
    case 'msisdn': {
      const digits = input.replace(/\D/g, '');
      let normalized: string;
      if (digits.length === 8) normalized = `268${digits}`;
      else if (digits.length === 11 && digits.startsWith('268')) normalized = digits;
      else return err('Please enter a valid phone number.', 'Sicela ufake inombolo yelucingo lefanele.');
      return { ok: true, value: `+${normalized}` };
    }
    case 'email': {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input))
        return err('Please enter a valid email address.', 'Sicela ufake ikheli le-imeyili lelifanele.');
      return { ok: true, value: input };
    }
    case 'confirm': {
      const v = input.toLowerCase();
      if (['yes', 'y', '1', 'yebo'].includes(v)) return { ok: true, value: 'yes' };
      if (['no', 'n', '2', 'cha'].includes(v)) return { ok: true, value: 'no' };
      return err("Please reply 'yes' or 'no'.", "Sicela uphendvule ngekutsi 'yebo' kumbe 'cha'.");
    }
  }
}
