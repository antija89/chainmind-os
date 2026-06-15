import { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, Bot, User, Wrench, ArrowLeft, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Streamdown } from 'streamdown';

const AGENT_META: Record<string, { name: string; icon: string; color: string; badge: string; description: string }> = {
  demand_planner: { name: 'Demand Planner', icon: '📊', color: 'bg-blue-100 text-blue-800', badge: 'Demand', description: 'Analyzes sales trends, forecasts demand, and identifies market opportunities' },
  supply_planner: { name: 'Supply Planner', icon: '📦', color: 'bg-green-100 text-green-800', badge: 'Supply', description: 'Optimizes inventory levels, manages supply balance, and prevents stockouts' },
  production_planner: { name: 'Production Planner', icon: '🏭', color: 'bg-orange-100 text-orange-800', badge: 'Production', description: 'Schedules production runs, optimizes capacity, and minimizes lead times' },
  procurement_planner: { name: 'Procurement Planner', icon: '🤝', color: 'bg-yellow-100 text-yellow-800', badge: 'Procurement', description: 'Manages purchase orders, supplier relationships, and procurement costs' },
  ops_head: { name: 'Ops Head', icon: '🎯', color: 'bg-purple-100 text-purple-800', badge: 'Operations', description: 'Oversees end-to-end supply chain, manages KPIs, and drives operational excellence' },
};

const AGENT_TOOLS: Record<string, string[]> = {
  demand_planner: ['get_top_selling_skus', 'get_sales_summary', 'get_forecast_summary', 'get_sku_details'],
  supply_planner: ['get_inventory_status', 'get_open_po_summary', 'get_supply_gaps', 'get_sku_details'],
  production_planner: ['get_inventory_status', 'get_forecast_summary', 'get_supply_gaps', 'get_sku_details'],
  procurement_planner: ['get_open_po_summary', 'get_supplier_list', 'get_sku_details'],
  ops_head: ['get_top_selling_skus', 'get_inventory_status', 'get_open_po_summary', 'get_supply_gaps', 'get_forecast_summary', 'get_supplier_list'],
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
  toolsUsed?: string[];
};

