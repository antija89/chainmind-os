import { decimal, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar, float, date, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "ops_head", "planner"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============ DATA LAKE TABLES ============

export const fgMaster = mysqlTable("fg_master", {
  skuId: varchar("sku_id", { length: 64 }).primaryKey(),
  description: text("description"),
  division: varchar("division", { length: 128 }),
  category: varchar("category", { length: 128 }),
  subcategory: varchar("subcategory", { length: 128 }),
  packFormat: varchar("pack_format", { length: 128 }),
  packSize: float("pack_size"),
  brand: varchar("brand", { length: 128 }),
  primaryPlant: varchar("primary_plant", { length: 128 }),
  primaryLine: varchar("primary_line", { length: 128 }),
  primaryChannel: varchar("primary_channel", { length: 128 }),
  launchDate: date("launch_date"),
  active: boolean("active").default(true),
  packPriceAed: decimal("pack_price_aed", { precision: 12, scale: 2 }),
  baseMonthlyDemand: float("base_monthly_demand"),
  uom: varchar("uom", { length: 32 }),
  shelfLifeDays: int("shelf_life_days"),
  targetServiceLevel: float("target_service_level"),
  netWeightKg: float("net_weight_kg"),
  casePack: int("case_pack"),
  skuStatus: varchar("sku_status", { length: 64 }),
  lifecycleStage: varchar("lifecycle_stage", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type FgMaster = typeof fgMaster.$inferSelect;
export type InsertFgMaster = typeof fgMaster.$inferInsert;

export const rmMaster = mysqlTable("rm_master", {
  materialId: varchar("material_id", { length: 64 }).primaryKey(),
  description: text("description"),
  category: varchar("category", { length: 128 }),
  rmType: varchar("rm_type", { length: 128 }),
  function: varchar("function", { length: 128 }),
  uom: varchar("uom", { length: 32 }),
  stdCostAed: decimal("std_cost_aed", { precision: 12, scale: 2 }),
  leadTimeDays: int("lead_time_days"),
  supplierId: varchar("supplier_id", { length: 64 }),
  supplierName: varchar("supplier_name", { length: 256 }),
  country: varchar("country", { length: 64 }),
  moq: float("moq"),
  shelfLifeDays: int("shelf_life_days"),
  specification: text("specification"),
  qualityStatus: varchar("quality_status", { length: 64 }),
  sustainabilityFlag: boolean("sustainability_flag"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type RmMaster = typeof rmMaster.$inferSelect;
export type InsertRmMaster = typeof rmMaster.$inferInsert;

export const bom = mysqlTable("bom", {
  bomId: varchar("bom_id", { length: 64 }).primaryKey(),
  fgCode: varchar("fg_code", { length: 64 }),
  fgDescription: text("fg_description"),
  componentType: varchar("component_type", { length: 64 }),
  componentCode: varchar("component_code", { length: 64 }),
  componentDescription: text("component_description"),
  qtyPerFg: float("qty_per_fg"),
  uom: varchar("uom", { length: 32 }),
  scrapPercent: float("scrap_percent"),
  stdCostAed: decimal("std_cost_aed", { precision: 12, scale: 2 }),
  extendedCostAed: decimal("extended_cost_aed", { precision: 12, scale: 2 }),
  supplier: varchar("supplier", { length: 256 }),
  leadTimeDays: int("lead_time_days"),
  materialClass: varchar("material_class", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type Bom = typeof bom.$inferSelect;
export type InsertBom = typeof bom.$inferInsert;

export const inventory = mysqlTable("inventory", {
  inventoryId: varchar("inventory_id", { length: 64 }).primaryKey(),
  itemId: varchar("item_id", { length: 64 }),
  itemType: varchar("item_type", { length: 32 }),
  location: varchar("location", { length: 128 }),
  batchNo: varchar("batch_no", { length: 128 }),
  mfgDate: date("mfg_date"),
  expiryDate: date("expiry_date"),
  ageDays: int("age_days"),
  qtyOnHand: float("qty_on_hand"),
  allocated: float("allocated"),
  available: float("available"),
  holdQty: float("hold_qty"),
  unitCostAed: decimal("unit_cost_aed", { precision: 12, scale: 2 }),
  inventoryValueAed: decimal("inventory_value_aed", { precision: 12, scale: 2 }),
  stockStatus: varchar("stock_status", { length: 64 }),
  qcStatus: varchar("qc_status", { length: 64 }),
  shelfLifeDays: int("shelf_life_days"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = typeof inventory.$inferInsert;

export const salesHistory = mysqlTable("sales_history", {
  historyId: varchar("history_id", { length: 64 }).primaryKey(),
  month: varchar("month", { length: 32 }),
  fgCode: varchar("fg_code", { length: 64 }),
  fgDescription: text("fg_description"),
  division: varchar("division", { length: 128 }),
  country: varchar("country", { length: 64 }),
  channel: varchar("channel", { length: 128 }),
  unitsSold: float("units_sold"),
  grossSalesAed: decimal("gross_sales_aed", { precision: 12, scale: 2 }),
  promoDiscountPercent: float("promo_discount_percent"),
  netAspAed: decimal("net_asp_aed", { precision: 12, scale: 2 }),
  netSalesAed: decimal("net_sales_aed", { precision: 12, scale: 2 }),
  returnsUnits: float("returns_units"),
  fillRatePercent: float("fill_rate_percent"),
  tradeSpendAed: decimal("trade_spend_aed", { precision: 12, scale: 2 }),
  sellThroughPercent: float("sell_through_percent"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type SalesHistory = typeof salesHistory.$inferSelect;
export type InsertSalesHistory = typeof salesHistory.$inferInsert;

export const forecast = mysqlTable("forecast", {
  forecastId: varchar("forecast_id", { length: 64 }).primaryKey(),
  month: varchar("month", { length: 32 }),
  fgCode: varchar("fg_code", { length: 64 }),
  fgDescription: text("fg_description"),
  division: varchar("division", { length: 128 }),
  country: varchar("country", { length: 64 }),
  channel: varchar("channel", { length: 128 }),
  forecastUnits: float("forecast_units"),
  forecastAspAed: decimal("forecast_asp_aed", { precision: 12, scale: 2 }),
  forecastRevenueAed: decimal("forecast_revenue_aed", { precision: 12, scale: 2 }),
  seasonalityIndex: float("seasonality_index"),
  promoUpliftPercent: float("promo_uplift_percent"),
  forecastMethod: varchar("forecast_method", { length: 64 }),
  confidencePercent: float("confidence_percent"),
  baseTrendUnits: float("base_trend_units"),
  plannedPromo: text("planned_promo"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type Forecast = typeof forecast.$inferSelect;
export type InsertForecast = typeof forecast.$inferInsert;

export const poData = mysqlTable("po_data", {
  poNo: varchar("po_no", { length: 64 }).primaryKey(),
  itemCode: varchar("item_code", { length: 64 }),
  itemType: varchar("item_type", { length: 32 }),
  description: text("description"),
  supplierCode: varchar("supplier_code", { length: 64 }),
  supplierName: varchar("supplier_name", { length: 256 }),
  supplierCountry: varchar("supplier_country", { length: 64 }),
  plant: varchar("plant", { length: 128 }),
  poDate: date("po_date"),
  requestedDate: date("requested_date"),
  confirmedEta: date("confirmed_eta"),
  qtyOrdered: float("qty_ordered"),
  qtyReceived: float("qty_received"),
  openQty: float("open_qty"),
  unitCostAed: decimal("unit_cost_aed", { precision: 12, scale: 2 }),
  poValueAed: decimal("po_value_aed", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 32 }),
  incoterms: varchar("incoterms", { length: 32 }),
  status: varchar("status", { length: 64 }),
  priority: varchar("priority", { length: 64 }),
  batchNo: varchar("batch_no", { length: 128 }),
  paymentTerms: varchar("payment_terms", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type PoData = typeof poData.$inferSelect;
export type InsertPoData = typeof poData.$inferInsert;

export const suppliers = mysqlTable("suppliers", {
  supplierCode: varchar("supplier_code", { length: 64 }).primaryKey(),
  supplierName: varchar("supplier_name", { length: 256 }),
  category: varchar("category", { length: 128 }),
  country: varchar("country", { length: 64 }),
  paymentTerms: varchar("payment_terms", { length: 128 }),
  leadTimeDays: int("lead_time_days"),
  approved: boolean("approved"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type Suppliers = typeof suppliers.$inferSelect;
export type InsertSuppliers = typeof suppliers.$inferInsert;

// ============ AGENT & WORKFLOW TABLES ============

export const agents = mysqlTable("agents", {
  agentId: varchar("agent_id", { length: 64 }).primaryKey(),
  roleTitle: varchar("role_title", { length: 128 }),
  shortCode: varchar("short_code", { length: 16 }),
  domain: text("domain"),
  seniority: varchar("seniority", { length: 64 }),
  tone: varchar("tone", { length: 256 }),
  icon: varchar("icon", { length: 32 }),
  color: varchar("color", { length: 32 }),
  instructionStack: json("instruction_stack"),
  kpiTargets: json("kpi_targets"),
  status: varchar("status", { length: 32 }).default("active"),
  reportsTo: varchar("reports_to", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type Agents = typeof agents.$inferSelect;
export type InsertAgents = typeof agents.$inferInsert;

export const tools = mysqlTable("tools", {
  toolId: varchar("tool_id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 256 }),
  description: text("description"),
  category: varchar("category", { length: 128 }),
  ownerAgent: varchar("owner_agent", { length: 64 }),
  callableBy: json("callable_by"),
  parameters: json("parameters"),
  returns: json("returns"),
  implementation: text("implementation"),
  status: varchar("status", { length: 32 }).default("active"),
  usageCount: int("usage_count").default(0),
  avgAccuracy: float("avg_accuracy"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type Tools = typeof tools.$inferSelect;
export type InsertTools = typeof tools.$inferInsert;

export const planStore = mysqlTable("plan_store", {
  planId: varchar("plan_id", { length: 64 }).primaryKey(),
  version: int("version").default(1),
  type: varchar("type", { length: 64 }),
  agentId: varchar("agent_id", { length: 64 }),
  dataPayload: json("data_payload"),
  status: varchar("status", { length: 32 }).default("draft"),
  approvedBy: varchar("approved_by", { length: 64 }),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export type PlanStore = typeof planStore.$inferSelect;
export type InsertPlanStore = typeof planStore.$inferInsert;

export const hilGates = mysqlTable("hil_gates", {
  gateId: varchar("gate_id", { length: 64 }).primaryKey(),
  triggerType: varchar("trigger_type", { length: 128 }),
  agentId: varchar("agent_id", { length: 64 }),
  payload: json("payload"),
  status: varchar("status", { length: 32 }).default("pending"),
  priority: varchar("priority", { length: 32 }).default("normal"),
  resolvedBy: varchar("resolved_by", { length: 64 }),
  resolution: varchar("resolution", { length: 32 }),
  reason: text("reason"),
  createdAt: timestamp("createdAt").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export type HilGates = typeof hilGates.$inferSelect;
export type InsertHilGates = typeof hilGates.$inferInsert;

export const auditLog = mysqlTable("audit_log", {
  logId: varchar("log_id", { length: 64 }).primaryKey(),
  timestamp: timestamp("timestamp").defaultNow(),
  actorId: varchar("actor_id", { length: 64 }),
  actorType: varchar("actor_type", { length: 32 }),
  action: varchar("action", { length: 128 }),
  resourceType: varchar("resource_type", { length: 64 }),
  resourceId: varchar("resource_id", { length: 64 }),
  reason: text("reason"),
  impact: json("impact"),
  metadata: json("metadata"),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = typeof auditLog.$inferInsert;

export const agentMessages = mysqlTable("agent_messages", {
  messageId: varchar("message_id", { length: 64 }).primaryKey(),
  agentId: varchar("agent_id", { length: 64 }),
  userId: int("user_id"),
  role: varchar("role", { length: 32 }),
  content: text("content"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});

export type AgentMessages = typeof agentMessages.$inferSelect;
export type InsertAgentMessages = typeof agentMessages.$inferInsert;