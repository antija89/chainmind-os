import { useState, useRef, useEffect } from 'react';
import { useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, RotateCcw, Bot, User, Wrench, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ─── Agent config ─────────────────────────────────────────────────────────────

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
    'Show me top 5 selling SKUs as a bar chart',
    'What is the demand forecast for next 3 months?',
    'Which SKUs have the highest revenue?',
  ],
  supply_planner: [
    'What is our current inventory status?',
    'Show inventory levels as a chart',
    'Which items are at risk of stockout?',
  ],
  production_planner: [
    'Show capacity utilization as a chart',
    'Which SKUs need production scheduling?',
    'Show forecast vs inventory gaps',
  ],
  procurement_planner: [
    'List all open purchase orders',
    'Show supplier performance as a chart',
    'Which suppliers have the longest lead times?',
  ],
  ops_head: [
    'Show me KPI dashboard as charts',
    'What are the top risks this week?',
    'Give me a full supply chain health summary',
  ],
};

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

// ─── Chart renderer ───────────────────────────────────────────────────────────

interface ChartSpec {
  type: 'bar' | 'line' | 'pie' | 'area' | 'scatter';
  title: string;
  labels: string[];
  values: number[];
  xLabel?: string;
  yLabel?: string;
  dataset?: Array<{ name: string; values: number[] }>;
  renderAs?: 'chart';
}

