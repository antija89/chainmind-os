import { getDb } from './db';
import { llmCallLogs } from '../drizzle/schema';
import { desc, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export interface LlmCallLogInput {
  agentId: string;
  agentName: string;
  sessionId?: string;
  callType: 'primary' | 'followup' | 'retry' | 'reviewer';
  model?: string;
  apiUrl?: string;
  inputMessages: unknown[];
  inputTools?: unknown[];
  toolChoice?: string;
  outputContent?: string;
  outputToolCalls?: unknown[];
  finishReason?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  durationMs?: number;
  status: 'success' | 'error' | 'empty';
  errorMessage?: string;
}

export async function saveLlmCallLog(input: LlmCallLogInput): Promise<string> {
  const db = await getDb();
  const id = `llm_${nanoid(16)}`;
  if (!db) return id;
  try {
    await db.insert(llmCallLogs).values({
      id,
      agentId: input.agentId,
      agentName: input.agentName,
      sessionId: input.sessionId,
      callType: input.callType,
      model: input.model,
      apiUrl: input.apiUrl,
      inputMessages: input.inputMessages as any,
      inputTools: input.inputTools as any,
      toolChoice: input.toolChoice,
      outputContent: input.outputContent,
      outputToolCalls: input.outputToolCalls as any,
      finishReason: input.finishReason,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.totalTokens,
      durationMs: input.durationMs,
      status: input.status,
      errorMessage: input.errorMessage,
    });
  } catch (e) {
    console.warn('[LLM Logs] Failed to save log:', e);
  }
  return id;
}

export async function getLlmCallLogs(options?: {
  agentId?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  if (!db) return [];
  try {
    let query = db
      .select()
      .from(llmCallLogs)
      .orderBy(desc(llmCallLogs.createdAt))
      .limit(limit)
      .offset(offset);

    if (options?.agentId) {
      return await db
        .select()
        .from(llmCallLogs)
        .where(eq(llmCallLogs.agentId, options.agentId))
        .orderBy(desc(llmCallLogs.createdAt))
        .limit(limit)
        .offset(offset);
    }

    return await query;
  } catch (e) {
    console.warn('[LLM Logs] Failed to fetch logs:', e);
    return [];
  }
}

export async function getLlmCallLogById(id: string) {
  const db = await getDb();
  if (!db) return null;
  try {
    const rows = await db
      .select()
      .from(llmCallLogs)
      .where(eq(llmCallLogs.id, id))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function getLlmCallLogStats() {
  const db = await getDb();
  if (!db) return { total: 0, successCount: 0, errorCount: 0, emptyCount: 0, avgDuration: 0, totalTokens: 0, modelCounts: {} };
  try {
    const all = await db
      .select()
      .from(llmCallLogs)
      .orderBy(desc(llmCallLogs.createdAt))
      .limit(200);

    const total = all.length;
    type Row = typeof all[0];
    const successCount = all.filter((r: Row) => r.status === 'success').length;
    const errorCount = all.filter((r: Row) => r.status === 'error').length;
    const emptyCount = all.filter((r: Row) => r.status === 'empty').length;
    const avgDuration = total > 0
      ? Math.round(all.reduce((s: number, r: Row) => s + (r.durationMs ?? 0), 0) / total)
      : 0;
    const totalTokens = all.reduce((s: number, r: Row) => s + (r.totalTokens ?? 0), 0);

    const modelCounts: Record<string, number> = {};
    for (const r of all) {
      const m = r.model ?? 'unknown';
      modelCounts[m] = (modelCounts[m] ?? 0) + 1;
    }

    return { total, successCount, errorCount, emptyCount, avgDuration, totalTokens, modelCounts };
  } catch {
    return { total: 0, successCount: 0, errorCount: 0, emptyCount: 0, avgDuration: 0, totalTokens: 0, modelCounts: {} };
  }
}
