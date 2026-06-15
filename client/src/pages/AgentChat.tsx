import { useState, useRef, useEffect } from 'react';
import { useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, RotateCcw, Bot, User, Wrench } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';

const AGENTS: Record<string, { name: string; icon: string; color: string; description: string; badge: string }> = {
  demand_planner: {
    name: 'Demand Planner',
    icon: '📊',
    color: 'bg-blue-100 text-blue-800',
    description: 'Analyzes sales trends, forecasts demand, and identifies market opportunities',
    badge: 'Demand',
  },
  supply_planner: {
    name: 'Supply Planner',
    icon: '📦',
    color: 'bg-green-100 text-green-800',
    description: 'Optimizes inventory levels, manages supply balance, and prevents stockouts',
    badge: 'Supply',
  },
  production_planner: {
    name: 'Production Planner',
    icon: '🏭',
    color: 'bg-orange-100 text-orange-800',
    description: 'Schedules production runs, optimizes capacity, and minimizes lead times',
    badge: 'Production',
  },
  procurement_planner: {
    name: 'Procurement Planner',
    icon: '🤝',
    color: 'bg-yellow-100 text-yellow-800',
    description: 'Manages purchase orders, supplier relationships, and procurement costs',
    badge: 'Procurement',
  },
  ops_head: {
    name: 'Ops Head',
    icon: '🎯',
    color: 'bg-purple-100 text-purple-800',
    description: 'Oversees end-to-end supply chain, manages KPIs, and drives operational excellence',
    badge: 'Operations',
  },
};

const QUICK_PROMPTS: Record<string, string[]> = {
  demand_planner: [
    'Which is our top selling SKU?',
    'Show me the demand forecast summary',
    'What are the sales trends?',
  ],
  supply_planner: [
    'What is our current inventory status?',
    'Which items are at risk of stockout?',
    'Show me open purchase orders',
  ],
  production_planner: [
    'What inventory is available for production?',
    'Which SKUs need production scheduling?',
    'Show me forecast vs inventory gaps',
  ],
  procurement_planner: [
    'List all open purchase orders',
    'Which suppliers have the longest lead times?',
    'Show me PO value by supplier',
  ],
  ops_head: [
    'Give me a full supply chain health summary',
    'What are the top risks this week?',
    'Show me KPI performance vs targets',
  ],
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
  toolsUsed?: string[];
  contentType?: 'text' | 'table' | 'chart' | 'image' | 'mixed';
};

