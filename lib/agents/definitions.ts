/**
 * Enterprise Multi-Agent System (MAS) Agent Definitions
 * Powered by Google GenAI Interactions API and gemini-3.7-flash
 */
import { genaiClient, DASHBOARD_MODEL } from "../genai";
import {
  get_inventory_status,
  get_map_constraints,
  get_market_data,
} from "./tools";

/**
 * 1. ERP Inventory Agent
 * Analyzes warehouse capacity, lead times, and SKU expiration pressures.
 */
export async function getErpAgent() {
  const existing = genaiClient.agents.get("erp-inventory-agent");
  if (existing) return existing;

  return await genaiClient.agents.create({
    id: "erp-inventory-agent",
    base_agent: "antigravity-preview-05-2026",
    model: DASHBOARD_MODEL,
    system_instruction: `
      You are the ERP Inventory Agent. Your role is to verify warehouse capacity, lead times, and stock aging.
      - If stock is high (>1000 units) and velocity is low, flag for aggressive markdown to clear working capital.
      - If lead times are increasing (>14 days) or stock is critical (<100 units), flag for price protection to slow velocity.
      - Check expiration dates for CPG products to apply dynamic markdown pressure.
    `,
    tools: [get_inventory_status as (...args: unknown[]) => unknown],
  });
}

/**
 * 2. Trade Promotion Agent
 * Enforces Minimum Advertised Price (MAP) rules and vendor contractual constraints.
 */
export async function getTradeAgent() {
  const existing = genaiClient.agents.get("trade-promotion-agent");
  if (existing) return existing;

  return await genaiClient.agents.create({
    id: "trade-promotion-agent",
    base_agent: "antigravity-preview-05-2026",
    model: DASHBOARD_MODEL,
    system_instruction: `
      You are the Trade Promotion Agent. You enforce legal and contractual pricing guardrails.
      - You MUST ensure any proposed price stays strictly at or above the Minimum Advertised Price (MAP).
      - Check if active manufacturer promotions override dynamic adjustments.
      - Veto any downward recommendation that breaches co-op marketing agreements.
    `,
    tools: [get_map_constraints as (...args: unknown[]) => unknown],
  });
}

/**
 * 3. Dynamic Pricing (DRL) Agent
 * Evaluates the Markov Decision Process (MDP) State Space and optimizes the continuous Reward Function:
 * R_t = α · (Margin) + (1 - α) · (Volume) - β · (Churn)
 */
export async function getDynamicPricingAgent() {
  const existing = genaiClient.agents.get("dynamic-pricing-engine");
  if (existing) return existing;

  return await genaiClient.agents.create({
    id: "dynamic-pricing-engine",
    base_agent: "antigravity-preview-05-2026",
    model: DASHBOARD_MODEL,
    system_instruction: `
      You are the Core Dynamic Pricing Optimizer. You model retail pricing as a Markov Decision Process (MDP).
      Input State Vector S_t = <Competitor Prices, Sales Velocity, Inventory Levels, MAP Constraints>.
      Continuous Reward Function: R_t = α · (Margin) + (1 - α) · (Volume) - β · (Churn)
      
      Apply Policy-as-Code Guardrails:
      1. Never drop price more than 5% below competitor avg in a single step to avoid race-to-the-bottom loops.
      2. Maintain a minimum gross margin of 12% regardless of competitor pressure.
      3. If sentiment indicates high churn risk, dynamically increase volume weighting (1 - α).
      4. Always respect hard MAP boundaries confirmed by the Trade Promotion Agent.
    `,
    tools: [get_market_data as (...args: unknown[]) => unknown],
  });
}

// Auto-initialize default agents into registry
void getErpAgent();
void getTradeAgent();
void getDynamicPricingAgent();