function InlineChart({ spec }: { spec: ChartSpec }) {
  // Build recharts data array
  const data = spec.labels.map((label, i) => {
    const point: Record<string, any> = { name: label, value: spec.values?.[i] ?? 0 };
    if (spec.dataset) {
      spec.dataset.forEach(ds => {
        point[ds.name] = ds.values?.[i] ?? 0;
      });
    }
    return point;
  });

  const pieData = spec.labels.map((label, i) => ({
    name: label,
    value: spec.values?.[i] ?? 0,
  }));

  return (
    <div className="my-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
      <h4 className="text-sm font-semibold text-gray-700 mb-3 text-center">{spec.title}</h4>
      <ResponsiveContainer width="100%" height={260}>
        {spec.type === 'pie' ? (
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {pieData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => v.toLocaleString()} />
            <Legend />
          </PieChart>
        ) : spec.type === 'line' ? (
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} label={spec.xLabel ? { value: spec.xLabel, position: 'insideBottom', offset: -5 } : undefined} />
            <YAxis tick={{ fontSize: 11 }} label={spec.yLabel ? { value: spec.yLabel, angle: -90, position: 'insideLeft' } : undefined} />
            <Tooltip formatter={(v: number) => v.toLocaleString()} />
            <Legend />
            {spec.dataset ? (
              spec.dataset.map((ds, i) => (
                <Line key={ds.name} type="monotone" dataKey={ds.name} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />
              ))
            ) : (
              <Line type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 4 }} />
            )}
          </LineChart>
        ) : spec.type === 'area' ? (
          <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => v.toLocaleString()} />
            <Legend />
            {spec.dataset ? (
              spec.dataset.map((ds, i) => (
                <Area key={ds.name} type="monotone" dataKey={ds.name} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length] + '33'} strokeWidth={2} />
              ))
            ) : (
              <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0] + '33'} strokeWidth={2} />
            )}
          </AreaChart>
        ) : (
          // Default: bar chart
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} label={spec.xLabel ? { value: spec.xLabel, position: 'insideBottom', offset: -5 } : undefined} />
            <YAxis tick={{ fontSize: 11 }} label={spec.yLabel ? { value: spec.yLabel, angle: -90, position: 'insideLeft' } : undefined} />
            <Tooltip formatter={(v: number) => v.toLocaleString()} />
            <Legend />
            {spec.dataset ? (
              spec.dataset.map((ds, i) => (
                <Bar key={ds.name} dataKey={ds.name} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
              ))
            ) : (
              <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]}>
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            )}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ToolResult = {
  toolName: string;
  status: string;
  result: any;
  executionTime?: number;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
  toolsUsed?: string[];
  toolResults?: ToolResult[];
  chartSpecs?: ChartSpec[];
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function AgentChat() {
  const [, params] = useRoute('/agent/:agentId');
  const agentId = params?.agentId ?? 'demand_planner';
  const agent = AGENTS[agentId] ?? AGENTS['demand_planner'];
  const quickPrompts = QUICK_PROMPTS[agentId] ?? QUICK_PROMPTS['demand_planner'];

  const makeWelcome = (a: typeof agent): Message => ({
    id: 'welcome',
    role: 'assistant',
    content: `Hello! I'm your **${a.name}**.\n\n${a.description}.\n\nI have access to your live supply chain data — inventory, sales history, forecasts, purchase orders, and supplier information. I can also **generate charts and visualizations** for you. Ask me anything or pick a quick prompt below.`,
    timestamp: new Date(),
  });

  const [messages, setMessages] = useState<Message[]>([makeWelcome(agent)]);
  const [input, setInput] = useState('');
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [reviewerStatus, setReviewerStatus] = useState<{ wasRetried: boolean; score?: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load chat history from DB
  const historyQuery = trpc.agentChatWithTools.getHistory.useQuery(
    { agentId, limit: 50 },
    { enabled: !historyLoaded }
  );

  useEffect(() => {
    if (historyQuery.data && !historyLoaded) {
      const dbMessages = historyQuery.data.messages;
      if (dbMessages.length > 0) {
        const mapped = dbMessages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp),
        }));
        setMessages([makeWelcome(agent), ...mapped]);
      }
      setHistoryLoaded(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyQuery.data]);

  // Reset on agent change
  useEffect(() => {
    setMessages([makeWelcome(agent)]);
    setInput('');
    setHistoryLoaded(false);
    setReviewerStatus(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Extract chart specs from tool results
  const extractChartSpecs = (toolResults: ToolResult[]): ChartSpec[] => {
    const specs: ChartSpec[] = [];
    for (const tr of toolResults) {
      if (tr.result?.chartSpec?.renderAs === 'chart') {
        specs.push(tr.result.chartSpec as ChartSpec);
      }
    }
    return specs;
  };

  const sendMessage = trpc.agentChatWithTools.sendMessage.useMutation({
    onSuccess: (data) => {
      const content = typeof data.response === 'string' ? data.response : String(data.response ?? '');
      const toolResults = (data.toolResults ?? []) as ToolResult[];
      const chartSpecs = extractChartSpecs(toolResults);

      // Show reviewer status
      if ((data as any).wasRetried !== undefined) {
        setReviewerStatus({ wasRetried: (data as any).wasRetried });
        setTimeout(() => setReviewerStatus(null), 6000);
      }

      setMessages(prev => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant' as const,
          content,
          timestamp: new Date(),
          isError: !data.success,
          toolsUsed: data.toolsUsed ?? [],
          toolResults,
          chartSpecs,
        },
      ]);
    },
    onError: (err) => {
      toast.error('Failed to get response from agent.');
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Error:** ${err.message}\n\nPlease try again or check the server logs.`,
          timestamp: new Date(),
          isError: true,
        },
      ]);
    },
  });

  const handleSend = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sendMessage.isPending) return;

    // Build conversation history for context (exclude welcome message)
    const history = messages
      .filter(m => m.id !== 'welcome')
      .map(m => ({ role: m.role, content: m.content }));

    setMessages(prev => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: msg, timestamp: new Date() },
    ]);
    setInput('');

    sendMessage.mutate({
      agentId,
      agentName: agent.name,
      message: msg,
      conversationHistory: history,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleClear = () => {
    setMessages([makeWelcome(agent)]);
    setHistoryLoaded(false);
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
        <div className="flex items-center gap-2">
          {historyQuery.isLoading && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading history…
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleClear} className="gap-2">
            <RotateCcw className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      </div>

      {/* Reviewer status banner */}
      {reviewerStatus && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-2 shrink-0 ${
          reviewerStatus.wasRetried
            ? 'bg-amber-50 border border-amber-200 text-amber-800'
            : 'bg-green-50 border border-green-200 text-green-800'
        }`}>
          {reviewerStatus.wasRetried ? (
            <><AlertTriangle className="h-4 w-4 shrink-0" />
            <span><strong>Reviewer intervened:</strong> The initial response was inadequate. The Reviewer Agent provided guidance and the agent retried with improved instructions.</span></>
          ) : (
            <><CheckCircle2 className="h-4 w-4 shrink-0" />
            <span><strong>Reviewer approved:</strong> Response quality passed review.</span></>
          )}
          <ShieldCheck className="h-4 w-4 ml-auto shrink-0 opacity-60" />
        </div>
      )}

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
                    prose-a:text-blue-600 prose-a:underline
                    prose-li:my-1 prose-ul:my-2 prose-ul:pl-4 prose-ol:my-2 prose-ol:pl-4
                  ">
                    <Streamdown>{msg.content}</Streamdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                )}

                {/* Inline Charts */}
                {msg.chartSpecs && msg.chartSpecs.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {msg.chartSpecs.map((spec, i) => (
                      <InlineChart key={i} spec={spec} />
                    ))}
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
          placeholder={`Ask ${agent.name} anything… e.g. "Show top SKUs as a bar chart"`}
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
        Enter to send · Shift+Enter for new line · Charts, tables, and live data supported
      </p>
    </div>
  );
}
