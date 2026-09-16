-- Seed data for local development.
-- Applied automatically by `supabase db reset`; safe to re-run (idempotent).
--
-- The SKUs mirror INITIAL_SKUS in components/dashboard/StateSpaceMonitor.tsx so
-- the dashboard rows resolve against real rows instead of the mock fallbacks in
-- lib/agents/tools.ts.

-- 1. Products ---------------------------------------------------------------
INSERT INTO products (sku, name, category, base_cost, current_price) VALUES
  ('SKU-99',  'Enterprise Cloud Node A1',        'Infrastructure', 28.00,  45.00),
  ('SKU-X7',  'Industrial IoT Gateway',          'Hardware',       82.00, 129.50),
  ('SKU-402', 'High-Frequency Transceiver',      'Components',     54.00,  89.00),
  ('SKU-819', 'CPG Fast-Moving Beverage Pack',   'CPG',             9.10,  18.25),
  ('SKU-104', 'Server Power Distribution Unit',  'Infrastructure',132.00, 210.00)
ON CONFLICT (sku) DO UPDATE
  SET name = EXCLUDED.name,
      category = EXCLUDED.category,
      base_cost = EXCLUDED.base_cost,
      current_price = EXCLUDED.current_price;

-- 2. Inventory --------------------------------------------------------------
-- quantity_on_hand matches the stock_level shown per row in the dashboard.
INSERT INTO inventory (product_id, warehouse_id, quantity_on_hand, expiry_date, lead_time_days)
SELECT p.id, v.warehouse_id, v.qty, v.expiry, v.lead_time
FROM (VALUES
  ('SKU-99',  'WH-EAST-01',  650, NULL::date,              7),
  ('SKU-X7',  'WH-WEST-02', 1420, NULL::date,             21),
  ('SKU-402', 'WH-EAST-01',  180, NULL::date,             14),
  ('SKU-819', 'WH-CPG-03',  2400, DATE '2026-11-30',       3),
  ('SKU-104', 'WH-WEST-02',   95, NULL::date,             35)
) AS v(sku, warehouse_id, qty, expiry, lead_time)
JOIN products p ON p.sku = v.sku
ON CONFLICT DO NOTHING;

-- 3. Vendor contracts (MAP floors) ------------------------------------------
INSERT INTO vendor_contracts (sku_id, vendor_name, map_price, promotion_active, promotion_notes) VALUES
  ('SKU-99',  'Northwind Cloud Supply', 39.99, false, 'Standard co-op agreement; MAP floor enforced.'),
  ('SKU-X7',  'Meridian Industrial',   115.00, true,  'Q3 channel promotion active; floor raised by contract.'),
  ('SKU-402', 'Apex RF Components',     72.50, false, 'Standard MAP floor.'),
  ('SKU-819', 'Cascade Beverage Co',    14.99, true,  'Expiry-driven markdown window permitted to MAP floor.'),
  ('SKU-104', 'Northwind Cloud Supply',185.00, false, 'Standard MAP floor.')
ON CONFLICT DO NOTHING;

-- 4. Pricing guardrails ------------------------------------------------------
INSERT INTO pricing_guardrails (product_id, min_margin_pct, max_price_volatility_pct, map_price, is_active)
SELECT p.id, v.min_margin, v.max_vol, v.map_price, true
FROM (VALUES
  ('SKU-99',  0.1200, 0.1500,  39.99),
  ('SKU-X7',  0.1000, 0.1000, 115.00),
  ('SKU-402', 0.1500, 0.1500,  72.50),
  ('SKU-819', 0.0800, 0.2000,  14.99),
  ('SKU-104', 0.1200, 0.1000, 185.00)
) AS v(sku, min_margin, max_vol, map_price)
JOIN products p ON p.sku = v.sku
ON CONFLICT DO NOTHING;

-- 5. Market intelligence -----------------------------------------------------
-- Deliberately distinct from the hardcoded fallback in lib/agents/tools.ts
-- (competitor_avg_price 45.00 / sales_velocity_7d 142.5) so a live DB read is
-- visibly different from the mock path.
INSERT INTO market_intel (sku_id, competitor_avg_price, sales_velocity_7d, sentiment_score) VALUES
  ('SKU-99',   44.20, 227.0,  0.11),
  ('SKU-X7',  131.75, 103.6, -0.04),
  ('SKU-402',  87.40, 406.7,  0.22),
  ('SKU-819',  17.90, 1365.0, 0.06),
  ('SKU-104', 214.30,  59.5, -0.12)
ON CONFLICT DO NOTHING;

-- 6. Realtime state space ----------------------------------------------------
-- Published to supabase_realtime; StateSpaceMonitor subscribes to changes here.
INSERT INTO sku_pricing_state (sku_id, competitor_avg, sales_velocity, last_action, active_guardrail) VALUES
  ('SKU-99',   44.20, 32.4,  0.035, 'CLEAR'),
  ('SKU-X7',  131.75, 14.8, -0.042, 'MAP_BOUNDED'),
  ('SKU-402',  87.40, 58.1,  0.082, 'CLEAR'),
  ('SKU-819',  17.90, 195.0, -0.021, 'EXPIRY_ACCEL'),
  ('SKU-104', 214.30,  8.5,  0.015, 'CLEAR')
ON CONFLICT DO NOTHING;
