# Supply Chain Tools Framework for ChainMind OS

## Core Supply Chain Planning Concepts

### 1. Demand Planning (Demand Planner Agent)
**Purpose**: Forecast future demand for products based on historical data, market trends, and seasonality.

**Key Techniques**:
- Quantitative: Trend projection, exponential smoothing, regression analysis, econometric forecasting
- Qualitative: Sales force composite, market research, Delphi method (expert consensus)
- Hybrid: Combine quantitative and qualitative for high uncertainty

**Key Tools Needed**:
- `forecast_demand_by_sku` — Predict future demand for specific SKUs using historical sales data
- `identify_seasonal_patterns` — Detect seasonal demand highs/lows
- `analyze_demand_volatility` — Assess demand variability and forecast confidence
- `compare_forecast_accuracy` — Measure forecast accuracy vs actual sales
- `identify_demand_drivers` — Find external factors influencing demand (economic, market trends)

---

### 2. Material Requirements Planning (MRP) (Production Planner Agent)
**Purpose**: Calculate material acquisition plans needed to meet production plans and customer demand.

**Key Process**:
1. Define what needs to be produced (Bill of Materials - BOM)
2. Quantify demand (Master Production Schedule - MPS)
3. Determine supply (Calculate net shortages, lot sizing, lead times)

**Key Tools Needed**:
- `calculate_material_requirements` — Compute raw materials needed based on production plan and BOM
- `check_inventory_availability` — Verify if materials are in stock
- `calculate_net_shortage` — Identify material gaps
- `determine_lot_sizing` — Calculate optimal purchase/production quantities
- `calculate_lead_times` — Compute required procurement dates based on supplier lead times

---

### 3. Capacity Planning (Production Planner Agent)
**Purpose**: Ensure production capacity can meet demand; identify and manage bottlenecks.

**Two Models**:
- **Infinite Capacity**: Assumes unlimited capacity (suitable for high-capacity environments)
- **Finite Capacity**: Accounts for production constraints (more realistic for constrained plants)

**Key Tools Needed**:
- `calculate_production_capacity` — Compute available production capacity per period
- `check_capacity_constraints` — Identify bottlenecks and constraints
- `validate_production_schedule` — Check if production plan fits within capacity
- `identify_capacity_gaps` — Find periods where demand exceeds capacity
- `suggest_capacity_solutions` — Recommend overtime, outsourcing, or schedule shifts

---

### 4. Supply Planning (Supply Planner Agent)
**Purpose**: Optimize inventory levels, manage supply balance, prevent stockouts.

**Key Concepts**:
- Safety stock: Buffer inventory to protect against demand/supply variability
- Reorder point: Inventory level triggering new purchase orders
- Days of supply (DOS): How many days current inventory can cover demand
- Service level: % of demand met from stock (target: 95%+)

**Key Tools Needed**:
- `calculate_safety_stock` — Compute buffer inventory needed
- `calculate_reorder_point` — Determine when to trigger new POs
- `calculate_days_of_supply` — Compute DOS for each SKU
- `identify_supply_gaps` — Find items at risk of stockout
- `optimize_inventory_levels` — Balance holding costs vs service level

---

### 5. Procurement Planning (Procurement Planner Agent)
**Purpose**: Manage purchase orders, supplier relationships, procurement costs.

**Key Activities**:
- Supplier selection and evaluation
- Purchase order creation and tracking
- Supplier performance monitoring
- Cost optimization

**Key Tools Needed**:
- `create_purchase_order` — Generate PO for materials
- `evaluate_supplier_performance` — Score suppliers on delivery, quality, cost
- `find_alternative_suppliers` — Identify backup suppliers
- `calculate_procurement_cost` — Compute total cost of ownership
- `track_open_po_status` — Monitor PO fulfillment and ETAs

---

### 6. Operations Oversight (Ops Head Agent)
**Purpose**: Oversee end-to-end supply chain, manage KPIs, drive operational excellence.

