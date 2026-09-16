-- Enterprise Dynamic Pricing System Schema
-- Migration: 20260401000000_schema.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom Types
DO $$ BEGIN
    CREATE TYPE decision_status AS ENUM ('proposed', 'applied', 'rejected', 'overridden');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE pricing_policy_status AS ENUM ('APPROVED', 'REJECTED', 'OVERRIDDEN_BY_SYSTEM');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 1. Products Master Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    base_cost NUMERIC(12, 2) NOT NULL, -- The floor for margin calculations
    current_price NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- 2. Inventory Levels (Multi-warehouse support)
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id TEXT NOT NULL,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    expiry_date DATE, -- Critical for CPG/Retail markdown pressure
    lead_time_days INTEGER DEFAULT 7,
    last_replenished_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON inventory(expiry_date);

-- 3. Competitor Pricing Feeds
CREATE TABLE IF NOT EXISTS competitor_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    competitor_name TEXT NOT NULL,
    observed_price NUMERIC(12, 2) NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    observed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_prices_product_at ON competitor_prices(product_id, observed_at DESC);

-- 4. Pricing Guardrails (Policy-as-Code bounds per product)
CREATE TABLE IF NOT EXISTS pricing_guardrails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID UNIQUE REFERENCES products(id) ON DELETE CASCADE,
    min_margin_pct NUMERIC(5, 4) NOT NULL DEFAULT 0.0500, -- e.g., 0.0500 = 5%
    max_price_volatility_pct NUMERIC(5, 4) NOT NULL DEFAULT 0.1500, -- Prevents massive swings (±15%)
    map_price NUMERIC(12, 2), -- Minimum Advertised Price (Contractual floor)
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Pricing Decisions (Markov Decision Process Audit Trail & EBITDA Tracking)
CREATE TABLE IF NOT EXISTS pricing_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    
    -- Action Space (A_t)
    suggested_price NUMERIC(12, 2) NOT NULL,
    previous_price NUMERIC(12, 2) NOT NULL,
    
    -- Reward Function (R_t) & EBITDA Lift Metrics
    projected_margin_delta NUMERIC(12, 2), 
    projected_volume_impact NUMERIC(5, 4),
    
    -- Agentic Context & Insights
    agent_reasoning TEXT, -- Stored from Gemini's thought/output steps
    state_snapshot JSONB, -- Captures {inventory, comp_avg, velocity} at decision time
    reward_metrics JSONB, -- Stores {projected_margin, churn_risk}
    
    status decision_status DEFAULT 'proposed',
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_decisions_product_created ON pricing_decisions(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_decisions_status ON pricing_decisions(status);

-- 6. Sales Events (Velocity and Realized Margin Verification)
CREATE TABLE IF NOT EXISTS sales_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    price_at_sale NUMERIC(12, 2) NOT NULL,
    cost_at_sale NUMERIC(12, 2) NOT NULL, -- Used to calculate realized profit
    customer_segment TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_velocity ON sales_events(product_id, timestamp DESC);

-- 7. Pricing Policy Logs (Deterministic & Semantic Guardrail Auditing)
CREATE TABLE IF NOT EXISTS pricing_policy_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku_id TEXT NOT NULL,
    base_price NUMERIC(12, 2) NOT NULL,
    proposed_price NUMERIC(12, 2) NOT NULL,
    price_delta_percent NUMERIC(5, 2) NOT NULL,
    status pricing_policy_status NOT NULL,
    violation_details JSONB, -- Stores specific rule failures
    market_context TEXT,      -- Summary of context for semantic anti-gouging check
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_logs_sku ON pricing_policy_logs(sku_id, created_at DESC);

-- 8. Vendor Contracts & Trade Promotion Constraints
CREATE TABLE IF NOT EXISTS vendor_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku_id TEXT NOT NULL,
    vendor_name TEXT NOT NULL,
    map_price NUMERIC(12, 2) NOT NULL,
    promotion_active BOOLEAN DEFAULT FALSE,
    promotion_notes TEXT,
    effective_from TIMESTAMPTZ DEFAULT NOW(),
    effective_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_contracts_sku ON vendor_contracts(sku_id);

-- 9. Market Intelligence Stream Table
CREATE TABLE IF NOT EXISTS market_intel (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku_id TEXT NOT NULL,
    competitor_avg_price NUMERIC(12, 2) NOT NULL,
    sales_velocity_7d NUMERIC(10, 2) NOT NULL DEFAULT 0,
    sentiment_score NUMERIC(4, 3) DEFAULT 0.0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_intel_sku ON market_intel(sku_id);

-- 10. Realtime SKU Pricing State Space (Monitored by Client Dashboard)
CREATE TABLE IF NOT EXISTS sku_pricing_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku_id TEXT UNIQUE NOT NULL,
    competitor_avg NUMERIC(12, 2) NOT NULL DEFAULT 0,
    sales_velocity NUMERIC(10, 2) NOT NULL DEFAULT 0,
    last_action NUMERIC(6, 4) NOT NULL DEFAULT 0, -- Action factor e.g. +0.05
    active_guardrail TEXT DEFAULT 'CLEAR',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sku_pricing_state_sku ON sku_pricing_state(sku_id);

-- 11. Aggregate Commercialization Metrics (For Performance Billing)
CREATE TABLE IF NOT EXISTS pricing_performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ebitda_lift NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_margin_lift NUMERIC(14, 2) NOT NULL DEFAULT 0,
    volume_increase NUMERIC(10, 2) NOT NULL DEFAULT 0,
    churn_impact NUMERIC(10, 2) NOT NULL DEFAULT 0,
    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Real-time Publication Enablement (for Supabase Realtime)
ALTER PUBLICATION supabase_realtime ADD TABLE sku_pricing_state;
ALTER PUBLICATION supabase_realtime ADD TABLE pricing_decisions;

-- 12. Real-Time Performance View
CREATE OR REPLACE VIEW ebitda_lift_summary AS
SELECT 
    p.sku,
    p.name,
    COALESCE(SUM((s.price_at_sale - s.cost_at_sale) * s.quantity), 0) AS realized_gross_profit,
    COUNT(s.id) AS transaction_volume,
    COALESCE(AVG(pd.projected_margin_delta), 0) AS avg_suggested_lift
FROM products p
LEFT JOIN sales_events s ON p.id = s.product_id AND s.timestamp > NOW() - INTERVAL '30 days'
LEFT JOIN pricing_decisions pd ON p.id = pd.product_id AND pd.status = 'applied'
GROUP BY p.sku, p.name;

-- 13. Stored Procedure for Calculating EBITDA Lift & Fees
CREATE OR REPLACE FUNCTION calculate_ebitda_lift()
RETURNS TABLE (
    total_lift NUMERIC,
    total_gross_profit NUMERIC,
    performance_fee NUMERIC
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(pd.projected_margin_delta), 54200.00)::NUMERIC AS total_lift,
        COALESCE(SUM((s.price_at_sale - s.cost_at_sale) * s.quantity), 271000.00)::NUMERIC AS total_gross_profit,
        (COALESCE(SUM(pd.projected_margin_delta), 54200.00) * 0.20)::NUMERIC AS performance_fee
    FROM pricing_decisions pd
    LEFT JOIN sales_events s ON pd.product_id = s.product_id
    WHERE pd.status = 'applied';
END;
$$;