export default function AgentWorkspace() {
  const [, params] = useRoute('/agents/:agentId');
  const [, navigate] = useLocation();
  const agentId = params?.agentId ?? 'demand_planner';
  const meta = AGENT_META[agentId] ?? AGENT_META['demand_planner'];
  const tools = AGENT_TOOLS[agentId] ?? [];

  // Chat state
  const makeWelcome = (): Message => ({
    id: 'welcome',
    role: 'assistant',
    content: `Hello! I'm your **${meta.name}**. This is your dedicated workspace — you can chat with me, review my instruction stack, and see which tools I use to answer your questions.`,
    timestamp: new Date(),
  });
  const [messages, setMessages] = useState<Message[]>([makeWelcome()]);
  const [input, setInput] = useState('');

  // Instruction stack state
  const { data: agentData, refetch } = trpc.agents.getById.useQuery({ agentId });
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [instructionText, setInstructionText] = useState('');

  const updateAgent = trpc.agents.updateInstructions.useMutation({
    onSuccess: () => {
      toast.success('Instruction stack saved');
      setEditingInstructions(false);
      refetch();
    },
    onError: () => toast.error('Failed to save instructions'),
  });

  const handleEditInstructions = () => {
    const stack = agentData?.instructionStack;
    const text = Array.isArray(stack) ? (stack as string[]).join('\n') : typeof stack === 'string' ? stack : '';
    setInstructionText(text);
    setEditingInstructions(true);
  };

  const handleSaveInstructions = () => {
    const lines = instructionText.split('\n').map(l => l.trim()).filter(Boolean);
    updateAgent.mutate({ agentId, instructionStack: lines });
  };

  // Chat
  const sendMessage = trpc.agents.sendMessage.useMutation({
    onSuccess: (data) => {
      const content = typeof data.message === 'string' ? data.message : String(data.message);
      setMessages(prev => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content,
        timestamp: new Date(),
        isError: !data.success,
        toolsUsed: data.toolsUsed ?? [],
      }]);
    },
    onError: (err) => {
      toast.error('Failed to get response');
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Error:** ${err.message}`,
        timestamp: new Date(),
        isError: true,
      }]);
    },
  });

  const handleSend = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sendMessage.isPending) return;
    setMessages(prev => [...prev, { id: `user-${Date.now()}`, role: 'user', content: msg, timestamp: new Date() }]);
    setInput('');
    sendMessage.mutate({ agentId, agentName: meta.name, message: msg });
  };

  const instructionStack = Array.isArray(agentData?.instructionStack)
    ? (agentData.instructionStack as string[])
    : typeof agentData?.instructionStack === 'string'
    ? [agentData.instructionStack]
    : [];

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/agents')} className="gap-1 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <span className="text-3xl">{meta.icon}</span>
          <div>
            <h1 className="text-xl font-bold">{meta.name}</h1>
            <p className="text-sm text-muted-foreground">{meta.description}</p>
          </div>
          <Badge className={meta.color}>{meta.badge}</Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="chat" className="flex flex-col flex-1 min-h-0">
        <TabsList className="shrink-0 w-fit mb-3">
          <TabsTrigger value="chat">💬 Chat</TabsTrigger>
          <TabsTrigger value="instructions">📋 Instruction Stack</TabsTrigger>
          <TabsTrigger value="tools">🔧 Tools</TabsTrigger>
        </TabsList>

        {/* Chat Tab */}
        <TabsContent value="chat" className="flex flex-col flex-1 min-h-0 mt-0">
          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-4 pb-2">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <Avatar className="h-8 w-8 shrink-0 mt-1">
                    <AvatarFallback className={msg.role === 'assistant' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}>
                      {msg.role === 'assistant' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm'
                    : msg.isError ? 'bg-red-50 border border-red-200 text-red-900 rounded-tl-sm'
                    : 'bg-white border border-gray-200 text-gray-900 rounded-tl-sm'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none">
                        <Streamdown>{msg.content}</Streamdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                    {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-100">
                        <Wrench className="h-3 w-3 text-gray-400 mt-0.5 shrink-0" />
                        {msg.toolsUsed.map((t) => (
                          <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">{t}</span>
                        ))}
                      </div>
                    )}
                    <p className={`text-xs mt-2 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {sendMessage.isPending && (
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 shrink-0 mt-1">
                    <AvatarFallback className="bg-blue-100 text-blue-700"><Bot className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 text-sm text-gray-500 shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    <span>Querying supply chain data…</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="flex gap-2 pt-3 shrink-0">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={`Ask ${meta.name} anything…`}
              className="resize-none min-h-[52px] max-h-[100px]"
              rows={2}
              disabled={sendMessage.isPending}
            />
            <Button onClick={() => handleSend()} disabled={!input.trim() || sendMessage.isPending} className="self-end h-[52px] px-5">
              {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
            <Button variant="outline" onClick={() => setMessages([makeWelcome()])} className="self-end h-[52px]" title="Clear chat">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </TabsContent>

        {/* Instruction Stack Tab */}
        <TabsContent value="instructions" className="flex-1 overflow-auto mt-0">
          <div className="bg-white border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Instruction Stack</h3>
                <p className="text-sm text-muted-foreground">SOPs, decision rules, and guardrails for this agent</p>
              </div>
              {!editingInstructions ? (
                <Button variant="outline" size="sm" onClick={handleEditInstructions}>Edit Instructions</Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingInstructions(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveInstructions} disabled={updateAgent.isPending} className="gap-1">
                    <Save className="h-3.5 w-3.5" />
                    {updateAgent.isPending ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              )}
            </div>
            {editingInstructions ? (
              <Textarea
                value={instructionText}
                onChange={(e) => setInstructionText(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
                placeholder="Enter one instruction per line…"
              />
            ) : (
              <div className="space-y-2">
                {instructionStack.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No instructions defined. Click Edit to add SOPs and decision rules.</p>
                ) : (
                  instructionStack.map((instr, i) => (
                    <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      <span className="text-xs font-mono text-gray-400 mt-0.5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                      <p className="text-sm text-gray-800">{instr}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="flex-1 overflow-auto mt-0">
          <div className="bg-white border rounded-xl p-5">
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900">Available Tools</h3>
              <p className="text-sm text-muted-foreground">Deterministic server-side functions this agent can call</p>
            </div>
            <div className="grid gap-3">
              {tools.map((tool) => {
                const toolDescriptions: Record<string, { desc: string; returns: string }> = {
                  get_top_selling_skus: { desc: 'Queries sales_history to rank SKUs by total quantity sold', returns: 'Top 10 SKUs with volume and revenue' },
                  get_sales_summary: { desc: 'Aggregates sales data by period, category, and channel', returns: 'Monthly totals, YoY comparison' },
                  get_forecast_summary: { desc: 'Reads forecast table and computes accuracy vs actuals', returns: 'Forecast accuracy %, bias, MAPE' },
                  get_inventory_status: { desc: 'Reads inventory table and computes DOS for each SKU', returns: 'Inventory levels, DOS, stockout risk' },
                  get_open_po_summary: { desc: 'Queries po_data for open/pending purchase orders', returns: 'PO list with value, ETA, supplier' },
                  get_supply_gaps: { desc: 'Compares forecast demand vs available inventory + open POs', returns: 'Gap analysis by SKU and period' },
                  get_supplier_list: { desc: 'Reads suppliers table with lead times and performance', returns: 'Supplier list with lead time and status' },
                  get_sku_details: { desc: 'Fetches full FG or RM master record for a specific SKU', returns: 'SKU attributes, BOM, pricing' },
                };
                const info = toolDescriptions[tool] ?? { desc: 'Supply chain data query tool', returns: 'Structured data result' };
                return (
                  <div key={tool} className="flex gap-4 p-4 border rounded-lg bg-gray-50">
                    <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <Wrench className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm font-mono font-semibold text-gray-900">{tool}</code>
                        <Badge variant="outline" className="text-xs">DB Query</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{info.desc}</p>
                      <p className="text-xs text-muted-foreground">Returns: {info.returns}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
