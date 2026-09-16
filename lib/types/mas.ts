/**
 * Shared contract between the MAS API routes and the dashboard client components.
 * Mirrors the JSON returned by POST /api/price-optimizer.
 */

export interface AgentStep {
  interactionId: string;
  feedback: string;
}

export interface MasAgentChain {
  erp: AgentStep & { stockLevel: number };
  trade: AgentStep & { mapFloor: number };
  drlPricing: AgentStep;
}

export interface MasResult {
  success: true;
  skuId: string;
  recommendedPrice: number;
  currentBenchmark: number;
  mapPriceFloor: number;
  projectedMarginDelta: number;
  interactionId: string;
  logicSummary: string;
  agentChain: MasAgentChain;
}

export interface ExplainResult {
  success: true;
  interactionId: string;
  outputText: string;
}

/** Shape returned by every MAS route when something fails. */
export interface MasError {
  error: string;
}

export function isMasError(value: unknown): value is MasError {
  return typeof value === "object" && value !== null && "error" in value;
}
