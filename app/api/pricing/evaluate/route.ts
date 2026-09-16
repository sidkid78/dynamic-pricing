import { NextResponse } from "next/server";
import { genaiClient } from "@/lib/genai";
import { getOrchestratorAgent } from "@/lib/agents/orchestrator";

/**
 * Pricing Evaluation API Route (App Router)
 * Entry point for automated evaluation triggers (Cron jobs, webhooks, competitor price stream updates).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sku, current_state } = body;

    if (!sku) {
      return NextResponse.json(
        { error: "Missing required parameter: sku" },
        { status: 400 }
      );
    }

    // 1. Initialize / retrieve Orchestrator Agent
    const agent = await getOrchestratorAgent();

    // 2. Execute Interaction using the Interactions API
    // The MDP state space (S_t) is passed as structured input
    const interaction = await genaiClient.interactions.create({
      agent: agent.id,
      environment: "remote",
      input: `
        Evaluate dynamic pricing for SKU: ${sku}.
        Current State Vector S_t: ${JSON.stringify(current_state || {})}
        
        Task:
        1. Analyze state against Reward Function: R_t = α·(Margin) + (1-α)·(Volume) - β·(Churn).
        2. Verify policy-as-code guardrails (±15% price delta, MAP constraints).
        3. Propose optimal price adjustment factor A_t.
      `,
      // Interactions are stored for continuous reinforcement learning context
      store: true,
    });

    // 3. Return the recommendation and execution metrics
    return NextResponse.json({
      success: true,
      interaction_id: interaction.id,
      recommendation: interaction.output_text,
      status: interaction.status,
      usage: interaction.usage,
      steps: interaction.steps,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal error";
    console.error("Pricing Orchestration Error:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
