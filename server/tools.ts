import { getDb, getInventoryList } from "./db";

export async function runForecast(skuId: string, model: string = "auto", horizonWeeks: number = 13) {
  return {
    sku: skuId,
    model_used: model,
    forecast_units: 5000 * horizonWeeks,
    forecast_revenue: 50000 * horizonWeeks,
    confidence: 0.85,
    mape: 12.5,
    bias: 2.1,
  };
}

export async function calculateDos(skuId: string, location?: string) {
  const inventory = await getInventoryList();
  const filtered = inventory.filter((i) => i.itemId === skuId);

  if (filtered.length === 0) {
    return { error: "No inventory found", sku: skuId };
  }

  const totalQty = filtered.reduce((sum, i) => sum + (i.qtyOnHand || 0), 0);
  const avgDailyDemand = 10;
  const dos = totalQty / avgDailyDemand;

  return {
    sku: skuId,
    location,
    total_qty: totalQty,
    dos_days: dos,
    status: dos < 20 ? "low" : dos < 30 ? "normal" : "high",
  };
}

export async function runSupplyPlan(demandPlanId: string, constrained: boolean = false) {
  return {
    plan_id: `supply_${demandPlanId}`,
    type: constrained ? "constrained" : "unconstrained",
    status: "draft",
    total_supply_units: 50000,
    total_demand_units: 48000,
    gap_units: constrained ? 2000 : 0,
    gap_percent: constrained ? 4.2 : 0,
  };
}

export async function gapAnalysis(supplyPlanId: string, demandPlanId: string) {
  return {
    supply_plan_id: supplyPlanId,
    demand_plan_id: demandPlanId,
    total_gap_units: 1500,
    critical_skus: ["SKU-001", "SKU-002"],
    gap_by_period: [
      { period: "W1", gap: 300 },
      { period: "W2", gap: 500 },
      { period: "W3", gap: 700 },
    ],
  };
}

export async function buildSchedule(supplyPlanId: string, lineCapacities: Record<string, number>) {
  return {
    schedule_id: `sched_${supplyPlanId}`,
    supply_plan_id: supplyPlanId,
    status: "draft",
    total_lines: Object.keys(lineCapacities).length,
    utilization_percent: 78.5,
    changeovers: 12,
  };
}

export async function runMrp(productionScheduleId: string) {
  return {
    mrp_id: `mrp_${productionScheduleId}`,
    production_schedule_id: productionScheduleId,
    total_materials: 45,
    materials_at_risk: 3,
    coverage_weeks: 4.2,
  };
}

export const TOOL_REGISTRY: Record<string, Function> = {
  run_forecast: runForecast,
  calculate_dos: calculateDos,
  run_supply_plan: runSupplyPlan,
  gap_analysis: gapAnalysis,
  build_schedule: buildSchedule,
  run_mrp: runMrp,
};

export async function executeTool(toolId: string, params: Record<string, unknown>) {
  const tool = TOOL_REGISTRY[toolId];
  if (!tool) {
    return { error: `Tool ${toolId} not found` };
  }

  try {
    const result = await tool(...Object.values(params));
    return result;
  } catch (error) {
    return { error: `Tool execution failed: ${error}` };
  }
}
