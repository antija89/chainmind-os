import { invokeLLM, listLLMModels } from './_core/llm';

async function main() {
  console.log('=== Testing LLM API ===');
  
  // List models
  try {
    const models = await listLLMModels();
    const ids = models.data?.slice(0, 8).map((m: any) => m.id);
    console.log('Available models:', ids);
  } catch (e: any) {
    console.log('listLLMModels error:', e.message);
  }

  // Simple call without tools
  try {
    const res = await invokeLLM({
      messages: [{ role: 'user', content: 'Say hello in one sentence.' }]
    });
    console.log('Simple response:', JSON.stringify(res?.choices?.[0]?.message));
    console.log('Finish reason:', res?.choices?.[0]?.finish_reason);
  } catch (e: any) {
    console.log('Simple call error:', e.message);
  }

  // Call with tools
  try {
    const res = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are a supply chain assistant. Always use tools when asked about data.' },
        { role: 'user', content: 'Tell me top 3 SKUs by sales.' }
      ],
      tools: [{
        type: 'function' as const,
        function: {
          name: 'get_top_selling_skus',
          description: 'Get top selling SKUs by sales volume',
          parameters: {
            type: 'object',
            properties: { limit: { type: 'number', description: 'Number of SKUs' } }
          }
        }
      }],
      tool_choice: 'auto'
    });
    console.log('Tool call response:', JSON.stringify(res?.choices?.[0]?.message));
    console.log('Finish reason:', res?.choices?.[0]?.finish_reason);
    console.log('Full response keys:', Object.keys(res || {}));
  } catch (e: any) {
    console.log('Tool call error:', e.message);
  }
}
main().catch(console.error);
