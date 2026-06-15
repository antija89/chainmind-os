import { describe, it, expect } from 'vitest';
import { invokeLLM } from './server/_core/llm';

describe('Debug LLM Chart Request - Multi-Turn Workflow', () => {
  it('should call generate_chart in follow-up after getting data', async () => {
    const systemPrompt = `You are the Demand Planner agent. Your role is to analyze sales trends, forecast demand, and identify market opportunities.

CRITICAL: When user asks for a chart/graph/visualization, ALWAYS call the generate_chart tool. Do NOT refuse or say you cannot create charts.

Available tools:
- generate_chart: Generate a chart or visualization from data
- get_top_selling_skus: Get top selling SKUs by units and revenue
- forecast_demand_by_sku: Forecast demand for a specific SKU

When asked for a chart:
1. First call get_top_selling_skus to get data
2. Then call generate_chart with the data`;

    const tools = [
      {
        type: 'function',
        function: {
          name: 'get_top_selling_skus',
          description: 'Get top selling SKUs by units and revenue',
          parameters: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Number of top SKUs to return' },
            },
            required: ['limit'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'generate_chart',
          description: 'Generate a chart or visualization from data. ALWAYS use this when user asks for a chart, graph, or visual representation.',
          parameters: {
            type: 'object',
            properties: {
              chart_type: { type: 'string', enum: ['bar', 'line', 'pie', 'area', 'scatter'], description: 'Type of chart to generate' },
              title: { type: 'string', description: 'Chart title' },
              labels: { type: 'array', items: { type: 'string' }, description: 'X-axis labels or category names' },
              values: { type: 'array', items: { type: 'number' }, description: 'Data values corresponding to labels' },
              x_label: { type: 'string', description: 'X-axis label' },
              y_label: { type: 'string', description: 'Y-axis label' },
            },
            required: ['chart_type', 'title', 'labels', 'values'],
          },
        },
      },
    ];

    // Step 1: First LLM call - agent decides to call get_top_selling_skus
    console.log('\n=== Step 1: First LLM Call ===');
    const response1 = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Show me top 5 SKU sales as a bar chart' },
      ],
      tools: tools as any,
      tool_choice: 'auto',
    });

    const toolCalls1 = response1?.choices?.[0]?.message?.tool_calls || [];
    console.log('Tool calls:', toolCalls1.map((tc: any) => tc.function?.name));
    expect(toolCalls1.length).toBeGreaterThan(0);
    expect(toolCalls1[0].function?.name).toBe('get_top_selling_skus');

    // Step 2: Simulate tool result
    const mockToolResult = {
      skus: [
        { fg_code: 'SKU-001', fg_description: 'Product A', total_units: 15000, total_revenue: 450000 },
        { fg_code: 'SKU-002', fg_description: 'Product B', total_units: 12000, total_revenue: 360000 },
        { fg_code: 'SKU-003', fg_description: 'Product C', total_units: 10000, total_revenue: 300000 },
        { fg_code: 'SKU-004', fg_description: 'Product D', total_units: 8000, total_revenue: 240000 },
        { fg_code: 'SKU-005', fg_description: 'Product E', total_units: 6000, total_revenue: 180000 },
      ],
    };

    // Step 3: Second LLM call - agent sees the data and should call generate_chart
    console.log('\n=== Step 2: Second LLM Call (Follow-up) ===');
    const response2 = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Show me top 5 SKU sales as a bar chart' },
        {\n          role: 'assistant',\n          content: 'I will get the top selling SKUs and create a chart for you.',\n          tool_calls: toolCalls1,\n        },
        {
          role: 'tool',
          tool_call_id: toolCalls1[0].id,
          content: JSON.stringify(mockToolResult),
        },
      ],
      tools: tools as any,
      tool_choice: 'auto',
    });

    const toolCalls2 = response2?.choices?.[0]?.message?.tool_calls || [];
    const content2 = response2?.choices?.[0]?.message?.content;
    console.log('Content:', content2);
    console.log('Tool calls:', toolCalls2.map((tc: any) => tc.function?.name));

    // Verify the second call includes generate_chart
    const hasChartTool = toolCalls2.some((tc: any) => tc.function?.name === 'generate_chart');
    console.log('Has generate_chart tool call:', hasChartTool);
    
    if (hasChartTool) {
      const chartCall = toolCalls2.find((tc: any) => tc.function?.name === 'generate_chart');
      const chartArgs = JSON.parse(chartCall.function?.arguments || '{}');
      console.log('Chart args:', chartArgs);
      expect(chartArgs.chart_type).toBe('bar');
      expect(chartArgs.title).toBeTruthy();
      expect(chartArgs.labels.length).toBeGreaterThan(0);
      expect(chartArgs.values.length).toBeGreaterThan(0);
    }

    expect(hasChartTool).toBe(true);
  });
});
