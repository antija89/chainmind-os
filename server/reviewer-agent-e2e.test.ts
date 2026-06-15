import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  logSupervisionEvent,
  createGuidance,
  markGuidanceResolved,
  logConversation,
  getSupervisionLogs,
  getAgentGuidanceRecords,
  getConversationHistory,
  getSupervisionDashboardSummary,
} from './db-supervision';

describe('Reviewer Agent Supervision System E2E', () => {
  let testSupervisionId: string;
  let testGuidanceId: string;

  describe('Supervision Logging', () => {
    it('should log a successful agent response', async () => {
      const result = await logSupervisionEvent({
        agentId: 'demand_planner',
        agentName: 'Demand Planner',
        question: 'What are the top selling SKUs?',
        agentResponse: 'Based on the data, SKU-001 and SKU-002 are the top sellers with 15,000 and 12,000 units respectively.',
        responseStatus: 'success',
        toolsUsed: ['get_top_selling_skus'],
        executionDetails: {
          toolCount: 1,
          responseLength: 120,
          timestamp: new Date().toISOString(),
        },
      });

      expect(result.supervisionId).toBeDefined();
      expect(result.responseStatus).toBe('success');
      expect(result.needsReview).toBe(false);
    });

    it('should log a blank agent response and trigger guidance', async () => {
      const result = await logSupervisionEvent({
        agentId: 'supply_planner',
        agentName: 'Supply Planner',
        question: 'What is the current inventory level?',
        agentResponse: '', // Blank response
        responseStatus: 'blank',
        toolsUsed: [],
      });

      testSupervisionId = result.supervisionId;

      expect(result.supervisionId).toBeDefined();
      expect(result.responseStatus).toBe('blank');
      expect(result.needsReview).toBe(true);
    });

    it('should log an incomplete agent response', async () => {
      const result = await logSupervisionEvent({
        agentId: 'production_planner',
        agentName: 'Production Planner',
        question: 'What is the production capacity?',
        agentResponse: 'High capacity', // Too short
        responseStatus: 'incomplete',
      });

      expect(result.supervisionId).toBeDefined();
      expect(result.responseStatus).toBe('incomplete');
      expect(result.needsReview).toBe(true);
    });

    it('should log an error response', async () => {
      const result = await logSupervisionEvent({
        agentId: 'procurement_planner',
        agentName: 'Procurement Planner',
        question: 'What are the supplier options?',
        agentResponse: 'Error: Failed to fetch supplier data from database',
        responseStatus: 'error',
      });

      expect(result.supervisionId).toBeDefined();
      expect(result.responseStatus).toBe('error');
      expect(result.needsReview).toBe(true);
    });
  });

  describe('Guidance System', () => {
    it('should create guidance for a blank response', async () => {
      const result = await createGuidance({
        supervisionId: testSupervisionId,
        agentId: 'supply_planner',
        guidanceType: 'clarification',
        guidanceText: 'Your response was blank. Please provide a detailed answer to the question: "What is the current inventory level?"',
        guidanceAction: 'retry',
      });

      testGuidanceId = result.guidanceId;

      expect(result.guidanceId).toBeDefined();
      expect(result.message).toContain('Guidance provided');
    });

    it('should mark guidance as resolved', async () => {
      const result = await markGuidanceResolved(
        testGuidanceId,
        'The current inventory level is 42,000 units across all warehouses.'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Conversation Logging', () => {
    it('should log a user-to-agent conversation', async () => {
      const result = await logConversation({
        agentId: 'demand_planner',
        userMessage: 'What are the top selling products?',
        agentMessage: 'Based on the data, SKU-001 and SKU-002 are the top sellers.',
        conversationType: 'user_to_agent',
        metadata: {
          toolsUsed: ['get_top_selling_skus'],
          executionTime: 245,
        },
      });

      expect(result.conversationId).toBeDefined();
    });

    it('should log an agent-to-reviewer conversation', async () => {
      const result = await logConversation({
        agentId: 'supply_planner',
        supervisionId: testSupervisionId,
        userMessage: 'Blank response detected',
        agentMessage: 'Guidance: Please provide a detailed answer',
        conversationType: 'agent_to_reviewer',
      });

      expect(result.conversationId).toBeDefined();
    });
  });

  describe('Querying Supervision Data', () => {
    it('should retrieve supervision logs for an agent', async () => {
      const logs = await getSupervisionLogs('demand_planner', undefined, 10);

      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThanOrEqual(0);
    });

    it('should retrieve supervision logs by response status', async () => {
      const logs = await getSupervisionLogs(undefined, 'blank', 10);

      expect(Array.isArray(logs)).toBe(true);
      // Should have at least one blank response from our test
      if (logs.length > 0) {
        expect(logs[0].responseStatus).toBe('blank');
      }
    });

    it('should retrieve guidance records for an agent', async () => {
      const guidance = await getAgentGuidanceRecords('supply_planner', false);

      expect(Array.isArray(guidance)).toBe(true);
    });

    it('should retrieve conversation history for an agent', async () => {
      const history = await getConversationHistory('demand_planner', 10);

      expect(Array.isArray(history)).toBe(true);
    });

    it('should get dashboard summary with agent stats', async () => {
      const summary = await getSupervisionDashboardSummary();

      expect(summary).toBeDefined();
      expect(summary.totalInterventions).toBeGreaterThanOrEqual(0);
      expect(summary.pendingGuidance).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(summary.agentStats)).toBe(true);

      // Verify agent stats structure
      if (summary.agentStats.length > 0) {
        const stat = summary.agentStats[0];
        expect(stat.agentId).toBeDefined();
        expect(stat.interactionCount).toBeGreaterThanOrEqual(0);
        expect(stat.blankResponses).toBeGreaterThanOrEqual(0);
        expect(stat.errorResponses).toBeGreaterThanOrEqual(0);
        expect(stat.incompleteResponses).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Complete Supervision Workflow', () => {
    it('should complete a full supervision cycle: blank response -> guidance -> resolution', async () => {
      // Step 1: Log a blank response
      const supervisionResult = await logSupervisionEvent({
        agentId: 'ops_head',
        agentName: 'Ops Head',
        question: 'What is the current supply chain status?',
        agentResponse: '', // Blank
        responseStatus: 'blank',
      });

      expect(supervisionResult.needsReview).toBe(true);
      const supervisionId = supervisionResult.supervisionId;

      // Step 2: Create guidance
      const guidanceResult = await createGuidance({
        supervisionId,
        agentId: 'ops_head',
        guidanceType: 'clarification',
        guidanceText: 'Please provide a comprehensive supply chain status report',
        guidanceAction: 'retry',
      });

      expect(guidanceResult.guidanceId).toBeDefined();
      const guidanceId = guidanceResult.guidanceId;

      // Step 3: Log the conversation
      await logConversation({
        agentId: 'ops_head',
        supervisionId,
        userMessage: 'Blank response detected',
        agentMessage: 'Guidance provided: Please provide a comprehensive supply chain status report',
        conversationType: 'agent_to_reviewer',
      });

      // Step 4: Agent responds with guidance
      const agentResponse = 'Supply chain status: All suppliers are on schedule, inventory levels are optimal, no critical issues detected.';

      // Step 5: Mark guidance as resolved
      const resolveResult = await markGuidanceResolved(guidanceId, agentResponse);

      expect(resolveResult.success).toBe(true);

      // Step 6: Verify the complete flow in dashboard
      const summary = await getSupervisionDashboardSummary();

      expect(summary.agentStats.length).toBeGreaterThan(0);
      const opsHeadStat = summary.agentStats.find((s) => s.agentId === 'ops_head');
      expect(opsHeadStat).toBeDefined();
      if (opsHeadStat) {
        expect(opsHeadStat.interactionCount).toBeGreaterThan(0);
      }
    });
  });
});