**Key Responsibilities**:
- Monitor all KPIs across demand, supply, production, procurement
- Identify cross-functional issues and escalations
- Drive S&OP (Sales & Operations Planning) process
- Make strategic decisions

**Key Tools Needed**:
- `get_consolidated_kpis` — Fetch all KPIs: service level, forecast accuracy, inventory DOS, open POs
- `identify_critical_issues` — Flag items needing executive attention
- `generate_sop_report` — Create S&OP summary for decision-making
- `compare_plan_vs_actual` — Analyze performance against plan
- `recommend_actions` — Suggest strategic actions based on data

---

## Tool Architecture

### Tool Definition Schema
Each tool must have:
```json
{
  "toolId": "unique_identifier",
  "name": "Human-readable name",
  "description": "What the tool does and when to use it",
  "category": "demand|supply|production|procurement|operations",
  "agentIds": ["demand_planner", "supply_planner", ...],
  "inputSchema": {
    "type": "object",
    "properties": {...},
    "required": [...]
  },
  "outputSchema": {
    "type": "object",
    "properties": {...}
  },
  "implementation": "server_function_name",
  "dataSource": ["table1", "table2", ...],
  "complexity": "simple|medium|complex"
}
```

### Tool Execution Flow
1. **LLM receives tool definitions** — Agent gets list of available tools with descriptions
2. **LLM decides which tool to use** — Based on user query and context
3. **LLM calls tool with parameters** — Sends tool name + input parameters
4. **Server executes tool** — Runs deterministic function, queries database
5. **Result returned to LLM** — Tool output fed back to agent
6. **LLM generates response** — Uses tool result to answer user query

---

## Initial Tool Set by Agent

### Demand Planner Tools
1. `forecast_demand_by_sku` — Predict future demand
2. `identify_seasonal_patterns` — Detect seasonal trends
3. `analyze_demand_volatility` — Assess forecast confidence
4. `compare_forecast_accuracy` — Measure forecast performance
5. `get_top_selling_skus` — Identify best-performing products

### Supply Planner Tools
1. `calculate_safety_stock` — Compute buffer inventory
2. `calculate_reorder_point` — Determine reorder triggers
3. `calculate_days_of_supply` — Compute DOS
4. `identify_supply_gaps` — Find stockout risks
5. `get_inventory_status` — Current inventory levels

### Production Planner Tools
1. `calculate_material_requirements` — Compute BOM requirements
2. `calculate_production_capacity` — Available capacity
3. `check_capacity_constraints` — Identify bottlenecks
4. `validate_production_schedule` — Check feasibility
5. `get_forecast_summary` — Demand forecast data

### Procurement Planner Tools
1. `create_purchase_order` — Generate POs
2. `evaluate_supplier_performance` — Score suppliers
3. `find_alternative_suppliers` — Backup suppliers
4. `calculate_procurement_cost` — Total cost analysis
5. `get_open_po_summary` — Track PO status

### Ops Head Tools (All of above + strategic)
1. `get_consolidated_kpis` — All KPIs dashboard
2. `identify_critical_issues` — Escalation flags
3. `generate_sop_report` — S&OP summary
4. `compare_plan_vs_actual` — Performance analysis
5. `recommend_actions` — Strategic recommendations

---

## Database Tables Supporting Tools

- `fg_master` — Finished goods catalog
- `rm_master` — Raw materials catalog
- `bom` — Bill of materials (product structure)
- `inventory` — Current stock levels
- `sales_history` — Historical sales data
- `forecast` — Demand forecasts
- `po_data` — Purchase orders
- `suppliers` — Supplier master data
- `agent_tools` — Tool registry (NEW)
- `tool_execution_log` — Tool call history (NEW)

---

## Next Steps

1. Create `agent_tools` table to store tool definitions
2. Create `tool_execution_log` table to track tool calls
3. Build Tool Registry UI page
4. Build Tool Creation Agent
5. Implement tool execution dispatcher
6. Add supply chain-specific tools for each agent
7. Test LLM tool-calling flow
