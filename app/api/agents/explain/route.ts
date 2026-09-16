import { NextResponse } from "next/server";
import { genaiClient, DASHBOARD_MODEL } from "@/lib/genai";

/**
 * Explainable AI (XAI) route.
 *
 * This lives server-side on purpose: lib/genai.ts reads GEMINI_API_KEY /
 * GOOGLE_GENAI_API_KEY, which are not NEXT_PUBLIC_ and must never be bundled
 * into the browser. The dashboard calls this route instead of importing
 * genaiClient directly.
 */

const SYSTEM_INSTRUCTION = `
  You are the Explainable AI (XAI) Engine for the Enterprise Dynamic Pricing System.
  Deliver concise, high-conviction executive summaries explaining Markov Decision Process agent decisions.
  Highlight trade-offs between Gross Margin, Inventory Velocity, and Churn Risk.
`;

interface StateVector {
  inventory_days: number;
  velocity_delta: number;
  elasticity_score: number;
}

interface ExplainRequestBody {
  skuId?: string;
  actionFactor?: number;
  erpStock?: number;
  mapStatus?: string;
  competitorBenchmark?: number;
  stateVector?: StateVector;
  question?: string;
  /** Optional real agent output from a prior /api/price-optimizer run. */
  agentFeedback?: { erp?: string; trade?: string; drl?: string };
}

function buildPrompt(body: ExplainRequestBody): string {
  const {
    skuId = "UNKNOWN",
    actionFactor = 0,
    erpStock = 0,
    mapStatus = "UNKNOWN",
    competitorBenchmark = 0,
    stateVector,
    question,
    agentFeedback,
  } = body;

  const pct = `${actionFactor >= 0 ? "+" : ""}${(actionFactor * 100).toFixed(1)}%`;
  const context = `SKU ${skuId}, Action: ${pct}, Stock: ${erpStock}, MAP: ${mapStatus}, Competitor Benchmark: $${competitorBenchmark.toFixed(2)}`;

  // When a MAS run has actually happened, ground the explanation in the real
  // agent transcripts rather than re-deriving them from summary numbers.
  const chain = agentFeedback
    ? `
       Actual agent chain transcripts from the most recent MAS run:
       - ERP Inventory Agent: ${agentFeedback.erp || "(not run)"}
       - Trade Promotion Agent: ${agentFeedback.trade || "(not run)"}
       - DRL Pricing Agent: ${agentFeedback.drl || "(not run)"}
      `
    : "";

  if (question) {
    return `Stakeholder query: "${question}". Context: ${context}.${chain}\nExplain the orchestrator reasoning.`;
  }

  return `Analyze this pricing decision for SKU: ${skuId}.
     Policy Action: ${pct} adjustment factor.
     State Vector: ${JSON.stringify(stateVector ?? {})}.
     ${context}.${chain}
     Explain why the DRL policy selected this action, how it optimized gross margin
     without provoking competitor retaliation, and verify MAP safety guardrail compliance.`;
}

export async function POST(req: Request) {
  try {
    const body: ExplainRequestBody = await req.json();

    if (!body.skuId) {
      return NextResponse.json(
        { error: "Missing required field: skuId" },
        { status: 400 }
      );
    }

    const interaction = await genaiClient.interactions.create({
      model: DASHBOARD_MODEL,
      system_instruction: SYSTEM_INSTRUCTION,
      input: buildPrompt(body),
      generation_config: { temperature: 0.2 },
      store: true,
    });

    if (!interaction.output_text) {
      return NextResponse.json(
        { error: "Agent returned an empty explanation." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      interactionId: interaction.id,
      outputText: interaction.output_text,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("XAI explain error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
