import { z } from 'zod';

export const LocalizedTextSchema = z.object({ en: z.string(), ss: z.string() });
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

export const LocaleSchema = z.enum(['en', 'ss']);
export type Locale = z.infer<typeof LocaleSchema>;

export const ChoiceOptionSchema = z.object({ value: z.string(), label: LocalizedTextSchema });
export type ChoiceOption = z.infer<typeof ChoiceOptionSchema>;

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
  z.object({ type: z.literal('msisdn') }),
  z.object({ type: z.literal('email') }),
  z.object({ type: z.literal('confirm') }),
]);
export type FieldSpec = z.infer<typeof FieldSpecSchema>;

export const FlowStepSchema = z.object({
  key: z.string().min(1),
  prompt: LocalizedTextSchema,
  help: LocalizedTextSchema.optional(),
  summary_label: LocalizedTextSchema.optional(),
  field: FieldSpecSchema,
});
export type FlowStep = z.infer<typeof FlowStepSchema>;

export const FlowCompletionSchema = z.object({
  mode: z.enum(['submit_in_chat', 'draft_then_portal']),
  portal_deeplink_path: z.string().optional(),
});
export type FlowCompletion = z.infer<typeof FlowCompletionSchema>;

export const FlowDefinitionSchema = z
  .object({
    key: z.string().min(1),
    version: z.number().int().positive(),
    title: LocalizedTextSchema,
    steps: z.array(FlowStepSchema).min(1),
    completion: FlowCompletionSchema,
  })
  .refine((f) => f.steps[f.steps.length - 1].field.type === 'confirm', {
    message: 'The last step of a flow must be a confirm step',
  });
export type FlowDefinition = z.infer<typeof FlowDefinitionSchema>;

export type AnswerValue = string | number;

export const FlowSessionStateSchema = z.object({
  flow_key: z.string(),
  flow_version: z.number().int(),
  step_index: z.number().int().nonnegative(),
  answers: z.record(z.string(), z.union([z.string(), z.number()])),
  locale: LocaleSchema,
});
export type FlowSessionState = z.infer<typeof FlowSessionStateSchema>;

export type FlowStatus = 'in_progress' | 'complete' | 'cancelled';

export interface FlowTurnResult {
  sessionState: FlowSessionState;
  replies: string[];
  status: FlowStatus;
  answers?: Record<string, AnswerValue>;
}
