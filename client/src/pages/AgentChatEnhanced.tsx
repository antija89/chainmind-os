import { useState, useRef, useEffect } from 'react';
import { useParams } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Clock, Zap } from 'lucide-react';
import { Streamdown } from 'streamdown';

interface ToolCall {
  toolId: string;
  toolName: string;
  input: any;
  output: any;
  executionTime: number;
  status: 'success' | 'error' | 'timeout';
  errorMessage?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
}

export function AgentChatEnhanced() {
  const { agentId } = useParams<{ agentId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const sendMessageMutation = trpc.agents.sendMessage.useMutation({
    onSuccess: (result) => {
      const newMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: result.message || '',
        toolCalls: [],
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
      setInput('');
      setIsLoading(false);
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      setIsLoading(false);
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
    await sendMessageMutation.mutateAsync({
      agentId,
      agentName: agentId || 'agent',
      message: input,
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
                  className={`max-w-md px-4 py-3 rounded-lg ${
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

              {/* Tool Calls */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="space-y-2 pl-4">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Tools Used ({message.toolCalls.length})
                  </p>
                  {message.toolCalls.map((toolCall, idx) => (
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
              handleSendMessage();
            }
          }}
          disabled={isLoading}
        />
        <Button
          onClick={handleSendMessage}
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? <Spinner className="w-4 h-4" /> : 'Send'}
        </Button>
      </div>
    </div>
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
              <CardDescription className="text-xs">
                {toolCall.toolId}
              </CardDescription>
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
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">
              Input
            </p>
            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
              {JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>

          {/* Output */}
          {toolCall.output && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                Output
              </p>
              <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                {JSON.stringify(toolCall.output, null, 2)}
              </pre>
            </div>
          )}

          {/* Error */}
          {toolCall.errorMessage && (
            <div>
              <p className="text-xs font-semibold text-red-600 mb-1">
                Error
              </p>
              <p className="text-xs text-red-500">{toolCall.errorMessage}</p>
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
