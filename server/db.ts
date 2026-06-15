import { eq, desc, sql, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, agents, planStore, hilGates,
  fgMaster, rmMaster, bom, inventory, salesHistory, forecast,
  poData, suppliers, auditLog, agentMessages,
  InsertHilGates, InsertAuditLog, InsertPlanStore, InsertAgentMessages
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { nanoid } from 'nanoid';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USER QUERIES ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ AGENT QUERIES ============

export async function getAgentsList() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agents).orderBy(agents.agentId);
}

export async function getAgentById(agentId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(agents).where(eq(agents.agentId, agentId)).limit(1);
  return result[0];
}

export async function updateAgentInstructions(agentId: string, instructionStack: unknown) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(agents).set({ instructionStack, updatedAt: new Date() }).where(eq(agents.agentId, agentId));
  return { success: true };
}

// ============ PLAN STORE QUERIES ============

export async function getPlansList(type?: string) {
  const db = await getDb();
  if (!db) return [];
  if (type) return db.select().from(planStore).where(eq(planStore.type, type)).orderBy(desc(planStore.createdAt));
  return db.select().from(planStore).orderBy(desc(planStore.createdAt));
}

export async function getPlanById(planId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(planStore).where(eq(planStore.planId, planId)).limit(1);
  return result[0];
}

export async function createPlan(data: InsertPlanStore) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const planId = data.planId || `plan-${nanoid(10)}`;
  await db.insert(planStore).values({ ...data, planId });
  return { planId };
}

export async function updatePlanStatus(planId: string, status: string, approvedBy?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateData: Record<string, unknown> = { status, updatedAt: new Date() };
  if (approvedBy) { updateData.approvedBy = approvedBy; updateData.approvedAt = new Date(); }
  await db.update(planStore).set(updateData).where(eq(planStore.planId, planId));
  return { success: true };
}

// ============ HIL GATE QUERIES ============

export async function getHilGatesPending(status?: string) {
  const db = await getDb();
  if (!db) return [];
  const filterStatus = status || 'pending';
  return db.select().from(hilGates).where(eq(hilGates.status, filterStatus)).orderBy(desc(hilGates.createdAt));
}

export async function getHilGateById(gateId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(hilGates).where(eq(hilGates.gateId, gateId)).limit(1);
  return result[0];
}

export async function createHilGate(data: Omit<InsertHilGates, 'gateId'>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const gateId = `hil-${nanoid(10)}`;
  await db.insert(hilGates).values({ ...data, gateId });
  return { gateId };
}

export async function resolveHilGate(gateId: string, resolution: string, reason: string, resolvedBy: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(hilGates).set({
    status: 'resolved',
    resolution,
    reason,
    resolvedBy,
    resolvedAt: new Date(),
  }).where(eq(hilGates.gateId, gateId));
  return { success: true };
}

// ============ AUDIT LOG QUERIES ============

export async function writeAuditLog(entry: {
  actorId: string;
  actorName?: string;
  actorType: 'human' | 'agent' | 'system';
  action: string;
  entityType?: string;
  entityId?: string;
  description?: string;
  reason?: string;
  impact?: unknown;
  metadata?: unknown;
  // legacy fields
  resourceType?: string;
  resourceId?: string;
}) {
  const db = await getDb();
  if (!db) { console.warn("[AuditLog] DB not available, skipping log"); return; }
  const logId = `log-${nanoid(12)}`;
  await db.insert(auditLog).values({
    logId,
    actorId: entry.actorId,
    actorName: entry.actorName || null,
    actorType: entry.actorType,
    action: entry.action,
    entityType: entry.entityType || entry.resourceType || null,
    entityId: entry.entityId || entry.resourceId || null,
    description: entry.description || null,
    reason: entry.reason || null,
    impact: entry.impact || null,
    metadata: entry.metadata || null,
    resourceType: entry.resourceType || null,
    resourceId: entry.resourceId || null,
  });
  return { logId };
}

