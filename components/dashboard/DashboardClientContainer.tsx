"use client";

import React, { useState } from "react";
import StateSpaceMonitor, { SkuState } from "./StateSpaceMonitor";
import AgentReasoning from "./AgentReasoning";
import type { MasResult } from "@/lib/types/mas";

const INITIAL_SELECTED: SkuState = {
  id: "sku-1",
  sku_id: "SKU-99",
  name: "Enterprise Cloud Node A1",
  competitor_avg: 45.0,
  sales_velocity: 32.4,
  last_action: 0.035,
  active_guardrail: "CLEAR",
  stock_level: 650,
  status: "active",
};

export default function DashboardClientContainer() {
  const [selectedSku, setSelectedSku] = useState<SkuState>(INITIAL_SELECTED);
  const [masResult, setMasResult] = useState<MasResult | null>(null);
  const [masError, setMasError] = useState<{ skuId: string; message: string } | null>(null);

  // Scope the run to its SKU by comparison at render time rather than by
  // clearing state in a callback: the callbacks fire in the same tick and would
  // otherwise read a stale `selectedSku` from their closure and wipe a result
  // that was just set.
  const activeResult = masResult && masResult.skuId === selectedSku.sku_id ? masResult : null;
  const activeError =
    masError && masError.skuId === selectedSku.sku_id ? masError.message : null;

  const decisionPayload = {
    sku_id: selectedSku.sku_id,
    action_factor: selectedSku.last_action,
    erp_stock: selectedSku.stock_level,
    map_status:
      selectedSku.active_guardrail === "MAP_BOUNDED"
        ? "BOUNDED BY CONTRACT FLOOR"
        : "COMPLIANT (Floor $39.99)",
    competitor_benchmark: selectedSku.competitor_avg,
    state_vector: {
      inventory_days: Math.round(selectedSku.stock_level / (selectedSku.sales_velocity || 1)),
      velocity_delta: Number((selectedSku.sales_velocity / 25).toFixed(2)),
      elasticity_score: -1.35,
    },
  };

  return (
    <div className="space-y-6">
      <StateSpaceMonitor
        onSelectSku={setSelectedSku}
        onMasResult={(result, sku) => {
          setMasResult(result);
          setMasError(null);
          setSelectedSku(sku);
        }}
        onMasError={(message, sku) => {
          setMasError({ skuId: sku.sku_id, message });
          setMasResult(null);
          setSelectedSku(sku);
        }}
      />
      <AgentReasoning
        latestDecision={decisionPayload}
        masResult={activeResult}
        masError={activeError}
      />
    </div>
  );
}
