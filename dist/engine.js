import { validateField } from './validators.js';
function t(text, locale) {
    return text[locale];
}
const SKIP_WORDS = ['skip', '-', 'none', 'yeka'];
const BACK_WORDS = ['back', 'emuva'];
function skipHint(locale) {
    return locale === 'ss'
        ? '(Loba "yeka" kute uyekele.)' // TODO: siSwati review
        : '(Reply "skip" to leave this blank.)';
}
function isSkip(input) {
    return SKIP_WORDS.includes(input.trim().toLowerCase());
}
function optionsFor(step, ctx) {
    return ctx.options?.[step.key] ?? [];
}
export function renderStep(flow, state, ctx = {}) {
    const step = flow.steps[state.step_index];
    const locale = state.locale;
    if (step.field.type === 'confirm') {
        const lines = flow.steps
            .filter((s) => s.field.type !== 'confirm')
            .map((s) => {
            const label = s.summary_label ? t(s.summary_label, locale) : s.key;
            const ans = state.answers[s.key];
            let display;
            if (s.field.type === 'choice' && ans !== undefined) {
                const opt = s.field.options.find((o) => o.value === ans);
                display = opt ? t(opt.label, locale) : String(ans);
            }
            else if (s.field.type === 'dynamic_choice' && ans !== undefined) {
                display = state.answer_labels?.[s.key] ?? String(ans);
            }
            else if (s.field.type === 'money' && typeof ans === 'number') {
                display = (ans / 100).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                });
            }
            else {
                display = ans !== undefined ? String(ans) : '-';
            }
            return `• ${label}: ${display}`;
        });
        return [t(step.prompt, locale), '', ...lines].join('\n');
    }
    let body = t(step.prompt, locale);
    if (step.help)
        body += `\n${t(step.help, locale)}`;
    if (step.field.type === 'choice') {
        const opts = step.field.options.map((o, i) => `${i + 1}. ${t(o.label, locale)}`);
        body += `\n${opts.join('\n')}`;
    }
    else if (step.field.type === 'dynamic_choice') {
        const opts = optionsFor(step, ctx).map((o, i) => `${i + 1}. ${t(o.label, locale)}`);
        if (opts.length > 0)
            body += `\n${opts.join('\n')}`;
    }
    if (step.optional)
        body += `\n${skipHint(locale)}`;
    return body;
}
export function startFlow(flow, locale, ctx = {}) {
    const state = {
        flow_key: flow.key,
        flow_version: flow.version,
        step_index: 0,
        answers: {},
        answer_labels: {},
        locale,
    };
    return { sessionState: state, replies: [renderStep(flow, state, ctx)], status: 'in_progress' };
}
export function runFlowTurn(flow, state, input, ctx = {}) {
    const locale = state.locale;
    const trimmed = input.trim();
    // Stale resumed session — reset to a fresh flow.
    if (state.flow_version !== flow.version) {
        const fresh = startFlow(flow, locale, ctx);
        const notice = locale === 'ss'
            ? 'Leli fomu livuselelisiwe. Asicaleni kabusha.'
            : 'This form was updated. Let us start over.';
        return { ...fresh, replies: [notice, ...fresh.replies] };
    }
    const step = flow.steps[state.step_index];
    // "back" — step back one (ignored at step 0, where it falls through as input).
    if (BACK_WORDS.includes(trimmed.toLowerCase()) && state.step_index > 0) {
        const prev = { ...state, step_index: state.step_index - 1 };
        return { sessionState: prev, replies: [renderStep(flow, prev, ctx)], status: 'in_progress' };
    }
    // Confirm step — "yes" completes, "no" cancels.
    if (step.field.type === 'confirm') {
        const confirmResult = validateField(step.field, trimmed);
        if (!confirmResult.ok) {
            return {
                sessionState: state,
                replies: [confirmResult.error[locale], renderStep(flow, state, ctx)],
                status: 'in_progress',
            };
        }
        if (confirmResult.value === 'yes') {
            return { sessionState: state, replies: [], status: 'complete', answers: { ...state.answers } };
        }
        return { sessionState: state, replies: [], status: 'cancelled' };
    }
    // Optional step — a skip token advances without storing an answer.
    if (step.optional && isSkip(trimmed)) {
        const nextState = { ...state, step_index: state.step_index + 1 };
        return { sessionState: nextState, replies: [renderStep(flow, nextState, ctx)], status: 'in_progress' };
    }
    // Dynamic choice — validate against injected options and record the label.
    if (step.field.type === 'dynamic_choice') {
        const opts = optionsFor(step, ctx);
        const result = validateField(step.field, trimmed, opts);
        if (!result.ok) {
            return {
                sessionState: state,
                replies: [result.error[locale], renderStep(flow, state, ctx)],
                status: 'in_progress',
            };
        }
        const chosen = opts.find((o) => o.value === result.value);
        const nextState = {
            ...state,
            step_index: state.step_index + 1,
            answers: { ...state.answers, [step.key]: result.value },
            answer_labels: {
                ...(state.answer_labels ?? {}),
                [step.key]: chosen ? chosen.label[locale] : String(result.value),
            },
        };
        return { sessionState: nextState, replies: [renderStep(flow, nextState, ctx)], status: 'in_progress' };
    }
    // Data step — validate, store, advance.
    const result = validateField(step.field, trimmed);
    if (!result.ok) {
        return {
            sessionState: state,
            replies: [result.error[locale], renderStep(flow, state, ctx)],
            status: 'in_progress',
        };
    }
    const nextState = {
        ...state,
        step_index: state.step_index + 1,
        answers: { ...state.answers, [step.key]: result.value },
    };
    return { sessionState: nextState, replies: [renderStep(flow, nextState, ctx)], status: 'in_progress' };
}
