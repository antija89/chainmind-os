import { nanoid } from "nanoid";
import { getDb } from "./db";
import { agents, tools, agentMessages, InsertAgents, InsertTools, InsertAgentMessages } from "../drizzle/schema";

const AGENT_ROSTER = [
  {
    agentId: "demand_planner",
    roleTitle: "Demand Planner",
    shortCode: "DEM",
    domain: "Demand forecasting, S&OP, channel planning",
    seniority: "Senior",
    tone: "Analytical, precise, data-driven",
    icon: "📊",
    color: "#00D4B8",
    reportsTo: "ops_head",
  },
  {
    agentId: "supply_planner",
    roleTitle: "Supply Planner",
    shortCode: "SUP",
    domain: "Supply planning, inventory optimization, distribution",
    seniority: "Senior",
    tone: "Methodical, detail-oriented, risk-aware",
    icon: "📦",
    color: "#FF6B6B",
    reportsTo: "ops_head",
  },
  {
    agentId: "production_planner",
    roleTitle: "Production Planner",
    shortCode: "PRD",
    domain: "Production scheduling, capacity planning, OEE",
    seniority: "Senior",
    tone: "Pragmatic, efficiency-focused, constraint-aware",
    icon: "🏭",
    color: "#4ECDC4",
    reportsTo: "ops_head",
  },
  {
    agentId: "procurement_planner",
    roleTitle: "Procurement Planner",
    shortCode: "PRC",
    domain: "Procurement, supplier management, MRP",
    seniority: "Senior",
    tone: "Negotiation-ready, vendor-focused, cost-conscious",
    icon: "🤝",
    color: "#FFD93D",
    reportsTo: "ops_head",
  },
  {
    agentId: "ops_head",
    roleTitle: "Ops Head",
    shortCode: "OPS",
    domain: "S&OP orchestration, conflict resolution, KPI oversight",
    seniority: "Executive",
    tone: "Strategic, decisive, business-focused",
    icon: "👔",
    color: "#6C5CE7",
    reportsTo: "human",
  },
];

const CORE_TOOLS = [
  {
    toolId: "run_forecast",
    name: "Run Demand Forecast",
    description: "Runs a demand forecast for a given SKU using statistical models",
    category: "demand_planning",
    ownerAgent: "demand_planner",
    callableBy: ["demand_planner", "supply_planner", "ops_head"],
  },
  {
    toolId: "calculate_dos",
    name: "Calculate Days of Stock",
    description: "Calculates DOS for inventory items",
    category: "supply_planning",
    ownerAgent: "supply_planner",
    callableBy: ["supply_planner", "ops_head"],
  },
  {
    toolId: "run_supply_plan",
    name: "Run Supply Plan",
    description: "Generates unconstrained and constrained supply plans",
    category: "supply_planning",
    ownerAgent: "supply_planner",
    callableBy: ["supply_planner", "ops_head"],
  },
  {
    toolId: "gap_analysis",
    name: "Gap Analysis",
    description: "Analyzes supply vs demand gaps",
    category: "supply_planning",
    ownerAgent: "supply_planner",
    callableBy: ["supply_planner", "ops_head"],
  },
  {
    toolId: "build_schedule",
    name: "Build Production Schedule",
    description: "Creates production schedule based on supply plan",
    category: "production_planning",
    ownerAgent: "production_planner",
    callableBy: ["production_planner", "ops_head"],
  },
  {
    toolId: "run_mrp",
    name: "Run MRP",
    description: "Generates material requirements planning",
    category: "procurement",
    ownerAgent: "procurement_planner",
    callableBy: ["procurement_planner", "ops_head"],
  },
];

export async function initializeAgents() {
  const db = await getDb();
  if (!db) return;

  for (const agent of AGENT_ROSTER) {
    const insertData: InsertAgents = {
      agentId: agent.agentId,
      roleTitle: agent.roleTitle,
      shortCode: agent.shortCode,
      domain: agent.domain,
      seniority: agent.seniority,
      tone: agent.tone,
      icon: agent.icon,
      color: agent.color,
      reportsTo: agent.reportsTo,
      instructionStack: {
        primary_objective: `Manage ${agent.roleTitle.toLowerCase()} operations`,
        sops: [],
        decision_rules: [],
        guardrails: [],
        tools_available: [],
      },
      kpiTargets: [],
      status: "active",
    };

    try {
      await db.insert(agents).values(insertData).onDuplicateKeyUpdate({
        set: insertData,
      });
    } catch (error) {
      console.error(`Failed to initialize agent ${agent.agentId}:`, error);
    }
  }
}

export async function initializeTools() {
  const db = await getDb();
  if (!db) return;

  for (const tool of CORE_TOOLS) {
    const insertData: InsertTools = {
      toolId: tool.toolId,
      name: tool.name,
      description: tool.description,
      category: tool.category,
      ownerAgent: tool.ownerAgent,
      callableBy: tool.callableBy,
      parameters: {},
      returns: {},
      implementation: "",
      status: "active",
    };

    try {
      await db.insert(tools).values(insertData).onDuplicateKeyUpdate({
        set: insertData,
      });
    } catch (error) {
      console.error(`Failed to initialize tool ${tool.toolId}:`, error);
    }
  }
}

export async function saveAgentMessage(
  agentId: string,
  userId: number,
  role: "user" | "assistant",
  content: string,
  metadata?: Record<string, unknown>
) {
  const db = await getDb();
  if (!db) return null;

  const messageId = `msg_${nanoid()}`;
  const insertData: InsertAgentMessages = {
    messageId,
    agentId,
    userId,
    role,
    content,
    metadata: metadata || {},
  };

  try {
    await db.insert(agentMessages).values(insertData);
    return messageId;
  } catch (error) {
    console.error("Failed to save agent message:", error);
    return null;
  }
}

export const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  demand_planner: "You are the Demand Planner agent. Forecast demand accurately and identify anomalies.",
  supply_planner: "You are the Supply Planner agent. Optimize inventory and ensure supply meets demand.",
  production_planner: "You are the Production Planner agent. Build feasible production schedules.",
  procurement_planner: "You are the Procurement Planner agent. Ensure material availability.",
  ops_head: "You are the Ops Head agent. Orchestrate the S&OP process and resolve conflicts.",
};

export function getAgents() {
  return AGENT_ROSTER.map((agent) => ({
    agentId: agent.agentId,
    roleTitle: agent.roleTitle,
    shortCode: agent.shortCode,
    domain: agent.domain,
    seniority: agent.seniority,
    tone: agent.tone,
    icon: agent.icon,
    color: agent.color,
    reportsTo: agent.reportsTo,
  }));
}
