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
function numberHint(locale, count) {
    return locale === 'ss'
        ? `Phendvula ngenombolo kusukela ku-1 kuya ku-${count}.`
        : `Reply with a number from 1 to ${count}.`;
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
function interpolate(body, ctx, answers) {
    if (!body.includes('{'))
        return body;
    const lookup = { ...ctx.vars, ...answers };
    return body.replace(/\{([^{}]+)\}/g, (_match, token) => {
        const value = lookup[token];
        return value === undefined ? '' : String(value);
    });
}
function stepIndexByKey(flow, key) {
    const idx = flow.steps.findIndex((s) => s.key === key);
    return idx;
}
function clearAnswersFrom(flow, answers, clearFromKey) {
    const clearIndex = stepIndexByKey(flow, clearFromKey);
    if (clearIndex < 0)
        return answers;
    const result = { ...answers };
    flow.steps.forEach((s, i) => {
        if (i >= clearIndex)
            delete result[s.key];
    });
    return result;
}
/**
 * Resolve the branch action (if any) declared for the chosen value on a
 * choice/dynamic_choice/confirm step, and build the resulting turn.
 * Returns null when there is no branch entry for this value — callers should
 * fall through to their existing store-and-advance behavior in that case.
 */
function applyBranch(flow, state, step, value, answersBeforeThisStep, ctx) {
    const branch = step.branches?.[String(value)];
    if (!branch)
        return null;
    if (branch.action === 'complete') {
        const answers = { ...answersBeforeThisStep, [step.key]: value };
        return { sessionState: state, replies: [], status: 'complete', answers };
    }
    if (branch.action === 'goto') {
        const clearedAnswers = branch.clear_from
            ? clearAnswersFrom(flow, answersBeforeThisStep, branch.clear_from)
            : answersBeforeThisStep;
        const targetIndex = branch.goto ? stepIndexByKey(flow, branch.goto) : state.step_index;
        const resolvedIndex = targetIndex >= 0 ? targetIndex : state.step_index;
        const nextState = {
            ...state,
            step_index: firstVisibleFrom(flow, resolvedIndex, clearedAnswers),
            answers: clearedAnswers,
        };
        return { sessionState: nextState, replies: [renderStep(flow, nextState, ctx)], status: 'in_progress' };
    }
    // action === 'advance' -> no special handling, fall through to normal behavior.
    return null;
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
        const summaryBody = [t(step.prompt, locale), '', ...lines].join('\n');
        return interpolate(summaryBody, ctx, state.answers);
    }
    let body = t(step.prompt, locale);
    if (step.help)
        body += `\n${t(step.help, locale)}`;
    if (step.field.type === 'choice') {
        const opts = step.field.options.map((o, i) => `${i + 1}. ${t(o.label, locale)}`);
        body += `\n${opts.join('\n')}\n${numberHint(locale, opts.length)}`;
    }
    else if (step.field.type === 'dynamic_choice') {
        const opts = optionsFor(step, ctx).map((o, i) => `${i + 1}. ${t(o.label, locale)}`);
        if (opts.length > 0)
            body += `\n${opts.join('\n')}\n${numberHint(locale, opts.length)}`;
    }
    if (step.optional)
        body += `\n${skipHint(locale)}`;
    return interpolate(body, ctx, state.answers);
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
    // Confirm step — a declared branch takes over; otherwise "yes" completes, "no" cancels.
    if (step.field.type === 'confirm') {
        const confirmResult = validateField(step.field, trimmed);
        if (!confirmResult.ok) {
            return {
                sessionState: state,
                replies: [confirmResult.error[locale], renderStep(flow, state, ctx)],
                status: 'in_progress',
            };
        }
        if (step.branches) {
            const branched = applyBranch(flow, state, step, confirmResult.value, state.answers, ctx);
            if (branched)
                return branched;
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
        if (step.branches) {
            const branched = applyBranch(flow, state, step, result.value, state.answers, ctx);
            if (branched)
                return branched;
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
    if (step.field.type === 'choice' && step.branches) {
        const branched = applyBranch(flow, state, step, result.value, state.answers, ctx);
        if (branched)
            return branched;
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
