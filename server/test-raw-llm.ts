import { ENV } from './_core/env';

async function main() {
  const url = `${ENV.forgeApiUrl?.replace(/\/$/, '') || 'https://forge.manus.im'}/v1/chat/completions`;
  console.log('API URL:', url);
  console.log('API Key present:', !!ENV.forgeApiKey, 'length:', ENV.forgeApiKey?.length);

  const payload = {
    messages: [
      { role: 'system', content: 'You are a supply chain AI. Answer directly.' },
      { role: 'user', content: 'tell me top 3 skus by sales' }
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_top_selling_skus',
          description: 'Get top selling SKUs by units sold from sales history data',
          parameters: { type: 'object', properties: { limit: { type: 'number' } } }
        }
      }
    ],
    tool_choice: 'auto'
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${ENV.forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });

  console.log('HTTP Status:', response.status, response.statusText);
  const text = await response.text();
  console.log('Raw response (first 1000 chars):', text.substring(0, 1000));
  
  try {
    const json = JSON.parse(text);
    console.log('Parsed choices:', JSON.stringify(json.choices, null, 2));
    console.log('Model:', json.model);
    console.log('Usage:', json.usage);
  } catch (e) {
    console.log('Not valid JSON');
  }
}

main().catch(console.error);
