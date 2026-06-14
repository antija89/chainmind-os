import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, agents, planStore, hilGates, fgMaster, rmMaster, inventory, poData, suppliers, auditLog, agentMessages } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
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

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ AGENT QUERIES ============

export async function getAgents() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agents);
}

export async function getAgentById(agentId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(agents).where(eq(agents.agentId, agentId)).limit(1);
  return result[0];
}

// ============ PLAN STORE QUERIES ============

export async function getPlansByType(type: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(planStore).where(eq(planStore.type, type));
}

export async function getPlanById(planId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(planStore).where(eq(planStore.planId, planId)).limit(1);
  return result[0];
}

// ============ HIL GATE QUERIES ============

export async function getHilGatesPending() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(hilGates).where(eq(hilGates.status, 'pending'));
}

export async function getHilGateById(gateId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(hilGates).where(eq(hilGates.gateId, gateId)).limit(1);
  return result[0];
}

// ============ DATA LAKE QUERIES ============

export async function getFgMasterList() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fgMaster);
}

export async function getRmMasterList() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(rmMaster);
}

export async function getInventoryList() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(inventory);
}

export async function getPoDataList() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(poData);
}

export async function getSuppliersList() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(suppliers);
}

// ============ AUDIT LOG QUERIES ============

export async function getAuditLogs(limit: number = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditLog).limit(limit);
}

// ============ AGENT MESSAGE QUERIES ============

export async function getAgentMessages(agentId: string, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentMessages).where(eq(agentMessages.agentId, agentId)).limit(limit);
}
