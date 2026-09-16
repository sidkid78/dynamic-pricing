/**
 * Enterprise Dynamic Pricing System
 * Database Type Definitions
 */

export type DecisionStatus = 'proposed' | 'applied' | 'rejected' | 'overridden';
export type PricingPolicyStatus = 'APPROVED' | 'REJECTED' | 'OVERRIDDEN_BY_SYSTEM';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string | null;
  base_cost: number;
  current_price: number;
  created_at?: string;
  updated_at?: string;
}

export interface Inventory {
  id: string;
  product_id: string;
  warehouse_id: string;
  quantity_on_hand: number;
  expiry_date?: string | null;
  lead_time_days: number;
  last_replenished_at?: string | null;
  updated_at?: string;
}

export interface CompetitorPrice {
  id: string;
  product_id: string;
  competitor_name: string;
  observed_price: number;
  is_available: boolean;
  observed_at: string;
}

export interface PricingGuardrail {
  id: string;
  product_id: string;
  min_margin_pct: number;
  max_price_volatility_pct: number;
  map_price?: number | null;
  is_active: boolean;
  updated_at?: string;
}

export interface StateSnapshot {
  inventory: number;
  lead_time_days?: number;
  comp_avg: number;
  velocity: number;
  sentiment_score?: number;
  timestamp?: string;
}

export interface RewardMetrics {
  projected_margin: number;
  churn_risk: number;
  alpha?: number;
  beta?: number;
  cumulative_reward?: number;
}

export interface PricingDecision {
  id: string;
  product_id: string;
  suggested_price: number;
  previous_price: number;
  projected_margin_delta?: number | null;
  projected_volume_impact?: number | null;
  agent_reasoning?: string | null;
  state_snapshot?: StateSnapshot | Record<string, unknown> | null;
  reward_metrics?: RewardMetrics | Record<string, unknown> | null;
  status: DecisionStatus;
  applied_at?: string | null;
  created_at: string;
}

export interface SalesEvent {
  id: string;
  product_id: string;
  quantity: number;
  price_at_sale: number;
  cost_at_sale: number;
  customer_segment?: string | null;
  timestamp: string;
}

export interface ViolationDetails {
  rules: string[];
  semantic_alert?: string;
  detected_at?: string;
}

export interface PricingPolicyLog {
  id: string;
  sku_id: string;
  base_price: number;
  proposed_price: number;
  price_delta_percent: number;
  status: PricingPolicyStatus;
  violation_details?: ViolationDetails | Record<string, unknown> | null;
  market_context?: string | null;
  created_at: string;
}

export interface VendorContract {
  id: string;
  sku_id: string;
  vendor_name: string;
  map_price: number;
  promotion_active: boolean;
  promotion_notes?: string | null;
  effective_from: string;
  effective_to?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MarketIntel {
  id: string;
  sku_id: string;
  competitor_avg_price: number;
  sales_velocity_7d: number;
  sentiment_score?: number | null;
  updated_at: string;
}

export interface SkuPricingState {
  id: string;
  sku_id: string;
  competitor_avg: number;
  sales_velocity: number;
  last_action: number;
  active_guardrail: string;
  updated_at: string;
}

export interface PricingPerformanceMetrics {
  id: string;
  ebitda_lift: number;
  total_margin_lift: number;
  volume_increase: number;
  churn_impact: number;
  calculated_at: string;
}

export interface EbitdaLiftSummaryView {
  sku: string;
  name: string;
  realized_gross_profit: number;
  transaction_volume: number;
  avg_suggested_lift: number;
}

export interface CalculatedEbitdaLift {
  total_lift: number;
  total_gross_profit: number;
  performance_fee: number;
}
