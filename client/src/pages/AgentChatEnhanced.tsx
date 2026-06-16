import { useState, useRef, useEffect } from 'react';
import { useParams } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock, Zap, ChevronDown, ChevronRight, Square } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { ChartRenderer } from '@/components/ChartRenderer';

interface ToolCall {
  toolName: string;
  status: 'success' | 'error' | 'timeout';
  result: any;
  executionTime: number;
  error?: string;
  toolId?: string;
  input?: any;
  output?: any;
  errorMessage?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
  thinking?: string;
  executionSteps?: Array<{
    step: number;
    tool: string;
    status: 'pending' | 'running' | 'success' | 'error';
    result?: any;
    error?: string;
  }>;
  chartSpec?: any;
}

export function AgentChatEnhanced() {
  const { agentId } = useParams<{ agentId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();

  // Load chat history on mount
  const { data: historyData, isLoading: isHistoryLoading } = trpc.agentChatWithTools.getHistory.useQuery(
    { agentId: agentId || '' },
    { enabled: !!agentId }
  );

  useEffect(() => {
    if (historyData?.messages) {
      const formattedMessages: Message[] = historyData.messages.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        toolCalls: msg.metadata?.toolResults || [],
        thinking: msg.metadata?.thinking,
        executionSteps: msg.metadata?.executionSteps,
      }));
      setMessages(formattedMessages);
    }
  }, [historyData]);

  const sendMessageMutation = trpc.agentChatWithTools.sendMessage.useMutation({
    onSuccess: (result) => {
      let chartSpec: any = undefined;
      if ((result as any).toolResults && Array.isArray((result as any).toolResults)) {
        const chartResult = (result as any).toolResults.find((t: any) => t.toolName === 'generate_chart');
        if (chartResult && chartResult.result) {
          chartSpec = chartResult.result;
        }
      }

      const newMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: (result as any).response,
        toolCalls: (result as any).toolResults,
        timestamp: new Date(),
        thinking: (result as any).thinking,
        executionSteps: (result as any).executionSteps,
        chartSpec,
      };
      setMessages(prev => [...prev, newMessage]);
      setInput('');
      setIsLoading(false);
      setAbortController(null);
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      setIsLoading(false);
      setAbortController(null);
      // Add error message
      const errorMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: '❌ Error: ' + (error instanceof Error ? error.message : 'Unknown error'),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    },
  });

  const handleSendMessage = async () => {
    if (!input.trim() || !agentId) return;

    // Add user message
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    setIsLoading(true);
    const controller = new AbortController();
    setAbortController(controller);

    try {
      await sendMessageMutation.mutateAsync({
        agentId,
        agentName: agentId || 'agent',
        message: input,
      });
    } catch (error) {
      if (error instanceof Error && error.message !== 'Aborted') {
        console.error('Error:', error);
      }
    }
  };

  const handleStop = () => {
    if (abortController) {
      abortController.abort();
      setIsLoading(false);
      setAbortController(null);

      // Add a system message indicating cancellation
      const cancelMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: '⏹️ Request cancelled by user',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, cancelMessage]);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isHistoryLoading && messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Spinner className="w-8 h-8 mx-auto mb-2" />
          <p className="text-muted-foreground">Loading chat history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Agent Chat</h1>
        <p className="text-muted-foreground">Interact with AI agents using tools</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-4">
        {messages.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-12 text-center">
                <div>
                  <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Start a conversation with the agent</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="space-y-2">
              {/* Message */}
              <div
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-2xl px-4 py-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <Streamdown>{message.content}</Streamdown>
                  ) : (
                    <p>{message.content}</p>
                  )}
                </div>
              </div>

              {/* Thinking Section */}
              {message.thinking && (
                <ThinkingSection thinking={message.thinking} />
              )}

              {/* Execution Steps */}
              {message.executionSteps && message.executionSteps.length > 0 && (
                <ExecutionStepsSection steps={message.executionSteps} />
              )}

              {/* Chart Rendering */}
              {message.chartSpec && (
                <ChartRenderer spec={message.chartSpec} height={350} />
              )}

              {/* Tool Calls */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="space-y-2 pl-4">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Tools Used ({message.toolCalls.length})
                  </p>
                  {message.toolCalls?.map((toolCall, idx) => (
                    <ToolCallCard key={idx} toolCall={toolCall} />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          placeholder="Ask the agent something..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (isLoading) {
                handleStop();
              } else {
                handleSendMessage();
              }
            }
          }}
          disabled={isLoading}
        />
        {isLoading ? (
          <Button
            onClick={handleStop}
            variant="destructive"
            className="gap-2"
          >
            <Square className="w-4 h-4 fill-current" />
            Stop
          </Button>
        ) : (
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim()}
          >
            Send
          </Button>
        )}
      </div>
    </div>
  );
}

