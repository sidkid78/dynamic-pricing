import React from "react";
import CommercializationMetrics from "@/components/dashboard/CommercializationMetrics";
import DashboardClientContainer from "@/components/dashboard/DashboardClientContainer";

export const metadata = {
  title: "Enterprise Dynamic Pricing Command Center",
  description:
    "Autonomous retail pricing optimization engine powered by Markov Decision Processes, Google GenAI Interactions API (gemini-3.7-flash), and Policy-as-Code safety guardrails.",
};

export default function PricingDashboardPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white pb-16">
      {/* Background radial atmosphere glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/20 via-slate-950/60 to-slate-950" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Navigation & Header */}
        <header className="border-b border-slate-800/80 pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs uppercase tracking-widest font-mono text-emerald-400 font-semibold">
                  Autonomous Multi-Agent System Active
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1.5">
                Enterprise Dynamic Pricing Command Center
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
                Continuous Markov Decision Process (MDP) optimization balancing gross margin, inventory holding velocity, and customer churn under deterministic Policy-as-Code safety guardrails.
              </p>
            </div>

            {/* Architecture Stack Badges */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                gemini-3.7-flash
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300">
                Interactions API
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                Supabase Realtime
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                ±15% Policy-as-Code
              </span>
            </div>
          </div>
        </header>

        {/* Section 1: Commercialization & Value-Based EBITDA Lift */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 font-mono">
              1. Outcome-Based Performance &amp; EBITDA Capture
            </h2>
            <span className="text-xs text-slate-500">Contract Rule: 20% Verified Margin Lift Fee</span>
          </div>
          <CommercializationMetrics />
        </section>

        {/* Section 2: Realtime State Space & Explainable AI */}
        <section className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 font-mono">
              2. Active State Space (S_t) &amp; Agentic Decision Synthesis
            </h2>
            <span className="text-xs text-slate-500">Low-Latency MAS Handover Pipeline</span>
          </div>
          <DashboardClientContainer />
        </section>
      </div>
    </main>
  );
}
