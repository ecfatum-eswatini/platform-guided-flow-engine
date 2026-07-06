import { z } from 'zod';
export const LocalizedTextSchema = z.object({ en: z.string(), ss: z.string() });
export const LocaleSchema = z.enum(['en', 'ss']);
export const ChoiceOptionSchema = z.object({ value: z.string(), label: LocalizedTextSchema });
export const FieldSpecSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('text'), min: z.number().int().optional(), max: z.number().int().optional() }),
    z.object({
        type: z.literal('number'),
        min: z.number().optional(),
        max: z.number().optional(),
        integer: z.boolean().optional(),
    }),
    z.object({ type: z.literal('money') }),
    z.object({ type: z.literal('choice'), options: z.array(ChoiceOptionSchema).min(2) }),
    z.object({ type: z.literal('dynamic_choice'), source: z.string().min(1) }),
    z.object({ type: z.literal('msisdn') }),
    z.object({ type: z.literal('email') }),
    z.object({ type: z.literal('confirm') }),
]);
export const SkipCondSchema = z.object({
    key: z.string().min(1),
    equals: z.union([z.string(), z.number()]).optional(),
    in: z.array(z.union([z.string(), z.number()])).optional(),
});
export const StepBranchSchema = z.object({
    action: z.enum(['advance', 'complete', 'goto']),
    goto: z.string().optional(), // step key to jump to (required when action==='goto')
    clear_from: z.string().optional(), // step key; clear answers for all steps at index >= this step's index
});
export const FlowStepSchema = z.object({
    key: z.string().min(1),
    prompt: LocalizedTextSchema,
    help: LocalizedTextSchema.optional(),
    summary_label: LocalizedTextSchema.optional(),
    optional: z.boolean().optional(),
    skip_when: z.array(SkipCondSchema).optional(),
    prefill: z.string().min(1).optional(),
    branches: z.record(z.string(), StepBranchSchema).optional(),
    field: FieldSpecSchema,
});
export const FlowCompletionSchema = z.object({
    mode: z.enum(['submit_in_chat', 'draft_then_portal']),
    portal_deeplink_path: z.string().optional(),
});
function lastStepIsValidTerminal(f) {
    const last = f.steps[f.steps.length - 1];
    if (last.field.type === 'confirm')
        return true;
    if (last.field.type === 'choice' || last.field.type === 'dynamic_choice') {
        return Object.values(last.branches ?? {}).some((b) => b.action === 'complete');
    }
    return false;
}
export const FlowDefinitionSchema = z
    .object({
    key: z.string().min(1),
    version: z.number().int().positive(),
    title: LocalizedTextSchema,
    steps: z.array(FlowStepSchema).min(1),
    completion: FlowCompletionSchema,
})
    .refine(lastStepIsValidTerminal, {
    message: 'The last step of a flow must be a confirm step, or a choice/dynamic_choice step with at least one branch whose action is "complete"',
});
export const FlowSessionStateSchema = z.object({
    flow_key: z.string(),
    flow_version: z.number().int(),
    step_index: z.number().int().nonnegative(),
    answers: z.record(z.string(), z.union([z.string(), z.number()])),
    answer_labels: z.record(z.string(), z.string()).optional(),
    locale: LocaleSchema,
});
