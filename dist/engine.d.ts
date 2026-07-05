import type { FlowContext, FlowDefinition, FlowSessionState, FlowTurnResult, Locale } from './types.js';
export declare function renderStep(flow: FlowDefinition, state: FlowSessionState, ctx?: FlowContext): string;
export declare function startFlow(flow: FlowDefinition, locale: Locale, ctx?: FlowContext): FlowTurnResult;
export declare function runFlowTurn(flow: FlowDefinition, state: FlowSessionState, input: string, ctx?: FlowContext): FlowTurnResult;
