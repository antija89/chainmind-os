import { getDb } from './db';
import { nanoid } from 'nanoid';

// ============ AGENT TOOLS ============

export async function getToolList(search?: string) {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const query = search 
      ? `SELECT * FROM agent_tools WHERE name LIKE '%${search}%' OR description LIKE '%${search}%'`
      : `SELECT * FROM agent_tools`;
    
    const results = await db.execute(query);
    return results || [];
  } catch (error) {
    console.error('[Tools] getToolList error:', error);
    return [];
  }
}

export async function getToolById(toolId: string) {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const results = await db.execute(`SELECT * FROM agent_tools WHERE tool_id = '${toolId}'`);
    return results?.[0] || null;
  } catch (error) {
    console.error('[Tools] getToolById error:', error);
    return null;
  }
}

export async function getToolsByAgent(agentId: string) {
  const db = await getDb();
  if (!db) return [];
  
  try {
    const results = await db.execute(`SELECT * FROM agent_tools WHERE agent_ids LIKE '%${agentId}%'`);
    return results || [];
  } catch (error) {
    console.error('[Tools] getToolsByAgent error:', error);
    return [];
  }
}

export async function createTool(tool: {
  toolId?: string;
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
  
  try {
    const toolId = tool.toolId || `tool_${nanoid()}`;
    const now = new Date().toISOString();
    
    const query = `
      INSERT INTO agent_tools (
        tool_id, name, description, category, agent_ids, input_schema, 
        output_schema, implementation, data_sources, complexity, 
        is_active, created_by, created_at, updated_at
      ) VALUES (
        '${toolId}',
        '${tool.name.replace(/'/g, "''")}',
        '${(tool.description || '').replace(/'/g, "''")}',
        '${tool.category}',
        '${JSON.stringify(tool.agentIds).replace(/'/g, "''")}',
        '${JSON.stringify(tool.inputSchema).replace(/'/g, "''")}',
        '${JSON.stringify(tool.outputSchema || {}).replace(/'/g, "''")}',
        '${tool.implementation.replace(/'/g, "''")}',
        '${JSON.stringify(tool.dataSources || []).replace(/'/g, "''")}',
        '${tool.complexity || 'simple'}',
        1,
        '${(tool.createdBy || 'system').replace(/'/g, "''")}',
        '${now}',
        '${now}'
      )
    `;
    
    await db.execute(query);
    
    return {
      tool_id: toolId,
      name: tool.name,
      description: tool.description || '',
      category: tool.category,
      agent_ids: JSON.stringify(tool.agentIds),
      input_schema: JSON.stringify(tool.inputSchema),
      output_schema: JSON.stringify(tool.outputSchema || {}),
      implementation: tool.implementation,
      data_sources: JSON.stringify(tool.dataSources || []),
      complexity: tool.complexity || 'simple',
      is_active: true,
      created_by: tool.createdBy || 'system',
      created_at: now,
      updated_at: now,
    };
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
  }
) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  try {
    const setClauses = [];
    
    if (updates.name) {
      setClauses.push(`name = '${updates.name.replace(/'/g, "''")}'`);
    }
    if (updates.description) {
      setClauses.push(`description = '${updates.description.replace(/'/g, "''")}'`);
    }
    if (updates.category) {
      setClauses.push(`category = '${updates.category}'`);
    }
    if (updates.complexity) {
      setClauses.push(`complexity = '${updates.complexity}'`);
    }
    
    setClauses.push(`updated_at = '${new Date().toISOString()}'`);
    
    const query = `
      UPDATE agent_tools 
      SET ${setClauses.join(', ')}
      WHERE tool_id = '${toolId}'
    `;
    
    await db.execute(query);
    
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
    await db.execute(`DELETE FROM agent_tools WHERE tool_id = '${toolId}'`);
    return { success: true };
  } catch (error) {
    console.error('[Tools] deleteTool error:', error);
    throw error;
  }
}

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
  if (!db) throw new Error('Database not available');
  
  try {
    const executionId = `exec_${nanoid()}`;
    const now = new Date().toISOString();
    
    const query = `
      INSERT INTO tool_execution_log (
        execution_id, tool_id, agent_id, user_id, message_id, 
        input_params, output_result, execution_time_ms, status, 
        error_message, created_at
      ) VALUES (
        '${executionId}',
        '${execution.toolId}',
        ${execution.agentId ? `'${execution.agentId}'` : 'NULL'},
        ${execution.userId || 'NULL'},
        ${execution.messageId ? `'${execution.messageId}'` : 'NULL'},
        '${JSON.stringify(execution.inputParams || {}).replace(/'/g, "''")}',
        '${JSON.stringify(execution.outputResult || {}).replace(/'/g, "''")}',
        ${execution.executionTime || 0},
        '${execution.status}',
        ${execution.errorMessage ? `'${execution.errorMessage.replace(/'/g, "''")}'` : 'NULL'},
        '${now}'
      )
    `;
    
    await db.execute(query);
    
    return executionId;
  } catch (error) {
    console.error('[Tools] logToolExecution error:', error);
    throw error;
  }
}

export async function getToolExecutionHistory(
  toolId?: string,
  agentId?: string,
  limit: number = 100
) {
  const db = await getDb();
  if (!db) return [];
  
  try {
    let query = `SELECT * FROM tool_execution_log WHERE 1=1`;
    
    if (toolId) {
      query += ` AND tool_id = '${toolId}'`;
    }
    
    if (agentId) {
      query += ` AND agent_id = '${agentId}'`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT ${limit}`;
    
    const results = await db.execute(query);
    return results || [];
  } catch (error) {
    console.error('[Tools] getToolExecutionHistory error:', error);
    return [];
  }
}

export async function getToolStats(toolId: string) {
  const db = await getDb();
  if (!db) return null;
  
  try {
    const query = `
      SELECT 
        COUNT(*) as total_executions,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) as timeout,
        AVG(execution_time_ms) as avg_execution_time,
        MAX(execution_time_ms) as max_execution_time,
        MIN(execution_time_ms) as min_execution_time
      FROM tool_execution_log
      WHERE tool_id = '${toolId}'
    `;
    
    const stats = await db.execute(query);
    return stats?.[0] || null;
  } catch (error) {
    console.error('[Tools] getToolStats error:', error);
    return null;
  }
}
