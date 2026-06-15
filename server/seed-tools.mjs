/**
 * Seed supply chain tools into the agent_tools table
 * Run with: node seed-tools.mjs
 */

import mysql from 'mysql2/promise';

const SUPPLY_CHAIN_TOOLS = [
  // ============ DEMAND PLANNER TOOLS ============
  {
    tool_id: 'forecast_demand_by_sku',
    name: 'Forecast Demand by SKU',
    description: 'Predict future demand for specific SKUs using historical sales data, trends, and seasonality patterns',
    category: 'demand',
    agent_ids: JSON.stringify(['demand_planner']),
    input_schema: JSON.stringify({
      type: 'object',
      properties: {
        sku: { type: 'string', description: 'Product SKU identifier' },
        months: { type: 'number', description: 'Number of months to forecast' },
        includeSeasonality: { type: 'boolean', description: 'Include seasonal adjustments' },
        method: { type: 'string', enum: ['exponential_smoothing', 'trend_projection', 'regression'] },
      },
      required: ['sku', 'months'],
    }),
    output_schema: JSON.stringify({
      type: 'object',
      properties: {
        forecast: { type: 'array', items: { type: 'number' } },
        confidence: { type: 'number', description: 'Forecast confidence (0-1)' },
        trend: { type: 'string', enum: ['increasing', 'decreasing', 'stable'] },
        seasonality: { type: 'object' },
      },
    }),
    implementation: 'forecastDemandBySku',
    data_sources: JSON.stringify(['sales_history', 'forecast']),
    complexity: 'medium',
    is_active: 1,
    created_by: 'system',
  },
  {
    tool_id: 'identify_seasonal_patterns',
    name: 'Identify Seasonal Patterns',
    description: 'Detect seasonal demand highs and lows for products to optimize inventory planning',
    category: 'demand',
    agent_ids: JSON.stringify(['demand_planner']),
    input_schema: JSON.stringify({
      type: 'object',
      properties: {
        sku: { type: 'string' },
        years: { type: 'number', description: 'Historical years to analyze' },
      },
      required: ['sku'],
    }),
    output_schema: JSON.stringify({
      type: 'object',
      properties: {
        seasonal_factors: { type: 'array' },
        peak_months: { type: 'array' },
        low_months: { type: 'array' },
        seasonality_strength: { type: 'number' },
      },
    }),
    implementation: 'identifySeasonalPatterns',
    data_sources: JSON.stringify(['sales_history']),
    complexity: 'simple',
    is_active: 1,
    created_by: 'system',
  },
  {
    tool_id: 'analyze_demand_volatility',
    name: 'Analyze Demand Volatility',
    description: 'Assess demand variability and forecast confidence to set appropriate safety stock levels',
    category: 'demand',
    agent_ids: JSON.stringify(['demand_planner', 'supply_planner']),
    input_schema: JSON.stringify({
      type: 'object',
      properties: {
        sku: { type: 'string' },
        period_months: { type: 'number' },
      },
      required: ['sku'],
    }),
    output_schema: JSON.stringify({
      type: 'object',
      properties: {
        std_deviation: { type: 'number' },
        coefficient_of_variation: { type: 'number' },
        volatility_level: { type: 'string', enum: ['low', 'medium', 'high'] },
        recommended_safety_stock_factor: { type: 'number' },
      },
    }),
    implementation: 'analyzeDemandVolatility',
    data_sources: JSON.stringify(['sales_history']),
    complexity: 'medium',
    is_active: 1,
    created_by: 'system',
  },
  {
    tool_id: 'get_top_selling_skus',
    name: 'Get Top Selling SKUs',
    description: 'Identify best-performing products by units sold or revenue',
    category: 'demand',
    agent_ids: JSON.stringify(['demand_planner', 'ops_head']),
    input_schema: JSON.stringify({
      type: 'object',
      properties: {
        limit: { type: 'number', default: 10 },
        period: { type: 'string', enum: ['month', 'quarter', 'year'] },
        metric: { type: 'string', enum: ['units', 'revenue'] },
      },
    }),
    output_schema: JSON.stringify({
      type: 'object',
      properties: {
        skus: { type: 'array', items: { type: 'object' } },
      },
    }),
    implementation: 'getTopSellingSkus',
    data_sources: JSON.stringify(['sales_history', 'fg_master']),
    complexity: 'simple',
    is_active: 1,
    created_by: 'system',
  },
  {
    tool_id: 'calculate_safety_stock',
    name: 'Calculate Safety Stock',
    description: 'Compute optimal safety stock levels based on demand variability and service level targets',
    category: 'supply',
    agent_ids: JSON.stringify(['supply_planner']),
    input_schema: JSON.stringify({
      type: 'object',
      properties: {
        demand_mean: { type: 'number' },
        demand_std_dev: { type: 'number' },
        lead_time: { type: 'number', description: 'In days' },
        service_level: { type: 'number', description: '0-1, typically 0.95' },
      },
      required: ['demand_mean', 'demand_std_dev', 'lead_time', 'service_level'],
    }),
    output_schema: JSON.stringify({
      type: 'object',
      properties: {
        safety_stock: { type: 'number' },
        reorder_point: { type: 'number' },
        z_score: { type: 'number' },
      },
    }),
    implementation: 'calculateSafetyStock',
    data_sources: JSON.stringify(['inventory', 'sales_history']),
    complexity: 'simple',
    is_active: 1,
    created_by: 'system',
  },
  {
    tool_id: 'calculate_reorder_point',
    name: 'Calculate Reorder Point',
    description: 'Determine the inventory level that triggers a new purchase order',
    category: 'supply',
    agent_ids: JSON.stringify(['supply_planner']),
    input_schema: JSON.stringify({
      type: 'object',
      properties: {
        average_demand: { type: 'number', description: 'Units per day' },
        lead_time: { type: 'number', description: 'In days' },
        safety_stock: { type: 'number' },
      },
      required: ['average_demand', 'lead_time'],
    }),
    output_schema: JSON.stringify({
      type: 'object',
      properties: {
        reorder_point: { type: 'number' },
      },
    }),
    implementation: 'calculateReorderPoint',
    data_sources: JSON.stringify(['inventory']),
    complexity: 'simple',
    is_active: 1,
    created_by: 'system',
  },
  {
    tool_id: 'calculate_days_of_supply',
    name: 'Calculate Days of Supply',
    description: 'Compute how many days current inventory can cover demand',
    category: 'supply',
    agent_ids: JSON.stringify(['supply_planner', 'ops_head']),
    input_schema: JSON.stringify({
      type: 'object',
      properties: {
        sku: { type: 'string' },
      },
      required: ['sku'],
    }),
    output_schema: JSON.stringify({
      type: 'object',
      properties: {
        days_of_supply: { type: 'number' },
        current_inventory: { type: 'number' },
        daily_demand: { type: 'number' },
        status: { type: 'string', enum: ['critical', 'low', 'normal', 'high'] },
      },
    }),
    implementation: 'calculateDaysOfSupply',
    data_sources: JSON.stringify(['inventory', 'sales_history']),
    complexity: 'simple',
    is_active: 1,
    created_by: 'system',
  },
  {
    tool_id: 'identify_supply_gaps',
    name: 'Identify Supply Gaps',
    description: 'Find items at risk of stockout based on current inventory and demand forecast',
    category: 'supply',
    agent_ids: JSON.stringify(['supply_planner']),
    input_schema: JSON.stringify({
      type: 'object',
      properties: {
        threshold_days: { type: 'number', description: 'Alert if DOS below this', default: 7 },
      },
    }),
    output_schema: JSON.stringify({
      type: 'object',
      properties: {
        at_risk_items: { type: 'array', items: { type: 'object' } },
        total_at_risk: { type: 'number' },
      },
    }),
    implementation: 'identifySupplyGaps',
    data_sources: JSON.stringify(['inventory', 'forecast']),
    complexity: 'medium',
    is_active: 1,
    created_by: 'system',
  },
  {
    tool_id: 'get_inventory_status',
    name: 'Get Inventory Status',
    description: 'Retrieve current inventory levels, stock status, and days of supply',
    category: 'supply',
    agent_ids: JSON.stringify(['supply_planner', 'ops_head']),
    input_schema: JSON.stringify({
      type: 'object',
      properties: {
        sku: { type: 'string', description: 'Optional filter' },
        category: { type: 'string', description: 'Optional category filter' },
      },
    }),
    output_schema: JSON.stringify({
      type: 'object',
      properties: {
        inventory: { type: 'array', items: { type: 'object' } },
      },
    }),
    implementation: 'getInventoryStatus',
    data_sources: JSON.stringify(['inventory', 'fg_master']),
    complexity: 'simple',
    is_active: 1,
    created_by: 'system',
  },
  {
    tool_id: 'calculate_material_requirements',
    name: 'Calculate Material Requirements',
    description: 'Compute raw materials needed based on production plan and bill of materials',
    category: 'production',
    agent_ids: JSON.stringify(['production_planner']),
    input_schema: JSON.stringify({
      type: 'object',
      properties: {
        production_plan: { type: 'array', items: { type: 'object' } },
        include_scrap: { type: 'boolean', default: true },
      },
      required: ['production_plan'],
    }),
    output_schema: JSON.stringify({
      type: 'object',
      properties: {
        materials: { type: 'array', items: { type: 'object' } },
        total_cost: { type: 'number' },
        lead_time_critical: { type: 'array' },
      },
    }),
    implementation: 'calculateMaterialRequirements',
    data_sources: JSON.stringify(['bom', 'rm_master']),
    complexity: 'complex',
    is_active: 1,
    created_by: 'system',
  },
  {
    tool_id: 'check_capacity_constraints',
    name: 'Check Capacity Constraints',
    description: 'Identify production bottlenecks and capacity constraints',
    category: 'production',
    agent_ids: JSON.stringify(['production_planner']),
    input_schema: JSON.stringify({
      type: 'object',
      properties: {
        production_plan: { type: 'array' },
        plant_id: { type: 'string', description: 'Optional plant filter' },
      },
      required: ['production_plan'],
    }),
    output_schema: JSON.stringify({
      type: 'object',
      properties: {
        bottlenecks: { type: 'array' },
        utilization_rate: { type: 'number' },
        capacity_gaps: { type: 'array' },
      },
    }),
    implementation: 'checkCapacityConstraints',
    data_sources: JSON.stringify(['bom', 'fg_master']),
    complexity: 'medium',
    is_active: 1,
    created_by: 'system',
  },
  {
    tool_id: 'validate_production_schedule',
    name: 'Validate Production Schedule',
    description: 'Check if production plan fits within capacity and material availability',
    category: 'production',
    agent_ids: JSON.stringify(['production_planner']),
    input_schema: JSON.stringify({
      type: 'object',
      properties: {
        production_plan: { type: 'array' },
      },
      required: ['production_plan'],
    }),
    output_schema: JSON.stringify({
      type: 'object',
      properties: {
        is_feasible: { type: 'boolean' },
        issues: { type: 'array' },
        recommendations: { type: 'array' },
      },
    }),
    implementation: 'validateProductionSchedule',
    data_sources: JSON.stringify(['bom', 'inventory', 'fg_master']),
    complexity: 'complex',
    is_active: 1,
    created_by: 'system',
  },
  {
    tool_id: 'create_purchase_order',
    name: 'Create Purchase Order',
    description: 'Generate purchase orders for materials with optimal quantities and timing',
    category: 'procurement',
    agent_ids: JSON.stringify(['procurement_planner']),
    input_schema: JSON.stringify({
      type: 'object',
      properties: {
        material_id: { type: 'string' },
        quantity: { type: 'number' },
        supplier_id: { type: 'string', description: 'Optional preferred supplier' },
      },
      required: ['material_id', 'quantity'],
    }),
    output_schema: JSON.stringify({
      type: 'object',
      properties: {
        po_number: { type: 'string' },
        supplier: { type: 'object' },
        cost: { type: 'number' },
        eta: { type: 'string' },
      },
    }),
    implementation: 'createPurchaseOrder',
    data_sources: JSON.stringify(['rm_master', 'suppliers', 'po_data']),
    complexity: 'medium',
    is_active: 1,
    created_by: 'system',
  },
  {
    tool_id: 'evaluate_supplier_performance',
    name: 'Evaluate Supplier Performance',
    description: 'Score suppliers based on delivery, quality, and cost metrics',
    category: 'procurement',
    agent_ids: JSON.stringify(['procurement_planner']),
    input_schema: JSON.stringify({
      type: 'object',
      properties: {
        supplier_id: { type: 'string' },
        period: { type: 'string', enum: ['month', 'quarter', 'year'] },
      },
      required: ['supplier_id'],
    }),
    output_schema: JSON.stringify({
      type: 'object',
      properties: {
        score: { type: 'number', description: '0-100' },
        rating: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor'] },
        on_time_delivery: { type: 'number' },
        quality_score: { type: 'number' },
        cost_competitiveness: { type: 'number' },
        recommendations: { type: 'array' },
      },
    }),
    implementation: 'evaluateSupplierPerformance',
    data_sources: JSON.stringify(['po_data', 'suppliers']),
    complexity: 'medium',
    is_active: 1,
    created_by: 'system',
  },
  {
    tool_id: 'find_alternative_suppliers',
    name: 'Find Alternative Suppliers',
    description: 'Identify backup suppliers for critical materials',
    category: 'procurement',
    agent_ids: JSON.stringify(['procurement_planner']),
    input_schema: JSON.stringify({
      type: 'object',
      properties: {
        material_id: { type: 'string' },
        exclude_current: { type: 'boolean', default: true },
      },
      required: ['material_id'],
    }),
    output_schema: JSON.stringify({
      type: 'object',
      properties: {
        suppliers: { type: 'array', items: { type: 'object' } },
      },
    }),
    implementation: 'findAlternativeSuppliers',
    data_sources: JSON.stringify(['suppliers', 'rm_master']),
    complexity: 'simple',
    is_active: 1,
    created_by: 'system',
  },
  {
    tool_id: 'get_consolidated_kpis',
    name: 'Get Consolidated KPIs',
    description: 'Fetch all KPIs across demand, supply, production, and procurement',
    category: 'operations',
    agent_ids: JSON.stringify(['ops_head']),
    input_schema: JSON.stringify({
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['day', 'week', 'month', 'quarter', 'year'] },
        departments: { type: 'array', items: { type: 'string' } },
      },
    }),
    output_schema: JSON.stringify({
      type: 'object',
      properties: {
        kpis: { type: 'object' },
        trends: { type: 'array' },
        alerts: { type: 'array' },
      },
    }),
    implementation: 'getConsolidatedKpis',
    data_sources: JSON.stringify(['sales_history', 'inventory', 'forecast', 'po_data']),
    complexity: 'complex',
    is_active: 1,
    created_by: 'system',
  },
  {
    tool_id: 'identify_critical_issues',
    name: 'Identify Critical Issues',
    description: 'Flag items needing executive attention across supply chain',
    category: 'operations',
    agent_ids: JSON.stringify(['ops_head']),
    input_schema: JSON.stringify({
      type: 'object',
      properties: {
        severity: { type: 'string', enum: ['critical', 'high', 'medium'] },
      },
    }),
    output_schema: JSON.stringify({
      type: 'object',
      properties: {
        issues: { type: 'array', items: { type: 'object' } },
        impact: { type: 'string' },
      },
    }),
    implementation: 'identifyCriticalIssues',
    data_sources: JSON.stringify(['inventory', 'forecast', 'po_data', 'sales_history']),
    complexity: 'complex',
    is_active: 1,
    created_by: 'system',
  },
];

async function seedTools() {
  let connection;
  try {
    connection = await mysql.createConnection(process.env.DATABASE_URL);

    for (const tool of SUPPLY_CHAIN_TOOLS) {
      const query = `
        INSERT IGNORE INTO agent_tools (
          tool_id, name, description, category, agent_ids, input_schema, output_schema,
          implementation, data_sources, complexity, is_active, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await connection.execute(query, [
        tool.tool_id,
        tool.name,
        tool.description,
        tool.category,
        tool.agent_ids,
        tool.input_schema,
        tool.output_schema,
        tool.implementation,
        tool.data_sources,
        tool.complexity,
        tool.is_active,
        tool.created_by,
      ]);
    }

    console.log(`✅ Seeded ${SUPPLY_CHAIN_TOOLS.length} tools successfully`);
    await connection.end();
  } catch (error) {
    console.error('Error seeding tools:', error);
    process.exit(1);
  }
}

seedTools();