export default function AgentChat() {
  const [, params] = useRoute('/agent/:agentId');
  const agentId = params?.agentId ?? 'demand_planner';
  const agent = AGENTS[agentId] ?? AGENTS['demand_planner'];
  const quickPrompts = QUICK_PROMPTS[agentId] ?? QUICK_PROMPTS['demand_planner'];

  const makeWelcome = (a: typeof agent): Message => ({
    id: 'welcome',
    role: 'assistant',
    content: `Hello! I'm your **${a.name}**.\n\n${a.description}.\n\nI have access to your live supply chain data — inventory, sales history, forecasts, purchase orders, and supplier information. Ask me anything or pick a quick prompt below.`,
    timestamp: new Date(),
    contentType: 'text',
  });

  const [messages, setMessages] = useState<Message[]>([makeWelcome(agent)]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([makeWelcome(agent)]);
    setInput('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Detect content type from response
  const detectContentType = (content: string): Message['contentType'] => {
    const hasTable = /^\s*\|.*\|.*\|/m.test(content);
    const hasChart = /```(chart|mermaid|plotly|vega)/i.test(content);
    const hasImage = /!\[.*?\]\(.*?\)/g.test(content);
    
    if (hasTable && hasChart && hasImage) return 'mixed';
    if (hasTable) return 'table';
    if (hasChart) return 'chart';
    if (hasImage) return 'image';
    return 'text';
  };

  const sendMessage = trpc.agents.sendMessage.useMutation({
    onSuccess: (data) => {
      const content = typeof data.message === 'string' ? data.message : String(data.message);
      const contentType = detectContentType(content);
      
      setMessages(prev => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant' as const,
          content,
          timestamp: new Date(),
          isError: !data.success,
          toolsUsed: data.toolsUsed ?? [],
          contentType,
        },
      ]);
    },
    onError: (err) => {
      toast.error('Failed to get response. Check Settings → LLM configuration.');
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Error:** ${err.message}\n\nPlease go to **Settings** in the sidebar and configure your LLM provider (Gemini, OpenAI, or Anthropic).`,
          timestamp: new Date(),
          isError: true,
          contentType: 'text',
        },
      ]);
    },
  });

  const handleSend = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sendMessage.isPending) return;

    setMessages(prev => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: msg, timestamp: new Date(), contentType: 'text' },
    ]);
    setInput('');

    sendMessage.mutate({ agentId, agentName: agent.name, message: msg });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleClear = () => {
    setMessages([makeWelcome(agent)]);
  };

  const showQuickPrompts = messages.length <= 1;

  return (
    <div className="flex flex-col h-[calc(100vh-130px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{agent.icon}</span>
          <div>
            <h1 className="text-xl font-bold">{agent.name}</h1>
            <p className="text-sm text-muted-foreground max-w-md">{agent.description}</p>
          </div>
          <Badge className={agent.color}>{agent.badge}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={handleClear} className="gap-2">
          <RotateCcw className="h-3.5 w-3.5" /> Clear
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 pr-2">
        <div className="space-y-4 pb-2">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <Avatar className="h-8 w-8 shrink-0 mt-1">
                <AvatarFallback className={msg.role === 'assistant' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}>
                  {msg.role === 'assistant' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm overflow-hidden ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : msg.isError
                  ? 'bg-red-50 border border-red-200 text-red-900 rounded-tl-sm'
                  : 'bg-white border border-gray-200 text-gray-900 rounded-tl-sm'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="w-full prose prose-sm dark:prose-invert max-w-none 
                    prose-headings:text-gray-900 prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2
                    prose-p:text-gray-800 prose-p:my-2
                    prose-table:border-collapse prose-table:w-full prose-table:my-4
                    prose-td:border prose-td:border-gray-300 prose-td:px-3 prose-td:py-2 prose-td:text-left
                    prose-th:border prose-th:border-gray-300 prose-th:px-3 prose-th:py-2 prose-th:bg-gray-100 prose-th:font-bold
                    prose-img:max-w-full prose-img:h-auto prose-img:rounded prose-img:my-4
                    prose-code:bg-gray-100 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-red-600
                    prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded prose-pre:overflow-x-auto
                    prose-strong:text-gray-900 prose-strong:font-bold
                    prose-em:text-gray-700
                    prose-a:text-blue-600 prose-a:underline
                    prose-li:my-1
                    prose-ul:my-2 prose-ul:pl-4
                    prose-ol:my-2 prose-ol:pl-4
                    prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic
                  ">
                    <Streamdown>{msg.content}</Streamdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                )}
                
                {/* Content Type Badge */}
                {msg.contentType && msg.contentType !== 'text' && msg.role === 'assistant' && (
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                    <span>
                      {msg.contentType === 'table' && '📊 Table'}
                      {msg.contentType === 'chart' && '📈 Chart'}
                      {msg.contentType === 'image' && '🖼️ Image'}
                      {msg.contentType === 'mixed' && '🎨 Mixed Content'}
                    </span>
                  </div>
                )}
                
                {/* Tools Used */}
                {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-200">
                    <Wrench className="h-3 w-3 text-gray-400 mt-0.5 shrink-0" />
                    {msg.toolsUsed.map((t) => (
                      <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">{t}</span>
                    ))}
                  </div>
                )}
                
                {/* Timestamp */}
                <p className={`text-xs mt-2 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {sendMessage.isPending && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0 mt-1">
                <AvatarFallback className="bg-blue-100 text-blue-700">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 text-sm text-gray-500 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span>Querying your supply chain data…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Quick prompts */}
      {showQuickPrompts && (
        <div className="flex flex-wrap gap-2 py-3 border-t shrink-0">
          <span className="text-xs text-muted-foreground self-center mr-1">Try:</span>
          {quickPrompts.map((p) => (
            <button
              key={p}
              onClick={() => handleSend(p)}
              className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 pt-3 shrink-0">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ask ${agent.name} anything about your supply chain…`}
          className="resize-none min-h-[56px] max-h-[120px]"
          rows={2}
          disabled={sendMessage.isPending}
        />
        <Button
          onClick={() => handleSend()}
          disabled={!input.trim() || sendMessage.isPending}
          className="self-end h-[56px] px-5"
        >
          {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5 text-center shrink-0">
        Enter to send · Shift+Enter for new line · Responses grounded in your live data
      </p>
    </div>
  );
}
