/**
 * Capability Registry - Tool lookup by capability.
 * Prevents duplicate tool creation by checking if capability already exists.
 * Phase E: Replanning + Capability Registry
 */

import { getDb } from './db';
import { agentTools } from '../drizzle/schema';
import { eq, like } from 'drizzle-orm';

export interface ToolCapability {
  toolId: string;
  name: string;
  capabilities: string[];
  description: string;
  category: string;
}

/**
 * Search for tools by capability.
 * Returns all tools that provide the requested capability.
 */
export async function getToolByCapability(capability: string): Promise<ToolCapability[]> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[CapabilityRegistry] Database not available');
      return [];
    }

    // Query tools where capabilities JSON array contains the capability
    const tools = await db
      .select()
      .from(agentTools)
      .where(eq(agentTools.isActive, true));

    // Filter tools that have the capability
    const matchingTools = tools.filter((tool) => {
      if (!tool.capabilities) return false;
      const caps = Array.isArray(tool.capabilities) ? tool.capabilities : JSON.parse(String(tool.capabilities));
      return caps.some((cap: string) => cap.toLowerCase().includes(capability.toLowerCase()));
    });

    return matchingTools.map((tool) => ({
      toolId: tool.toolId,
      name: tool.name,
      capabilities: Array.isArray(tool.capabilities) ? tool.capabilities : JSON.parse(String(tool.capabilities)),
      description: tool.description || '',
      category: tool.category,
    }));
  } catch (error) {
    console.error('[CapabilityRegistry] Error searching for capability:', error);
    return [];
  }
}

/**
 * Register a new tool with capabilities.
 */
export async function registerToolCapabilities(toolId: string, capabilities: string[]): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[CapabilityRegistry] Database not available');
      return false;
    }

    await db
      .update(agentTools)
      .set({ capabilities: capabilities as any })
      .where(eq(agentTools.toolId, toolId));

    return true;
  } catch (error) {
    console.error('[CapabilityRegistry] Error registering capabilities:', error);
    return false;
  }
}

/**
 * Check if a capability already exists in the registry.
 */
export async function capabilityExists(capability: string): Promise<boolean> {
  const tools = await getToolByCapability(capability);
  return tools.length > 0;
}

/**
 * Get all available capabilities in the registry.
 */
export async function getAllCapabilities(): Promise<string[]> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[CapabilityRegistry] Database not available');
      return [];
    }

    const tools = await db.select().from(agentTools).where(eq(agentTools.isActive, true));

    const allCapabilities = new Set<string>();
    for (const tool of tools) {
      if (tool.capabilities) {
        const caps = Array.isArray(tool.capabilities) ? tool.capabilities : JSON.parse(String(tool.capabilities));
        caps.forEach((cap: string) => allCapabilities.add(cap));
      }
    }

    return Array.from(allCapabilities);
  } catch (error) {
    console.error('[CapabilityRegistry] Error getting all capabilities:', error);
    return [];
  }
}

/**
 * Suggest tools for a given task description.
 * Uses simple keyword matching to find relevant tools.
 */
export async function suggestToolsForTask(taskDescription: string): Promise<ToolCapability[]> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[CapabilityRegistry] Database not available');
      return [];
    }

    const tools = await db.select().from(agentTools).where(eq(agentTools.isActive, true));

    // Score tools based on keyword matches
    const scored = tools
      .map((tool) => {
        let score = 0;

        // Check tool name
        if (tool.name.toLowerCase().includes(taskDescription.toLowerCase())) {
          score += 10;
        }

        // Check description
        if (tool.description?.toLowerCase().includes(taskDescription.toLowerCase())) {
          score += 5;
        }

        // Check capabilities
        if (tool.capabilities) {
          const caps = Array.isArray(tool.capabilities) ? tool.capabilities : JSON.parse(String(tool.capabilities));
          caps.forEach((cap: string) => {
            if (cap.toLowerCase().includes(taskDescription.toLowerCase())) {
              score += 3;
            }
          });
        }

        return { tool, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return scored.map((item) => ({
      toolId: item.tool.toolId,
      name: item.tool.name,
      capabilities: Array.isArray(item.tool.capabilities)
        ? item.tool.capabilities
        : JSON.parse(String(item.tool.capabilities)),
      description: item.tool.description || '',
      category: item.tool.category,
    }));
  } catch (error) {
    console.error('[CapabilityRegistry] Error suggesting tools:', error);
    return [];
  }
}
