import { Response } from 'express';

export interface StreamEvent {
  type: 'thinking' | 'execution_step' | 'tool_result' | 'response' | 'complete' | 'error';
  data: any;
  timestamp: number;
}

/**
 * Send SSE (Server-Sent Events) response
 * Allows real-time streaming of thinking, execution steps, and results
 */
export function sendSSEEvent(res: Response, event: StreamEvent) {
  const eventData = `data: ${JSON.stringify(event)}\n\n`;
  res.write(eventData);
}

/**
 * Initialize SSE response headers
 */
export function initSSEResponse(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
}

/**
 * Close SSE connection
 */
export function closeSSEResponse(res: Response) {
  res.end();
}

/**
 * Stream thinking event
 */
export function streamThinking(res: Response, thinking: string) {
  sendSSEEvent(res, {
    type: 'thinking',
    data: { thinking },
    timestamp: Date.now(),
  });
}

/**
 * Stream execution step event
 */
export function streamExecutionStep(
  res: Response,
  step: number,
  tool: string,
  status: 'pending' | 'running' | 'success' | 'error',
  result?: any,
  error?: string
) {
  sendSSEEvent(res, {
    type: 'execution_step',
    data: { step, tool, status, result, error },
    timestamp: Date.now(),
  });
}

/**
 * Stream tool result event
 */
export function streamToolResult(res: Response, toolName: string, result: any) {
  sendSSEEvent(res, {
    type: 'tool_result',
    data: { toolName, result },
    timestamp: Date.now(),
  });
}

/**
 * Stream final response
 */
export function streamResponse(res: Response, response: string) {
  sendSSEEvent(res, {
    type: 'response',
    data: { response },
    timestamp: Date.now(),
  });
}

/**
 * Stream completion event
 */
export function streamComplete(res: Response, metadata?: any) {
  sendSSEEvent(res, {
    type: 'complete',
    data: metadata || {},
    timestamp: Date.now(),
  });
}

/**
 * Stream error event
 */
export function streamError(res: Response, error: string) {
  sendSSEEvent(res, {
    type: 'error',
    data: { error },
    timestamp: Date.now(),
  });
}
