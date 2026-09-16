/**
 * Enterprise Pricing Orchestrator Agent
 * Configured using Google GenAI SDK and gemini-3.7-flash for low-latency reasoning
 */
import { genaiClient, DASHBOARD_MODEL } from "../genai";

export async function getOrchestratorAgent() {
  // Check if agent is already initialized in registry
  const existing = genaiClient.agents.get("pricing-orchestrator-v1");
  if (existing) {
    return existing;
  }

  // Register the managed Orchestrator Agent
  return await genaiClient.agents.create({
    id: "pricing-orchestrator-v1",
    base_agent: "antigravity-preview-05-2026",
    model: DASHBOARD_MODEL,
    system_instruction: `
      You are the Enterprise Pricing Orchestrator. 
      Your goal: Optimize real-time gross margins and yield management.
      
      CORE CONSTRAINTS (Policy-as-Code):
      1. Never allow a price drop >15% below MSRP without Trade Promotion Agent approval.
      2. Prevent downward price-spiral loops with competitor bots.
      3. Ensure compliance with MAP (Minimum Advertised Price) rules.
      
      MDP STATE SPACE HANDLING:
      Ingest: <Competitor Prices, Historical Sales Velocity, Inventory Levels, Seasonality>.
      Action: Determine Price Adjustment Factor [-15%, +15%].
      
      ROUTING:
      - Coordinate with ERP Inventory Agent for stock levels and warehouse constraints.
      - Coordinate with Trade Promotion Agent for contract compliance and active MAP rules.
      - Synthesize DRL Reward Function: R_t = α·(Margin) + (1-α)·(Volume) - β·(Churn).
    `,
    base_environment: {
      type: "remote", // Managed sandbox for enterprise execution
    },
  });
}
