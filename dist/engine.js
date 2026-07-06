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
function condMatches(cond, answers) {
    const value = answers[cond.key];
    if (value === undefined)
        return false;
    if (cond.equals !== undefined && value === cond.equals)
        return true;
    if (cond.in !== undefined && cond.in.includes(value))
        return true;
    return false;
}
function stepIsSkipped(step, answers) {
    return step.skip_when?.some((cond) => condMatches(cond, answers)) ?? false;
}
function firstVisibleFrom(flow, index, answers) {
    let i = index;
    while (i < flow.steps.length - 1 && stepIsSkipped(flow.steps[i], answers)) {
        i += 1;
    }
    if (i >= flow.steps.length)
        return flow.steps.length - 1;
    return i;
}
function prevVisibleFrom(flow, index, answers) {
    let i = index;
    while (i > 0 && stepIsSkipped(flow.steps[i], answers)) {
        i -= 1;
    }
    return Math.max(i, 0);
}
export function renderStep(flow, state, ctx = {}) {
    const step = flow.steps[state.step_index];
    const locale = state.locale;
    if (step.field.type === 'confirm') {
        const lines = flow.steps
            .filter((s) => s.field.type !== 'confirm' && !stepIsSkipped(s, state.answers))
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
        step_index: firstVisibleFrom(flow, 0, {}),
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
    // "back" — step back one, skipping over skipped steps (ignored at step 0, where it falls
    // through as input).
    if (BACK_WORDS.includes(trimmed.toLowerCase()) && state.step_index > 0) {
        const prevIndex = prevVisibleFrom(flow, state.step_index - 1, state.answers);
        const prev = { ...state, step_index: prevIndex };
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
        const merged = step.prefill && ctx.prefill ? { ...state.answers, ...ctx.prefill } : state.answers;
        const nextState = {
            ...state,
            step_index: firstVisibleFrom(flow, state.step_index + 1, merged),
            answers: merged,
        };
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
        const nextAnswers = { ...state.answers, [step.key]: result.value };
        const merged = step.prefill && ctx.prefill ? { ...nextAnswers, ...ctx.prefill } : nextAnswers;
        const nextState = {
            ...state,
            step_index: firstVisibleFrom(flow, state.step_index + 1, merged),
            answers: merged,
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
    const nextAnswers = { ...state.answers, [step.key]: result.value };
    const merged = step.prefill && ctx.prefill ? { ...nextAnswers, ...ctx.prefill } : nextAnswers;
    const nextState = {
        ...state,
        step_index: firstVisibleFrom(flow, state.step_index + 1, merged),
        answers: merged,
    };
    return { sessionState: nextState, replies: [renderStep(flow, nextState, ctx)], status: 'in_progress' };
}
