-- Lock down the pricing tables. They were created without row level security,
-- which left them readable and writable by anyone holding the public anon key.
--
-- Server code uses the service-role key, which bypasses RLS, so enabling it with
-- no policies keeps every server path working. The one browser path is the
-- Realtime subscription in StateSpaceMonitor, which respects RLS, so
-- sku_pricing_state gets a read-only policy.

alter table public.products                    enable row level security;
alter table public.inventory                   enable row level security;
alter table public.competitor_prices           enable row level security;
alter table public.market_intel                enable row level security;
alter table public.pricing_decisions           enable row level security;
alter table public.pricing_guardrails          enable row level security;
alter table public.pricing_performance_metrics enable row level security;
alter table public.pricing_policy_logs         enable row level security;
alter table public.sales_events                enable row level security;
alter table public.sku_pricing_state           enable row level security;
alter table public.vendor_contracts            enable row level security;

drop policy if exists "Pricing state is readable for the live monitor" on public.sku_pricing_state;
create policy "Pricing state is readable for the live monitor"
  on public.sku_pricing_state
  for select
  to anon, authenticated
  using (true);

-- Evaluate the summary view with the caller's permissions rather than the
-- creator's, so it cannot be used to read past RLS.
alter view public.ebitda_lift_summary set (security_invoker = true);
