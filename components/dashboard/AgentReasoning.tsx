"use client";

import React, { useState } from "react";
import AgentTranscript from "./AgentTranscript";
import type { MasResult, ExplainResult } from "@/lib/types/mas";

interface DecisionPayload {
  sku_id: string;
  action_factor: number;
  erp_stock: number;
  map_status: string;
  competitor_benchmark: number;
  state_vector: {
    inventory_days: number;
    velocity_delta: number;
    elasticity_score: number;
  };
}

const DEFAULT_DECISION: DecisionPayload = {
  sku_id: "SKU-99",
  action_factor: 0.035,
  erp_stock: 650,
  map_status: "COMPLIANT (Floor $39.99)",
  competitor_benchmark: 45.0,
  state_vector: {
    inventory_days: 14,
    velocity_delta: 1.12,
    elasticity_score: -1.35,
  },
};

interface AgentReasoningProps {
  latestDecision?: DecisionPayload;
  /** Full agent chain from the most recent /api/price-optimizer run, if any. */
  masResult?: MasResult | null;
  /** Error text from a failed MAS run, if any. */
  masError?: string | null;
}

type TabKey = "orchestrator" | "erp" | "trade" | "drl";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "orchestrator", label: "Orchestrator Synthesis" },
  { key: "erp", label: "ERP Inventory Agent" },
  { key: "trade", label: "Trade Promotion (MAP)" },
  { key: "drl", label: "DRL Reward Policy" },
];

export default function AgentReasoning({
  latestDecision = DEFAULT_DECISION,
  masResult = null,
  masError = null,
}: AgentReasoningProps) {
  const [insight, setInsight] = useState<string>("");
  const [insightError, setInsightError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabKey>("orchestrator");
  const [queryPrompt, setQueryPrompt] = useState<string>("");

  const explainDecision = async (customQuestion?: string) => {
    setLoading(true);
    setInsightError(null);
    try {
      const response = await fetch("/api/agents/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skuId: latestDecision.sku_id,
          actionFactor: latestDecision.action_factor,
          erpStock: latestDecision.erp_stock,
          mapStatus: latestDecision.map_status,
          competitorBenchmark: latestDecision.competitor_benchmark,
          stateVector: latestDecision.state_vector,
          question: customQuestion,
          // Ground the explanation in the real transcripts when we have them.
          agentFeedback: masResult
            ? {
                erp: masResult.agentChain?.erp?.feedback,
                trade: masResult.agentChain?.trade?.feedback,
                drl: masResult.agentChain?.drlPricing?.feedback,
              }
            : undefined,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          (data && typeof data.error === "string" && data.error) ||
            `Explain request failed with HTTP ${response.status}`
        );
      }

      setInsight((data as ExplainResult).outputText);
    } catch (err) {
      setInsightError(err instanceof Error ? err.message : "Failed to reach XAI agent");
    } finally {
      setLoading(false);
    }
  };

  const chain = masResult?.agentChain;
  const tabTranscript: Record<TabKey, string | undefined> = {
    orchestrator: undefined,
    erp: chain?.erp?.feedback,
    trade: chain?.trade?.feedback,
    drl: chain?.drlPricing?.feedback,
  };

  const emptyHint = masError
    ? "The last MAS run failed - see the error above the state space table."
    : "Click 'Trigger MAS' on a SKU row to run the agent chain and populate this panel with live transcripts.";

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
            <h3 className="text-lg font-bold text-white tracking-tight">
              Explainable AI (XAI) &amp; Multi-Agent Synthesizer
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {masResult
              ? `Live transcripts / interaction ${masResult.interactionId}`
              : "Powered by Google GenAI Interactions API"}
          </p>
        </div>

        <button
          onClick={() => explainDecision()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-1 h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Synthesizing Interactions...
            </>
          ) : (
            <span>Explain Decision ({latestDecision.sku_id})</span>
          )}
        </button>
      </div>

      {/* Decision summary strip - only meaningful once a MAS run has happened */}
      {masResult && (
        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: "Recommended", value: `$${masResult.recommendedPrice.toFixed(2)}` },
            { label: "Benchmark", value: `$${masResult.currentBenchmark.toFixed(2)}` },
            { label: "MAP Floor", value: `$${masResult.mapPriceFloor.toFixed(2)}` },
            {
              label: "Margin Delta",
              value: `${masResult.projectedMarginDelta >= 0 ? "+" : ""}$${masResult.projectedMarginDelta.toFixed(2)}`,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2"
            >
              <dt className="text-[10px] uppercase tracking-wider text-slate-500">{stat.label}</dt>
              <dd className="mt-0.5 font-mono text-sm font-semibold text-slate-100">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Agent Perspectives Sub-tabs */}
      <div className="flex flex-wrap items-center gap-2 mt-4 text-xs">
        {TABS.map((tab) => {
          const hasData = tab.key === "orchestrator" ? !!masResult : !!tabTranscript[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                activeTab === tab.key
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-800/80 text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
              {hasData && (
                <span
                  className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle"
                  title="Live agent output available"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content - real agent transcript when available */}
      <div className="mt-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs max-h-96 overflow-y-auto">
        {activeTab === "orchestrator" ? (
          masResult ? (
            <div className="font-sans text-[11px] leading-relaxed text-slate-300">
              <span className="font-semibold text-indigo-400">Orchestrator Summary:</span>{" "}
              {masResult.logicSummary}
              <div className="mt-2 font-mono text-[10px] text-slate-500 break-all">
                ERP {chain?.erp?.interactionId ?? "n/a"} / Trade{" "}
                {chain?.trade?.interactionId ?? "n/a"} / DRL{" "}
                {chain?.drlPricing?.interactionId ?? "n/a"}
              </div>
            </div>
          ) : (
            <p className="font-sans text-[11px] text-slate-500">{emptyHint}</p>
          )
        ) : tabTranscript[activeTab] ? (
          <AgentTranscript text={tabTranscript[activeTab] as string} />
        ) : (
          <p className="font-sans text-[11px] text-slate-500">{emptyHint}</p>
        )}
      </div>

      {/* Generated Explanation Content */}
      <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-indigo-500/20 text-sm leading-relaxed text-slate-200">
        <div className="text-xs uppercase tracking-wider font-semibold text-indigo-400 mb-2 flex items-center justify-between">
          <span>Agentic Reasoning Narrative</span>
          <span className="font-mono text-[10px] text-slate-500">Autonomous MDP Trace</span>
        </div>

        {insightError ? (
          <div role="alert" className="flex items-start gap-2">
            <span className="text-rose-400 text-sm leading-none">!</span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-rose-300">Explanation failed</div>
              <div className="mt-0.5 break-words font-mono text-[11px] text-rose-400/90">
                {insightError}
              </div>
            </div>
          </div>
        ) : insight ? (
          <AgentTranscript text={insight} />
        ) : (
          <p className="font-sans text-xs text-slate-500 leading-relaxed">
            Click &quot;Explain Decision&quot; above to generate a natural-language summary of the
            agent chain.
          </p>
        )}
      </div>

      {/* Natural Language Stakeholder Query Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (queryPrompt.trim()) {
            explainDecision(queryPrompt.trim());
          }
        }}
        className="mt-4 flex gap-2"
      >
        <input
          type="text"
          value={queryPrompt}
          onChange={(e) => setQueryPrompt(e.target.value)}
          placeholder="Ask Orchestrator: why was the competitor drop on SKU-99 not matched?"
          className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={loading || !queryPrompt.trim()}
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition disabled:opacity-40"
        >
          Query Agent
        </button>
      </form>
    </div>
  );
}