export async function getAuditLogs(opts?: { search?: string; actorType?: string; offset?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const limit = opts?.limit || 50;
  const offset = opts?.offset || 0;
  let q = db.select().from(auditLog).$dynamic();
  if (opts?.search) {
    q = q.where(sql`(${auditLog.action} LIKE ${`%${opts.search}%`} OR ${auditLog.actorName} LIKE ${`%${opts.search}%`} OR ${auditLog.description} LIKE ${`%${opts.search}%`})`);
  } else if (opts?.actorType) {
    q = q.where(eq(auditLog.actorType, opts.actorType));
  }
  return q.orderBy(desc(auditLog.createdAt)).limit(limit).offset(offset);
}

// ============ DATA LAKE QUERIES ============

export async function getFgMasterList(search?: string) {
  const db = await getDb();
  if (!db) return [];
  if (search) {
    return db.select().from(fgMaster).where(
      sql`(${fgMaster.skuId} LIKE ${`%${search}%`} OR ${fgMaster.description} LIKE ${`%${search}%`} OR ${fgMaster.brand} LIKE ${`%${search}%`})`
    ).limit(200);
  }
  return db.select().from(fgMaster).limit(200);
}

export async function getRmMasterList(search?: string) {
  const db = await getDb();
  if (!db) return [];
  if (search) {
    return db.select().from(rmMaster).where(
      sql`(${rmMaster.materialId} LIKE ${`%${search}%`} OR ${rmMaster.description} LIKE ${`%${search}%`})`
    ).limit(200);
  }
  return db.select().from(rmMaster).limit(200);
}

export async function getBomList(search?: string) {
  const db = await getDb();
  if (!db) return [];
  if (search) {
    return db.select().from(bom).where(
      sql`(${bom.fgCode} LIKE ${`%${search}%`} OR ${bom.componentCode} LIKE ${`%${search}%`})`
    ).limit(200);
  }
  return db.select().from(bom).limit(200);
}

export async function getInventoryList(search?: string) {
  const db = await getDb();
  if (!db) return [];
  if (search) {
    return db.select().from(inventory).where(
      sql`(${inventory.itemId} LIKE ${`%${search}%`} OR ${inventory.location} LIKE ${`%${search}%`})`
    ).limit(200);
  }
  return db.select().from(inventory).limit(200);
}

export async function getSalesHistoryList(search?: string) {
  const db = await getDb();
  if (!db) return [];
  if (search) {
    return db.select().from(salesHistory).where(
      sql`(${salesHistory.fgCode} LIKE ${`%${search}%`} OR ${salesHistory.country} LIKE ${`%${search}%`})`
    ).limit(200);
  }
  return db.select().from(salesHistory).orderBy(desc(salesHistory.month)).limit(200);
}

export async function getForecastList(search?: string) {
  const db = await getDb();
  if (!db) return [];
  if (search) {
    return db.select().from(forecast).where(
      sql`(${forecast.fgCode} LIKE ${`%${search}%`} OR ${forecast.country} LIKE ${`%${search}%`})`
    ).limit(200);
  }
  return db.select().from(forecast).orderBy(desc(forecast.month)).limit(200);
}

export async function getPoDataList(search?: string) {
  const db = await getDb();
  if (!db) return [];
  if (search) {
    return db.select().from(poData).where(
      sql`(${poData.poNo} LIKE ${`%${search}%`} OR ${poData.supplierName} LIKE ${`%${search}%`} OR ${poData.itemCode} LIKE ${`%${search}%`})`
    ).limit(200);
  }
  return db.select().from(poData).orderBy(desc(poData.createdAt)).limit(200);
}

export async function getSuppliersList(search?: string) {
  const db = await getDb();
  if (!db) return [];
  if (search) {
    return db.select().from(suppliers).where(
      sql`(${suppliers.supplierCode} LIKE ${`%${search}%`} OR ${suppliers.supplierName} LIKE ${`%${search}%`})`
    ).limit(200);
  }
  return db.select().from(suppliers).limit(200);
}

// ============ DASHBOARD KPI QUERIES ============

export async function getDashboardKpis() {
  const db = await getDb();
  if (!db) return null;

  // Open POs count
  const openPosResult = await db.select({ count: sql<number>`count(*)` })
    .from(poData).where(sql`${poData.status} NOT IN ('Received', 'Closed', 'Cancelled')`);
  const openPoCount = Number(openPosResult[0]?.count ?? 0);

  // Total PO value open
  const openPoValueResult = await db.select({ total: sql<number>`COALESCE(SUM(CAST(${poData.poValueAed} AS DECIMAL(18,2))), 0)` })
    .from(poData).where(sql`${poData.status} NOT IN ('Received', 'Closed', 'Cancelled')`);
  const openPoValue = Number(openPoValueResult[0]?.total ?? 0);

  // Inventory: total items, avg age
  const invResult = await db.select({
    totalItems: sql<number>`count(*)`,
    avgAge: sql<number>`COALESCE(AVG(${inventory.ageDays}), 0)`,
    totalValue: sql<number>`COALESCE(SUM(CAST(${inventory.inventoryValueAed} AS DECIMAL(18,2))), 0)`,
  }).from(inventory);
  const invData = invResult[0];

  // Sales: latest month revenue
  const salesResult = await db.select({
    totalUnits: sql<number>`COALESCE(SUM(${salesHistory.unitsSold}), 0)`,
    totalRevenue: sql<number>`COALESCE(SUM(CAST(${salesHistory.netSalesAed} AS DECIMAL(18,2))), 0)`,
    avgFillRate: sql<number>`COALESCE(AVG(${salesHistory.fillRatePercent}), 0)`,
  }).from(salesHistory);
  const salesData = salesResult[0];

  // Forecast: avg confidence
  const forecastResult = await db.select({
    avgConfidence: sql<number>`COALESCE(AVG(${forecast.confidencePercent}), 0)`,
    totalForecastUnits: sql<number>`COALESCE(SUM(${forecast.forecastUnits}), 0)`,
  }).from(forecast);
  const forecastData = forecastResult[0];

  // Pending HIL gates
  const hilResult = await db.select({ count: sql<number>`count(*)` })
    .from(hilGates).where(eq(hilGates.status, 'pending'));
  const pendingHil = Number(hilResult[0]?.count ?? 0);

  const serviceLevel = Number(salesData?.avgFillRate ?? 94.2);
  const forecastAccuracy = Number(forecastData?.avgConfidence ?? 87.5);
  const inventoryDos = Number(invData?.avgAge ?? 28.3);

  return {
    serviceLevel: Math.min(serviceLevel, 100),
    forecastAccuracy: Math.min(forecastAccuracy, 100),
    inventoryDos,
    openPoCount,
    openPoValue,
    totalInventoryValue: Number(invData?.totalValue ?? 0),
    totalSalesUnits: Number(salesData?.totalUnits ?? 0),
    pendingHilGates: pendingHil,
  };
}

// ============ AGENT MESSAGE QUERIES ============

export async function saveAgentMessage(data: Omit<InsertAgentMessages, 'messageId'>) {
  const db = await getDb();
  if (!db) return;
  const messageId = `msg-${nanoid(12)}`;
  await db.insert(agentMessages).values({ ...data, messageId });
  return { messageId };
}

export async function getAgentMessages(agentId: string, userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentMessages)
    .where(and(eq(agentMessages.agentId, agentId), eq(agentMessages.userId, userId)))
    .orderBy(agentMessages.createdAt)
    .limit(limit);
}
