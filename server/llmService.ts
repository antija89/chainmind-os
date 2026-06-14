import { invokeLLM } from './_core/llm';

export interface LLMConfig {
  provider: 'gemini' | 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  apiUrl?: string;
  model: string;
}

// Store config in memory (in production, use database)
let llmConfig: LLMConfig | null = null;

export function setLLMConfig(config: LLMConfig) {
  llmConfig = config;
  console.log(`[LLM] Configured provider: ${config.provider}, model: ${config.model}`);
}

export function getLLMConfig(): LLMConfig | null {
  return llmConfig;
}

export async function callLLM(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  systemPrompt?: string
): Promise<string> {
  if (!llmConfig) {
    console.warn('[LLM] No LLM config set, using default Manus LLM');
    // Fall back to Manus built-in LLM
    return callMausLLM(messages, systemPrompt);
  }

  const config = llmConfig;

  try {
    if (config.provider === 'gemini') {
      return await callGeminiLLM(messages, config, systemPrompt);
    } else if (config.provider === 'openai') {
      return await callOpenAILLM(messages, config, systemPrompt);
    } else if (config.provider === 'anthropic') {
      return await callAnthropicLLM(messages, config, systemPrompt);
    } else if (config.provider === 'custom') {
      return await callCustomLLM(messages, config, systemPrompt);
    }
  } catch (error) {
    console.error(`[LLM] Error calling ${config.provider}:`, error);
    // Fall back to Manus LLM
    return callMausLLM(messages, systemPrompt);
  }

  return 'Unable to generate response';
}

async function callMausLLM(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  systemPrompt?: string
): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...messages]
        : messages,
    });
    const content = response.choices[0]?.message?.content;
    return typeof content === 'string' ? content : 'No response';
  } catch (error) {
    console.error('[LLM] Manus LLM error:', error);
    return 'Error generating response';
  }
}

async function callGeminiLLM(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  config: LLMConfig,
  systemPrompt?: string
): Promise<string> {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + config.model + ':generateContent';

  const requestBody = {
    contents: messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    })),
    systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text || 'No response';
}

async function callOpenAILLM(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  config: LLMConfig,
  systemPrompt?: string
): Promise<string> {
  const url = 'https://api.openai.com/v1/chat/completions';

  const requestBody = {
    model: config.model,
    messages: systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages,
    temperature: 0.7,
    max_tokens: 1000,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : 'No response';
}

async function callAnthropicLLM(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  config: LLMConfig,
  systemPrompt?: string
): Promise<string> {
  const url = 'https://api.anthropic.com/v1/messages';

  const requestBody = {
    model: config.model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${error}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  return text || 'No response';
}

async function callCustomLLM(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  config: LLMConfig,
  systemPrompt?: string
): Promise<string> {
  if (!config.apiUrl) {
    throw new Error('Custom LLM requires apiUrl');
  }

  const requestBody = {
    model: config.model,
    messages: systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages,
  };

  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Custom LLM API error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || data.content?.[0]?.text;
  return typeof content === 'string' ? content : 'No response';
}
