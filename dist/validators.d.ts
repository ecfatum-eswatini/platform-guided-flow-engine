import type { FieldSpec, LocalizedText, AnswerValue, ChoiceOption } from './types.js';
export type ValidationResult = {
    ok: true;
    value: AnswerValue;
} | {
    ok: false;
    error: LocalizedText;
};
export declare function validateField(spec: FieldSpec, raw: string, ctxOptions?: ChoiceOption[]): ValidationResult;
