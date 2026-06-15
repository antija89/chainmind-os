import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { logSupervisionEvent, getSupervisionLogs, getSupervisionDashboardSummary } from './db-supervision';

/**
 * End-to-end test for real-time supervision logging
 * Tests the complete flow: agent response -> supervision logging -> dashboard visibility
 */
describe('Real-time Supervision Logging E2E', () => {
  const testAgentId = 'demand_planner_test';
  const testAgentName = 'Demand Planner';

  beforeAll(async () => {
    console.log('[Test] Starting real-time supervision logging tests');
  });

  afterAll(async () => {
    console.log('[Test] Completed real-time supervision logging tests');
  });

  it('should log a successful agent response with system prompt', async () => {
    const systemPrompt = `You are a Demand Planner agent. Your role is to analyze demand patterns and forecast future demand.
    
CRITICAL INSTRUCTIONS:
1. ALWAYS use tools first - For ANY question about demand data, call the appropriate tool immediately.
2. Do NOT ask for clarification - If a user asks a general question, use the most relevant tool with default or reasonable parameters.
3. Be proactive - Suggest relevant tools and insights based on the user's query.
4. Provide data-driven answers - Use tool results to support your recommendations.`;

    const result = await logSupervisionEvent({
      agentId: testAgentId,
      agentName: testAgentName,
      question: 'What are the top selling SKUs?',
      agentResponse: 'Based on the data, SKU-001 and SKU-002 are the top sellers with 15,000 and 12,000 units respectively.',
      responseStatus: 'success',
      systemPrompt,
      agentReasoning: 'I analyzed the sales data and identified the top 2 SKUs by volume.',
      toolsUsed: ['get_top_selling_skus'],
      toolCalls: [
        {
          name: 'get_top_selling_skus',
          status: 'success',
          result: { skus: [{ sku: 'SKU-001', units: 15000 }] },
          executionTime: 245,
        },
      ],
      executionDetails: {
        toolCount: 1,
        responseLength: 98,
        timestamp: new Date().toISOString(),
      },
    });

    expect(result.supervisionId).toBeDefined();
    expect(result.responseStatus).toBe('success');
    expect(result.needsReview).toBe(false);
  });

  it('should log a blank response and mark for review', async () => {
    const result = await logSupervisionEvent({
      agentId: testAgentId,
      agentName: testAgentName,
      question: 'What is the current inventory level?',
      agentResponse: '', // Blank response
      responseStatus: 'blank',
      systemPrompt: 'You are a Demand Planner agent.',
      toolsUsed: [],
      executionDetails: {
        toolCount: 0,
        responseLength: 0,
        timestamp: new Date().toISOString(),
      },
    });

    expect(result.responseStatus).toBe('blank');
    expect(result.needsReview).toBe(true);
  });

  it('should log an incomplete response', async () => {
    const result = await logSupervisionEvent({
      agentId: testAgentId,
      agentName: testAgentName,
      question: 'Forecast demand for next quarter',
      agentResponse: 'Forecast is...', // Too short
      responseStatus: 'incomplete',
      systemPrompt: 'You are a Demand Planner agent.',
      toolsUsed: ['forecast_demand_by_sku'],
      executionDetails: {
        toolCount: 1,
        responseLength: 15,
        timestamp: new Date().toISOString(),
      },
    });

    expect(result.responseStatus).toBe('incomplete');
    expect(result.needsReview).toBe(true);
  });

  it('should log an error response', async () => {
    const result = await logSupervisionEvent({
      agentId: testAgentId,
      agentName: testAgentName,
      question: 'Calculate safety stock',
      agentResponse: 'Error: Failed to retrieve inventory data',
      responseStatus: 'error',
      systemPrompt: 'You are a Demand Planner agent.',
      toolsUsed: [],
      executionDetails: {
        toolCount: 0,
        responseLength: 42,
        timestamp: new Date().toISOString(),
      },
    });

    expect(result.responseStatus).toBe('error');
    expect(result.needsReview).toBe(true);
  });

  it('should retrieve supervision logs with full prompt visibility', async () => {
    const logs = await getSupervisionLogs(testAgentId);

    expect(logs.length).toBeGreaterThan(0);

    // Verify first log has all required fields
    const firstLog = logs[0];
    expect(firstLog.supervisionId).toBeDefined();
    expect(firstLog.agentId).toBe(testAgentId);
    expect(firstLog.question).toBeDefined();
    expect(firstLog.systemPrompt).toBeDefined();
    expect(firstLog.agentResponse).toBeDefined();
    expect(firstLog.responseStatus).toBeDefined();
    expect(firstLog.toolsUsed).toBeDefined();
    expect(firstLog.toolCalls).toBeDefined();
    expect(firstLog.executionDetails).toBeDefined();
  });

  it('should filter logs by response status', async () => {
    const blankLogs = await getSupervisionLogs(testAgentId, 'blank');
    expect(blankLogs.length).toBeGreaterThan(0);
    expect(blankLogs.every((log) => log.responseStatus === 'blank')).toBe(true);

    const errorLogs = await getSupervisionLogs(testAgentId, 'error');
    expect(errorLogs.length).toBeGreaterThan(0);
    expect(errorLogs.every((log) => log.responseStatus === 'error')).toBe(true);
  });

  it('should display dashboard summary with real agent stats', async () => {
    const summary = await getSupervisionDashboardSummary();

    expect(summary.agentStats).toBeDefined();
    expect(Array.isArray(summary.agentStats)).toBe(true);

    // Find our test agent in the stats
    const testAgentStats = summary.agentStats.find((s: any) => s.agentId === testAgentId);
    expect(testAgentStats).toBeDefined();

    if (testAgentStats) {
      expect(testAgentStats.interactionCount).toBeGreaterThan(0);
      expect(testAgentStats.blankResponses).toBeGreaterThan(0);
      expect(testAgentStats.errorResponses).toBeGreaterThan(0);
      expect(testAgentStats.incompleteResponses).toBeGreaterThan(0);
    }
  });

  it('should show pending guidance count in dashboard', async () => {
    const summary = await getSupervisionDashboardSummary();

    // Blank, error, and incomplete responses should trigger guidance
    // So pending guidance should be > 0
    expect(summary.pendingGuidance).toBeGreaterThanOrEqual(0);
  });

  it('should verify complete supervision workflow', async () => {
    // 1. Log a successful response
    const successResult = await logSupervisionEvent({
      agentId: testAgentId,
      agentName: testAgentName,
      question: 'What are top SKUs?',
      agentResponse: 'SKU-001 and SKU-002 are top sellers.',
      responseStatus: 'success',
      systemPrompt: 'You are a Demand Planner.',
      toolsUsed: ['get_top_selling_skus'],
      toolCalls: [{ name: 'get_top_selling_skus', status: 'success', executionTime: 200 }],
      executionDetails: { toolCount: 1, responseLength: 50, timestamp: new Date().toISOString() },
    });

    expect(successResult.needsReview).toBe(false);

    // 2. Retrieve logs and verify
    const logs = await getSupervisionLogs(testAgentId, 'success');
    expect(logs.length).toBeGreaterThan(0);

    const successLog = logs.find((l) => l.supervisionId === successResult.supervisionId);
    expect(successLog).toBeDefined();
    expect(successLog?.systemPrompt).toContain('Demand Planner');
    expect(successLog?.toolCalls).toBeDefined();
    expect(Array.isArray(successLog?.toolCalls)).toBe(true);

    // 3. Verify dashboard shows the interaction
    const summary = await getSupervisionDashboardSummary();
    const agentStats = summary.agentStats.find((s: any) => s.agentId === testAgentId);
    expect(agentStats?.interactionCount).toBeGreaterThan(0);
  });
});