function ThinkingSection({ thinking }: { thinking: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
      <div className="px-4 py-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 w-full text-left hover:opacity-75 transition-opacity"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          )}
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            💭 LLM Thinking
          </span>
        </button>

        {isExpanded && (
          <div className="mt-3 pl-6 text-sm text-blue-700 dark:text-blue-300 whitespace-pre-wrap">
            {thinking}
          </div>
        )}
      </div>
    </Card>
  );
}

function ExecutionStepsSection({
  steps,
}: {
  steps: Array<{
    step: number;
    tool: string;
    status: 'pending' | 'running' | 'success' | 'error';
    result?: any;
    error?: string;
  }>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusIcon = {
    pending: <Clock className="w-4 h-4 text-gray-400" />,
    running: <Spinner className="w-4 h-4 text-blue-500" />,
    success: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    error: <AlertCircle className="w-4 h-4 text-red-500" />,
  };

  return (
    <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
      <div className="px-4 py-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 w-full text-left hover:opacity-75 transition-opacity"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          )}
          <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
            ⚙️ Execution Steps ({steps.length})
          </span>
        </button>

        {isExpanded && (
          <div className="mt-3 space-y-2 pl-6">
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-3 text-sm">
                <div className="flex-shrink-0 mt-0.5">
                  {statusIcon[step.status]}
                </div>
            <div className="flex-1">
              <div className="font-medium text-amber-900 dark:text-amber-100">
                Step {step.step}: {step.tool}
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-300 capitalize">
                {step.status}
              </div>
              {step.error && (
                <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Error: {step.error}
                </div>
              )}
              {step.result && (
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-1 max-h-20 overflow-auto">
                  <pre className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded mt-1 text-xs overflow-x-auto">
                    {JSON.stringify(step.result, null, 2).substring(0, 200)}
                    {JSON.stringify(step.result, null, 2).length > 200 ? '...' : ''}
                  </pre>
                </div>
              )}
            </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function ToolCallCard({ toolCall }: { toolCall: ToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusIcon = {
    success: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    error: <AlertCircle className="w-4 h-4 text-red-500" />,
    timeout: <Clock className="w-4 h-4 text-yellow-500" />,
  }[toolCall.status];

  return (
    <Card className="bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            {statusIcon}
            <div className="flex-1">
              <CardTitle className="text-sm">{toolCall.toolName}</CardTitle>
              {toolCall.toolId && (
                <CardDescription className="text-xs">
                  {toolCall.toolId}
                </CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {toolCall.executionTime}ms
            </Badge>
            <Badge
              variant={toolCall.status === 'success' ? 'default' : 'destructive'}
              className="text-xs"
            >
              {toolCall.status}
            </Badge>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-3">
          {/* Input */}
          {toolCall.input && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                Input
              </p>
              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                {JSON.stringify(toolCall.input, null, 2)}
              </pre>
            </div>
          )}

          {/* Output/Result */}
          {(toolCall.output || toolCall.result) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                Result
              </p>
              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                {JSON.stringify(toolCall.output || toolCall.result, null, 2)}
              </pre>
            </div>
          )}

          {/* Error */}
          {(toolCall.errorMessage || toolCall.error) && (
            <div>
              <p className="text-xs font-semibold text-red-600 mb-1">
                Error
              </p>
              <p className="text-xs text-red-500">{toolCall.errorMessage || toolCall.error}</p>
            </div>
          )}
        </CardContent>
      )}

      <div className="px-4 py-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-xs"
        >
          {isExpanded ? 'Hide Details' : 'Show Details'}
        </Button>
      </div>
    </Card>
  );
}
