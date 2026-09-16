"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { MasResult } from "@/lib/types/mas";

export interface SkuState {
  id: string;
  sku_id: string;
  name: string;
  competitor_avg: number;
  sales_velocity: number;
  last_action: number;
  active_guardrail: string;
  stock_level: number;
  status: "active" | "optimizing" | "held";
}

const INITIAL_SKUS: SkuState[] = [
  {
    id: "sku-1",
    sku_id: "SKU-99",
    name: "Enterprise Cloud Node A1",
    competitor_avg: 45.0,
    sales_velocity: 32.4,
    last_action: 0.035, // +3.5%
    active_guardrail: "CLEAR",
    stock_level: 650,
    status: "active",
  },
  {
    id: "sku-2",
    sku_id: "SKU-X7",
    name: "Industrial IoT Gateway",
    competitor_avg: 129.5,
    sales_velocity: 14.8,
    last_action: -0.042, // -4.2%
    active_guardrail: "MAP_BOUNDED",
    stock_level: 1420,
    status: "active",
  },
  {
    id: "sku-3",
    sku_id: "SKU-402",
    name: "High-Frequency Transceiver",
    competitor_avg: 89.0,
    sales_velocity: 58.1,
    last_action: 0.082, // +8.2%
    active_guardrail: "CLEAR",
    stock_level: 180,
    status: "active",
  },
  {
    id: "sku-4",
    sku_id: "SKU-819",
    name: "CPG Fast-Moving Beverage Pack",
    competitor_avg: 18.25,
    sales_velocity: 195.0,
    last_action: -0.021, // -2.1%
    active_guardrail: "EXPIRY_ACCEL",
    stock_level: 2400,
    status: "active",
  },
  {
    id: "sku-5",
    sku_id: "SKU-104",
    name: "Server Power Distribution Unit",
    competitor_avg: 210.0,
    sales_velocity: 8.5,
    last_action: 0.015, // +1.5%
    active_guardrail: "CLEAR",
    stock_level: 95,
    status: "active",
  },
];

interface StateSpaceMonitorProps {
  onSelectSku?: (sku: SkuState) => void;
  /** Fired when a MAS run completes, so the synthesis panel can show the real agent chain. */
  onMasResult?: (result: MasResult, sku: SkuState) => void;
  /** Fired when a MAS run fails, so the failure is visible rather than silent. */
  onMasError?: (message: string, sku: SkuState) => void;
}

