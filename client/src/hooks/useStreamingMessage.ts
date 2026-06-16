import { useCallback, useRef } from 'react';

export interface StreamEvent {
  type: 'thinking' | 'execution_step' | 'tool_result' | 'response' | 'complete' | 'error';
  data: any;
  timestamp: number;
}

export interface StreamingState {
  thinking: string;
  executionSteps: Array<{
    step: number;
    tool: string;
    status: 'pending' | 'running' | 'success' | 'error';
    result?: any;
    error?: string;
  }>;
  response: string;
  isComplete: boolean;
  error?: string;
}

export function useStreamingMessage() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const streamMessage = useCallback(
    async (
      agentId: string,
      agentName: string,
      message: string,
      onStateUpdate: (state: Partial<StreamingState>) => void,
      onEvent?: (event: StreamEvent) => void
    ) => {
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/trpc/agentChatWithTools.sendMessageStream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agentId,
            agentName,
            message,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event: StreamEvent = JSON.parse(line.slice(6));
                onEvent?.(event);

                switch (event.type) {
                  case 'thinking':
                    onStateUpdate({ thinking: event.data.thinking });
                    break;
                  case 'execution_step':
                    onStateUpdate({
                      executionSteps: [
                        event.data,
                      ],
                    });
                    break;
                  case 'response':
                    onStateUpdate({ response: event.data.response });
                    break;
                  case 'complete':
                    onStateUpdate({ isComplete: true });
                    break;
                  case 'error':
                    onStateUpdate({ error: event.data.error, isComplete: true });
                    break;
                }
              } catch (e) {
                console.error('Failed to parse SSE event:', e);
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          onStateUpdate({
            error: error.message,
            isComplete: true,
          });
        }
      }
    },
    []
  );

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return { streamMessage, abort };
}
