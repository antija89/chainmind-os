import { getDb } from './db';
import { agentTools, toolExecutionLog } from '../drizzle/schema';
import { eq, like, and, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// ============ AGENT TOOLS ============

export async function getToolList(search?: string) {
  const db = await getDb();
  if (!db) return [];
  try {
    if (search) {
      return await db
        .select()
        .from(agentTools)
        .where(
          sql`(${agentTools.name} LIKE ${`%${search}%`} OR ${agentTools.description} LIKE ${`%${search}%`})`
        )
        .orderBy(desc(agentTools.createdAt));
    }
    return await db
      .select()
      .from(agentTools)
      .orderBy(desc(agentTools.createdAt));
  } catch (error) {
    console.error('[Tools] getToolList error:', error);
    return [];
  }
}

export async function getToolById(toolId: string) {
  const db = await getDb();
  if (!db) return null;
  try {
    const results = await db
      .select()
      .from(agentTools)
      .where(eq(agentTools.toolId, toolId))
      .limit(1);
    return results[0] || null;
  } catch (error) {
    console.error('[Tools] getToolById error:', error);
    return null;
  }
}

export async function getToolsByAgent(agentId: string) {
  const db = await getDb();
  if (!db) return [];
  try {
    // JSON_CONTAINS to find agent in agent_ids array
    return await db
      .select()
      .from(agentTools)
      .where(
        and(
          sql`JSON_CONTAINS(${agentTools.agentIds}, ${JSON.stringify(agentId)})`,
          eq(agentTools.isActive, true)
        )
      );
  } catch (error) {
    // Fallback: return all active tools
    console.error('[Tools] getToolsByAgent error, returning all active tools:', error);
    try {
      const db2 = await getDb();
      if (!db2) return [];
      return await db2
        .select()
        .from(agentTools)
        .where(eq(agentTools.isActive, true));
    } catch {
      return [];
    }
  }
}

export async function createTool(data: {
  name: string;
  description?: string;
  category: 'demand' | 'supply' | 'production' | 'procurement' | 'operations';
  agentIds: string[];
  inputSchema: any;
  outputSchema?: any;
  implementation: string;
  dataSources?: string[];
  complexity?: 'simple' | 'medium' | 'complex';
  createdBy?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const toolId = `tool_${nanoid(12)}`;
  try {
    await db.insert(agentTools).values({
      toolId,
      name: data.name,
      description: data.description ?? '',
      category: data.category,
      agentIds: data.agentIds,
      inputSchema: data.inputSchema,
      outputSchema: data.outputSchema ?? {},
      implementation: data.implementation,
      dataSources: data.dataSources ?? [],
      complexity: data.complexity ?? 'simple',
      createdBy: data.createdBy ?? 'system',
      isActive: true,
    });
    return { tool_id: toolId, ...data };
  } catch (error) {
    console.error('[Tools] createTool error:', error);
    throw error;
  }
}

export async function updateTool(
  toolId: string,
  updates: {
    name?: string;
    description?: string;
    category?: 'demand' | 'supply' | 'production' | 'procurement' | 'operations';
    complexity?: 'simple' | 'medium' | 'complex';
    isActive?: boolean;
    implementation?: string;
    inputSchema?: any;
    outputSchema?: any;
    agentIds?: string[];
  }
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  try {
    const updateData: Record<string, any> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.complexity !== undefined) updateData.complexity = updates.complexity;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    if (updates.implementation !== undefined) updateData.implementation = updates.implementation;
    if (updates.inputSchema !== undefined) updateData.inputSchema = updates.inputSchema;
    if (updates.outputSchema !== undefined) updateData.outputSchema = updates.outputSchema;
    if (updates.agentIds !== undefined) updateData.agentIds = updates.agentIds;

    if (Object.keys(updateData).length > 0) {
      await db.update(agentTools).set(updateData).where(eq(agentTools.toolId, toolId));
    }
    return await getToolById(toolId);
  } catch (error) {
    console.error('[Tools] updateTool error:', error);
    throw error;
  }
}

export async function deleteTool(toolId: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  try {
    await db.delete(agentTools).where(eq(agentTools.toolId, toolId));
    return { success: true };
  } catch (error) {
    console.error('[Tools] deleteTool error:', error);
    throw error;
  }
}

// ============ TOOL EXECUTION LOG ============

export async function logToolExecution(execution: {
  toolId: string;
  agentId?: string;
  messageId?: string;
  userId?: number;
  inputParams?: any;
  outputResult?: any;
  executionTime?: number;
  status: 'success' | 'error' | 'timeout';
  errorMessage?: string;
}) {
  const db = await getDb();
  if (!db) return `exec_${nanoid(12)}`;
  const executionId = `exec_${nanoid(12)}`;
  try {
    await db.insert(toolExecutionLog).values({
      executionId,
      toolId: execution.toolId,
      agentId: execution.agentId,
      userId: execution.userId,
      messageId: execution.messageId,
      inputParams: execution.inputParams ?? {},
      outputResult: execution.outputResult ?? {},
      executionTime: execution.executionTime ? Math.round(execution.executionTime) : 0,
      status: execution.status,
      errorMessage: execution.errorMessage,
    });
    return executionId;
  } catch (error) {
    console.error('[Tools] logToolExecution error:', error);
    return executionId;
  }
}

export async function getToolExecutionHistory(
  toolId?: string,
  agentId?: string,
  limit = 100
) {
  const db = await getDb();
  if (!db) return [];
  try {
    const conditions = [];
    if (toolId) conditions.push(eq(toolExecutionLog.toolId, toolId));
    if (agentId) conditions.push(eq(toolExecutionLog.agentId, agentId));

    const query = db
      .select()
      .from(toolExecutionLog)
      .orderBy(desc(toolExecutionLog.createdAt))
      .limit(limit);

    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    return await query;
  } catch (error) {
    console.error('[Tools] getToolExecutionHistory error:', error);
    return [];
  }
}

export async function getToolStats(toolId: string) {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select({
        total: sql<number>`COUNT(*)`,
        successful: sql<number>`SUM(CASE WHEN ${toolExecutionLog.status} = 'success' THEN 1 ELSE 0 END)`,
        failed: sql<number>`SUM(CASE WHEN ${toolExecutionLog.status} = 'error' THEN 1 ELSE 0 END)`,
        avgTime: sql<number>`AVG(${toolExecutionLog.executionTime})`,
        maxTime: sql<number>`MAX(${toolExecutionLog.executionTime})`,
      })
      .from(toolExecutionLog)
      .where(eq(toolExecutionLog.toolId, toolId));
    return rows[0] || null;
  } catch (error) {
    console.error('[Tools] getToolStats error:', error);
    return null;
  }
}