export default function StateSpaceMonitor({
  onSelectSku,
  onMasResult,
  onMasError,
}: StateSpaceMonitorProps) {
  const [skus, setSkus] = useState<SkuState[]>(INITIAL_SKUS);
  const [optimizingSku, setOptimizingSku] = useState<string | null>(null);
  const [lastEventTime, setLastEventTime] = useState<string>("Streaming Live");
  const [errorSku, setErrorSku] = useState<{ sku: string; message: string } | null>(null);

  useEffect(() => {
    try {
      const supabase = createClient();
      const channel = supabase
        .channel("state_space_updates")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "sku_pricing_state" },
          (payload: any) => {
            if (payload.new) {
              setSkus((prev) =>
                prev.map((s) =>
                  s.sku_id === payload.new.sku_id
                    ? {
                        ...s,
                        competitor_avg: Number(payload.new.competitor_avg) || s.competitor_avg,
                        sales_velocity: Number(payload.new.sales_velocity) || s.sales_velocity,
                        last_action: Number(payload.new.last_action) || s.last_action,
                        active_guardrail: payload.new.active_guardrail || s.active_guardrail,
                      }
                    : s
                )
              );
              setLastEventTime(new Date().toLocaleTimeString());
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn("Supabase Realtime subscription disabled/fallback:", err);
    }
  }, []);

  const handleOptimize = async (sku: SkuState) => {
    setOptimizingSku(sku.sku_id);
    setErrorSku(null);
    // Select the row being optimized so the synthesis panel tracks this SKU.
    onSelectSku?.(sku);

    try {
      const response = await fetch("/api/price-optimizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skuId: sku.sku_id }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          (data && typeof data.error === "string" && data.error) ||
          `Request failed with HTTP ${response.status}`;
        setErrorSku({ sku: sku.sku_id, message });
        setSkus((prev) =>
          prev.map((s) => (s.sku_id === sku.sku_id ? { ...s, status: "held" } : s))
        );
        onMasError?.(message, sku);
        return;
      }

      const result = data as MasResult;
      const deltaFactor = Number(
        ((result.recommendedPrice - sku.competitor_avg) / sku.competitor_avg).toFixed(4)
      );
      const updated: SkuState = { ...sku, last_action: deltaFactor, status: "active" };

      setSkus((prev) => prev.map((s) => (s.sku_id === sku.sku_id ? updated : s)));
      setLastEventTime(new Date().toLocaleTimeString());

      // Hand the full agent chain up so the synthesis panel can render it.
      // onMasResult also selects the row, so no extra onSelectSku call here.
      onMasResult?.(result, updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error contacting MAS";
      setErrorSku({ sku: sku.sku_id, message });
      setSkus((prev) =>
        prev.map((s) => (s.sku_id === sku.sku_id ? { ...s, status: "held" } : s))
      );
      onMasError?.(message, sku);
    } finally {
      setOptimizingSku(null);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white tracking-tight">Active State Space (S_t)</h3>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {lastEventTime}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time Markov Decision Process environment vector: Competitor Benchmarks vs Sales Velocity & Stock Pressure
          </p>
        </div>
      </div>

      {errorSku && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5"
        >
          <span className="mt-0.5 text-rose-400 text-sm leading-none">⚠</span>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-rose-300">
              MAS run failed for {errorSku.sku}
            </div>
            <div className="mt-0.5 break-words font-mono text-[11px] text-rose-400/90">
              {errorSku.message}
            </div>
          </div>
          <button
            onClick={() => setErrorSku(null)}
            className="ml-auto shrink-0 rounded-lg px-2 py-0.5 text-[11px] text-rose-300/70 transition hover:bg-rose-500/10 hover:text-rose-200"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="overflow-x-auto mt-4">
        <table className="w-full text-left text-sm text-slate-300">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider font-mono">
              <th className="py-3 px-3">SKU Identifier</th>
              <th className="py-3 px-3">Stock Units</th>
              <th className="py-3 px-3">Comp. Benchmark</th>
              <th className="py-3 px-3">Sales Velocity</th>
              <th className="py-3 px-3">Policy Action (A_t)</th>
              <th className="py-3 px-3">Safety Rail</th>
              <th className="py-3 px-3 text-right">Autonomous MAS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
            {skus.map((sku) => {
              const isPositive = sku.last_action > 0;
              const isZero = sku.last_action === 0;

              return (
                <tr
                  key={sku.id}
                  onClick={() => onSelectSku?.(sku)}
                  className="hover:bg-slate-800/40 transition cursor-pointer group"
                >
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white group-hover:text-blue-400 transition">{sku.sku_id}</span>
                      {sku.status === "held" && (
                        <span
                          title="Last MAS run failed"
                          className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-rose-400 border border-rose-500/20"
                        >
                          HELD
                        </span>
                      )}
                    </div>
                    <div className="font-sans text-[11px] text-slate-400 truncate max-w-[180px]">{sku.name}</div>
                  </td>
                  <td className="py-3.5 px-3">
                    <span className={`px-2 py-0.5 rounded ${sku.stock_level > 1000 ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "text-slate-300"}`}>
                      {sku.stock_level} units
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-slate-200">
                    ${sku.competitor_avg.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-3 text-slate-200">
                    {sku.sales_velocity.toFixed(1)} <span className="text-slate-500 text-[10px]">u/hr</span>
                  </td>
                  <td className="py-3.5 px-3 font-semibold">
                    <span
                      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full ${
                        isZero
                          ? "bg-slate-800 text-slate-400"
                          : isPositive
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {(sku.last_action * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] border ${
                        sku.active_guardrail === "CLEAR"
                          ? "bg-slate-800 text-slate-400 border-slate-700"
                          : "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                      }`}
                    >
                      {sku.active_guardrail}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOptimize(sku);
                      }}
                      disabled={optimizingSku === sku.sku_id}
                      className="px-3 py-1 text-xs font-sans rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                      {optimizingSku === sku.sku_id ? "Synthesizing..." : "Trigger MAS"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
