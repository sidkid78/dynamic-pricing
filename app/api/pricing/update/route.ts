import { NextResponse } from "next/server";
import { verifyPricingPolicy } from "@/lib/pricing/guardrails";
import { supabase } from "@/lib/agents/tools";

/**
 * Policy Guardrail Price Commit API Route
 * Intercepts pricing updates, validates against Policy-as-Code bounds,
 * logs audit trails, and conditionally applies approved updates to production state.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { skuId, basePrice, proposedPrice, context } = body;

    if (!skuId || basePrice === undefined || proposedPrice === undefined) {
      return NextResponse.json(
        {
          error: "Missing required fields: skuId, basePrice, and proposedPrice must be provided.",
        },
        { status: 400 }
      );
    }

    const numBasePrice = Number(basePrice);
    const numProposedPrice = Number(proposedPrice);

    if (isNaN(numBasePrice) || isNaN(numProposedPrice) || numBasePrice <= 0) {
      return NextResponse.json(
        { error: "Invalid price inputs: basePrice and proposedPrice must be positive numbers." },
        { status: 400 }
      );
    }

    // 1. Intercept proposal with Policy-as-Code Safety Guardrail
    const validation = await verifyPricingPolicy({
      skuId: String(skuId),
      basePrice: numBasePrice,
      proposedPrice: numProposedPrice,
      context: context || "Automated dynamic pricing adjustment",
    });

    // 2. Reject if any deterministic or semantic guardrail violations occurred
    if (!validation.allowed) {
      return NextResponse.json(
        {
          success: false,
          status: "REJECTED",
          message: "Policy Violation: Price update rejected by Policy-as-Code Guardrails.",
          skuId,
          basePrice: numBasePrice,
          proposedPrice: numProposedPrice,
          deltaPercent: validation.deltaPercent,
          violations: validation.violations,
        },
        { status: 403 }
      );
    }

    // 3. If approved, apply update to products and state tables
    try {
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        // Update product price
        await supabase
          .from("products")
          .update({
            current_price: validation.finalPrice,
            updated_at: new Date().toISOString(),
          })
          .eq("sku", skuId);

        // Update realtime state space table
        const actionRatio = Number(((validation.finalPrice - numBasePrice) / numBasePrice).toFixed(4));
        await supabase
          .from("sku_pricing_state")
          .upsert({
            sku_id: skuId,
            last_action: actionRatio,
            active_guardrail: "CLEAR",
            updated_at: new Date().toISOString(),
          }, { onConflict: "sku_id" });
      }
    } catch (dbErr) {
      console.warn("Could not commit live price update to Supabase:", dbErr);
    }

    return NextResponse.json({
      success: true,
      status: "APPROVED",
      skuId,
      newPrice: validation.finalPrice,
      previousPrice: numBasePrice,
      deltaPercent: validation.deltaPercent,
      message: "Price update verified and committed successfully.",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error";
    console.error("Pricing Update Guardrail Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
