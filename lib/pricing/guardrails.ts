/**
 * Policy-as-Code Safety Guardrail Engine
 * Deterministic mathematical bounds (±15%) + Semantic anti-price-gouging safety checks (gemini-3.7-flash)
 */
import { genaiClient, DASHBOARD_MODEL } from "@/lib/genai";
import { supabase } from "@/lib/agents/tools";

export const HARD_BOUNDS = {
  MIN: -0.15, // Maximum 15% discount floor
  MAX: 0.15,  // Maximum 15% price spike ceiling
};

export interface PricingProposal {
  skuId: string;
  basePrice: number;
  proposedPrice: number;
  context: string; // e.g., "Competitor dropped price", "Supply shortage crisis"
}

export interface VerificationResult {
  allowed: boolean;
  violations: string[];
  finalPrice: number;
  deltaPercent: number;
  status: "APPROVED" | "REJECTED";
}

/**
 * Intercepts pricing proposals, evaluating hard mathematical bounds and LLM semantic anti-gouging checks.
 */
export async function verifyPricingPolicy(proposal: PricingProposal): Promise<VerificationResult> {
  const { skuId, basePrice, proposedPrice, context } = proposal;

  if (basePrice <= 0) {
    throw new Error("Invalid base price: must be greater than zero");
  }

  const delta = (proposedPrice - basePrice) / basePrice;
  const deltaPercent = Number((delta * 100).toFixed(2));
  const violations: string[] = [];

  // 1. HARD MATHEMATICAL BOUNDS (±15%)
  if (delta > HARD_BOUNDS.MAX || delta < HARD_BOUNDS.MIN) {
    violations.push(
      `Price change of ${deltaPercent > 0 ? "+" : ""}${deltaPercent}% exceeds hard deterministic bounds of ±15%`
    );
  }

  // 2. SEMANTIC SAFETY GUARDRAIL (Anti-Gouging & Statutory Ethics)
  try {
    const safetyCheck = await genaiClient.interactions.create({
      model: DASHBOARD_MODEL,
      system_instruction: `
        You are an Enterprise Pricing Compliance Officer.
        Analyze the pricing proposal for "Price Gouging" violations.
        Price gouging occurs when a seller increases prices for essential goods 
        to a level much higher than is considered reasonable or fair during an emergency, natural disaster, or crisis.
        Return JSON: { "is_gouging": boolean, "reasoning": string }
      `,
      input: `
        Product SKU: ${skuId}
        Original Base Price: $${basePrice.toFixed(2)}
        Proposed Price: $${proposedPrice.toFixed(2)}
        Price Delta: ${deltaPercent}%
        Market Context: ${context}
      `,
      generation_config: { response_mime_type: "application/json" },
    });

    let safetyResult: { is_gouging: boolean; reasoning: string } = {
      is_gouging: false,
      reasoning: "Market rebalancing within normal parameters.",
    };

    try {
      if (safetyCheck.output_text) {
        safetyResult = JSON.parse(safetyCheck.output_text);
      }
    } catch {
      // If parsing fails, inspect text
      if (/gouging/i.test(safetyCheck.output_text) && /violation|alert|true/i.test(safetyCheck.output_text)) {
        safetyResult.is_gouging = true;
        safetyResult.reasoning = safetyCheck.output_text;
      }
    }

    if (safetyResult.is_gouging) {
      violations.push(`Anti-Gouging Alert: ${safetyResult.reasoning}`);
    }
  } catch (err) {
    console.warn("Semantic safety check fallback:", err);
  }

  // 3. PERSISTENT LOGGING & AUDITABILITY (Supabase)
  const status: "APPROVED" | "REJECTED" = violations.length === 0 ? "APPROVED" : "REJECTED";

  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await supabase.from("pricing_policy_logs").insert({
        sku_id: skuId,
        base_price: basePrice,
        proposed_price: proposedPrice,
        price_delta_percent: deltaPercent,
        status: status,
        violation_details: violations.length > 0 ? { rules: violations } : null,
        market_context: context,
      });
    }
  } catch (logErr) {
    console.warn("Failed to log audit trail to Supabase:", logErr);
  }

  return {
    allowed: violations.length === 0,
    violations,
    finalPrice: violations.length === 0 ? proposedPrice : basePrice,
    deltaPercent,
    status,
  };
}
