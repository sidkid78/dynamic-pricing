import { NextResponse } from "next/server";
import { genaiClient } from "@/lib/genai";
import {
  getErpAgent,
  getTradeAgent,
  getDynamicPricingAgent,
} from "@/lib/agents/definitions";
import {
  get_inventory_status,
  get_map_constraints,
  get_market_data,
  supabase,
} from "@/lib/agents/tools";

/**
 * Multi-Agent System (MAS) Price Optimizer API Route
 * Orchestrates sequential handover between ERP Inventory, Trade Promotion, and Dynamic Pricing Agents.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const skuId = body.skuId || body.sku;

    if (!skuId) {
      return NextResponse.json(
        { error: "Missing required field: skuId or sku" },
        { status: 400 }
      );
    }

    // Ensure agents are initialized
    await Promise.all([
      getErpAgent(),
      getTradeAgent(),
      getDynamicPricingAgent(),
    ]);

    // Gather baseline state data via tools concurrently for sub-second pipeline
    const [inventoryState, mapRules, marketState] = await Promise.all([
      get_inventory_status(skuId),
      get_map_constraints(skuId),
      get_market_data(skuId),
    ]);

    // Step 1: Execute ERP Inventory Agent Interaction
    const erpInteraction = await genaiClient.interactions.create({
      agent: "erp-inventory-agent",
      input: `
        Analyze warehouse inventory health for SKU: ${skuId}.
        Current Stock Level: ${inventoryState.stock_level} units.
        Lead Time: ${inventoryState.lead_time_days} days.
        Expiry Date: ${inventoryState.expiry_date || "N/A"}.
        Determine inventory pressure (holding cost clearance vs stockout protection).
      `,
      store: true,
    });

    // Step 2: Execute Trade Promotion Agent Interaction
    const tradeInteraction = await genaiClient.interactions.create({
      agent: "trade-promotion-agent",
      input: `
        Retrieve contractual and MAP constraints for SKU: ${skuId}.
        MAP Price Floor: $${mapRules.map_price.toFixed(2)}.
        Active Promotion: ${mapRules.promotion_active}.
        Notes: ${mapRules.promotion_notes || "None"}.
        Specify binding pricing boundaries to prevent vendor co-op violations.
      `,
      store: true,
    });

    // Step 3: Execute MDP Dynamic Pricing (DRL) Agent Interaction
    const finalInteraction = await genaiClient.interactions.create({
      agent: "dynamic-pricing-engine",
      input: `
        Calculate optimal price for SKU: ${skuId}.
        Market Intel: Competitor Benchmark Avg = $${marketState.competitor_avg_price.toFixed(2)}, Sales Velocity = ${marketState.sales_velocity_7d} units/wk.
        ERP Agent Feedback: ${erpInteraction.output_text}
        Trade Promotion Feedback: ${tradeInteraction.output_text}
        MAP Constraint: Price cannot be lower than $${mapRules.map_price.toFixed(2)}.
        
        Optimize DRL Reward Function:
        R_t = α · (Margin) + (1 - α) · (Volume) - β · (Churn) [α=0.7, β=0.2]
        Propose recommended price and projected EBITDA impact.
      `,
      store: true,
    });

    // Calculate simulated recommended price and margin delta
    const currentPrice = marketState.competitor_avg_price;
    // Suggest price: adjust slightly based on inventory vs competitor
    const priceAdjustmentRatio = inventoryState.stock_level > 1000 ? 0.96 : 1.03;
    const rawSuggestedPrice = Number((currentPrice * priceAdjustmentRatio).toFixed(2));
    const recommendedPrice = Math.max(rawSuggestedPrice, mapRules.map_price);
    const projectedMarginDelta = Number(((recommendedPrice - (currentPrice * 0.7)) * 120).toFixed(2));

    // Optional: Log proposed decision to Supabase if available
    try {
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        await supabase.from("pricing_decisions").insert({
          suggested_price: recommendedPrice,
          previous_price: currentPrice,
          projected_margin_delta: projectedMarginDelta,
          projected_volume_impact: priceAdjustmentRatio > 1 ? -0.02 : 0.05,
          agent_reasoning: finalInteraction.output_text,
          state_snapshot: {
            inventory: inventoryState.stock_level,
            comp_avg: marketState.competitor_avg_price,
            velocity: marketState.sales_velocity_7d,
          },
          reward_metrics: {
            alpha: 0.7,
            beta: 0.2,
            projected_margin: projectedMarginDelta,
          },
          status: "proposed",
        });
      }
    } catch (logErr) {
      console.warn("Could not log pricing decision to Supabase:", logErr);
    }

    const logicSummary =
      finalInteraction.steps?.find((s) => s.type === "thought")?.summary ||
      "Optimized price balancing gross margin against volume and MAP compliance.";

    return NextResponse.json({
      success: true,
      skuId,
      recommendedPrice,
      currentBenchmark: currentPrice,
      mapPriceFloor: mapRules.map_price,
      projectedMarginDelta,
      interactionId: finalInteraction.id,
      logicSummary,
      agentChain: {
        erp: {
          interactionId: erpInteraction.id,
          feedback: erpInteraction.output_text,
          stockLevel: inventoryState.stock_level,
        },
        trade: {
          interactionId: tradeInteraction.id,
          feedback: tradeInteraction.output_text,
          mapFloor: mapRules.map_price,
        },
        drlPricing: {
          interactionId: finalInteraction.id,
          feedback: finalInteraction.output_text,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error";
    console.error("Multi-Agent Price Optimization Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
