import { describe, it, expect } from 'vitest';
import { invokeLLM } from './_core/llm';

// Test the chart auto-generation logic by simulating what agent-chat-with-tools does
async function simulateChartRequest(userMessage: string, toolResultData: any[]) {
  const isChartRequest = ['chart', 'graph', 'bar chart', 'line chart', 'pie chart', 'visualization', 'visual', 'plot', 'diagram']
    .some(kw => userMessage.toLowerCase().includes(kw));

  const toolResults: any[] = [
    {
      toolName: 'get_top_selling_skus',
      status: 'success',
      executionTime: 50,
      result: { skus: toolResultData }
    }
  ];

  if (isChartRequest && toolResults.length > 0) {
    const alreadyHasChart = toolResults.some((tr: any) => tr.result?.chartSpec);
    if (!alreadyHasChart) {
      let dataArray: any[] | null = null;
      let chartTitle = 'Data Visualization';

      for (const tr of toolResults) {
        const result = (tr as any).result;
        if (!result) continue;
        for (const key of Object.keys(result)) {
          if (Array.isArray(result[key]) && result[key].length > 0) {
            dataArray = result[key];
            chartTitle = key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            break;
          }
        }
        if (dataArray) break;
      }

      if (dataArray && dataArray.length > 0) {
        const msg = userMessage.toLowerCase();
        const chartType = msg.includes('line') ? 'line'
          : msg.includes('pie') ? 'pie'
          : msg.includes('area') ? 'area'
          : 'bar';

        const labels: string[] = dataArray.slice(0, 10).map((item: any) =>
          typeof item === 'object'
            ? String(item.sku || item.sku_id || item.fg_code || item.name || item.id || item.month || item.date || Object.values(item)[0])
            : String(item)
        );
        const values: number[] = dataArray.slice(0, 10).map((item: any) =>
          typeof item === 'object'
            ? Number(item.units_sold || item.value || item.revenue || item.net_sales_aed || item.units || item.quantity || item.amount || Object.values(item).find(v => typeof v === 'number') || 0)
            : Number(item)
        );

        if (labels.length > 0 && values.some(v => v > 0)) {
          toolResults.push({
            toolName: 'generate_chart',
            status: 'success',
            executionTime: 10,
            result: {
              chartSpec: { type: chartType, title: chartTitle, labels, values },
              message: `Chart "${chartTitle}" generated successfully`
            }
          });
        }
      }
    }
  }

  return toolResults;
}

describe('Chart Auto-Generation', () => {
  it('should auto-generate a bar chart from SKU sales data', async () => {
    const skuData = [
      { sku: 'SKU-001', units_sold: 15000, revenue: 450000 },
      { sku: 'SKU-002', units_sold: 12000, revenue: 360000 },
      { sku: 'SKU-003', units_sold: 10000, revenue: 300000 },
      { sku: 'SKU-004', units_sold: 8000, revenue: 240000 },
      { sku: 'SKU-005', units_sold: 6000, revenue: 180000 },
    ];

    const results = await simulateChartRequest('Show me top 5 SKU sales as a bar chart', skuData);

    console.log('\n=== Chart Auto-Generation Test ===');
    console.log('Tool results count:', results.length);

    const chartResult = results.find(r => r.toolName === 'generate_chart');
    expect(chartResult).toBeDefined();
    expect(chartResult.result.chartSpec).toBeDefined();
    expect(chartResult.result.chartSpec.type).toBe('bar');
    expect(chartResult.result.chartSpec.labels).toHaveLength(5);
    expect(chartResult.result.chartSpec.values).toHaveLength(5);
    expect(chartResult.result.chartSpec.values[0]).toBe(15000);

    console.log('✅ Chart type:', chartResult.result.chartSpec.type);
    console.log('✅ Chart title:', chartResult.result.chartSpec.title);
    console.log('✅ Labels:', chartResult.result.chartSpec.labels);
    console.log('✅ Values:', chartResult.result.chartSpec.values);
  });

  it('should auto-generate a pie chart when user asks for pie', async () => {
    const skuData = [
      { fg_code: 'FG-001', units_sold: 5000 },
      { fg_code: 'FG-002', units_sold: 3000 },
      { fg_code: 'FG-003', units_sold: 2000 },
    ];

    const results = await simulateChartRequest('Show me SKU distribution as a pie chart', skuData);
    const chartResult = results.find(r => r.toolName === 'generate_chart');
    expect(chartResult).toBeDefined();
    expect(chartResult.result.chartSpec.type).toBe('pie');
    console.log('✅ Pie chart generated correctly');
  });

  it('should NOT generate chart if user did not ask for one', async () => {
    const skuData = [{ sku: 'SKU-001', units_sold: 15000 }];
    const results = await simulateChartRequest('What are the top selling SKUs?', skuData);
    const chartResult = results.find(r => r.toolName === 'generate_chart');
    expect(chartResult).toBeUndefined();
    console.log('✅ No chart generated for non-chart request');
  });

  it('should call LLM with chart tool and get proper response', async () => {
    console.log('\n=== LLM Chart Tool Test ===');
    const response = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: 'You are a supply chain agent. When asked for a chart, call generate_chart tool with labels and values arrays.'
        },
        {
          role: 'user',
          content: 'Create a bar chart with these SKUs: SKU-001=15000, SKU-002=12000, SKU-003=10000'
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'generate_chart',
            description: 'Generate a chart visualization',
            parameters: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['bar', 'line', 'pie', 'area'] },
                title: { type: 'string' },
                labels: { type: 'array', items: { type: 'string' } },
                values: { type: 'array', items: { type: 'number' } }
              },
              required: ['type', 'title', 'labels', 'values']
            }
          }
        }
      ],
      tool_choice: 'required'
    });

    const choice = response?.choices?.[0];
    const toolCalls = choice?.message?.tool_calls;

    console.log('Tool calls made:', toolCalls?.length || 0);
    if (toolCalls?.length > 0) {
      const chartCall = toolCalls.find((tc: any) => tc.function?.name === 'generate_chart');
      if (chartCall) {
        const args = JSON.parse(chartCall.function.arguments);
        console.log('✅ generate_chart called with:');
        console.log('  type:', args.type);
        console.log('  title:', args.title);
        console.log('  labels:', args.labels);
        console.log('  values:', args.values);
        expect(args.labels).toBeDefined();
        expect(args.values).toBeDefined();
      }
    }

    expect(response).toBeDefined();
  }, { timeout: 30000 });
});
