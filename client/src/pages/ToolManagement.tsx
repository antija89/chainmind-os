import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle, Plus, Edit2, Trash2, MessageSquare, Search,
  Sparkles, Code2, PlayCircle, CheckCircle2, ChevronRight,
  ChevronLeft, Loader2, Eye, Copy, Check
} from 'lucide-react';
import { Streamdown } from 'streamdown';
import { toast } from 'sonner';

interface Tool {
  tool_id: string;
  name: string;
  description: string;
  category: string;
  complexity: string;
  is_active: boolean;
  created_by: string;
  implementation_type?: 'javascript' | 'python';
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface GeneratedTool {
  name: string;
  displayName: string;
  description: string;
  category: string;
  complexity: string;
  agentIds: string[];
  inputSchema: any;
  outputSchema: any;
  code: string;
}

interface PreviewResult {
  success: boolean;
  result: any;
  error?: string;
  executionTimeMs: number;
  sampleDataUsed: Record<string, number>;
}

const CATEGORIES = ['demand', 'supply', 'production', 'procurement', 'operations'];
const COMPLEXITIES = ['simple', 'medium', 'complex'];
const AGENTS = [
  { id: 'demand_planner', label: 'Demand Planner' },
  { id: 'supply_planner', label: 'Supply Planner' },
  { id: 'production_planner', label: 'Production Planner' },
  { id: 'procurement_planner', label: 'Procurement Planner' },
  { id: 'ops_head', label: 'Ops Head' },
];

const COMPLEXITY_COLORS: Record<string, string> = {
  simple: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  complex: 'bg-red-100 text-red-800',
};

const CATEGORY_COLORS: Record<string, string> = {
  demand: 'bg-blue-100 text-blue-800',
  supply: 'bg-purple-100 text-purple-800',
  production: 'bg-orange-100 text-orange-800',
  procurement: 'bg-teal-100 text-teal-800',
  operations: 'bg-gray-100 text-gray-800',
};

export function ToolManagement() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [complexityFilter, setComplexityFilter] = useState('all');
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Create dialog state — 3 steps
  const [createStep, setCreateStep] = useState<'input' | 'preview' | 'approve'>('input');
  const [createMode, setCreateMode] = useState<'ai' | 'manual'>('ai');
  // AI mode state
  const [aiDescription, setAiDescription] = useState('');
  const [aiCategory, setAiCategory] = useState<string>('');
  const [generatedTool, setGeneratedTool] = useState<GeneratedTool | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  // Manual mode state
  const [manualForm, setManualForm] = useState({
    name: '', description: '', category: 'demand', complexity: 'simple',
    agentIds: [] as string[], code: '',
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '', description: '', category: 'demand', complexity: 'simple',
  });

  const utils = trpc.useUtils();
  const toolsQuery = trpc.tools.list.useQuery({});
  const createMutation = trpc.tools.create.useMutation({
    onSuccess: () => { utils.tools.list.invalidate(); toast.success('Tool created successfully'); },
    onError: (e) => toast.error(`Failed to create tool: ${e.message}`),
  });
  const updateMutation = trpc.tools.update.useMutation({
    onSuccess: () => { utils.tools.list.invalidate(); toast.success('Tool updated'); },
    onError: (e) => toast.error(`Failed to update tool: ${e.message}`),
  });
  const deleteMutation = trpc.tools.delete.useMutation({
    onSuccess: () => { utils.tools.list.invalidate(); toast.success('Tool deleted'); },
    onError: (e) => toast.error(`Failed to delete tool: ${e.message}`),
  });
  const generateMutation = trpc.toolGenerator.generate.useMutation({
    onError: (e) => toast.error(`Generation failed: ${e.message}`),
  });
  const previewMutation = trpc.toolGenerator.preview.useMutation({
    onError: (e) => toast.error(`Preview failed: ${e.message}`),
  });
  const saveMutation = trpc.toolGenerator.save.useMutation({
    onSuccess: () => { utils.tools.list.invalidate(); toast.success('Tool saved to registry'); },
    onError: (e) => toast.error(`Save failed: ${e.message}`),
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const tools: Tool[] = (toolsQuery.data as Tool[]) || [];
  const filteredTools = tools.filter((t) => {
    const matchSearch = !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = categoryFilter === 'all' || t.category === categoryFilter;
    const matchCmplx = complexityFilter === 'all' || t.complexity === complexityFilter;
    return matchSearch && matchCat && matchCmplx;
  });

  // ── AI Generation Flow ──────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!aiDescription.trim()) return;
    setIsGenerating(true);
    try {
      const result = await generateMutation.mutateAsync({
        description: aiDescription,
        category: aiCategory as any || undefined,
      });
      setGeneratedTool(result);
      setCreateStep('preview');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreview = async () => {
    if (!generatedTool) return;
    setIsPreviewing(true);
    try {
      const result = await previewMutation.mutateAsync({ code: generatedTool.code });
      setPreviewResult(result as PreviewResult);
      setCreateStep('approve');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleApproveAndSave = async () => {
    if (!generatedTool) return;
    await saveMutation.mutateAsync(generatedTool as any);
    closeCreateDialog();
  };

  // ── Manual Flow ──────────────────────────────────────────────────────────
  const handleManualPreview = async () => {
    if (!manualForm.code.trim()) { toast.error('Please paste your tool code first'); return; }
    setIsPreviewing(true);
    try {
      const result = await previewMutation.mutateAsync({ code: manualForm.code });
      setPreviewResult(result as PreviewResult);
      setCreateStep('approve');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleManualSave = async () => {
    if (!manualForm.name.trim() || !manualForm.description.trim()) {
      toast.error('Name and description are required'); return;
    }
    await createMutation.mutateAsync({
      name: manualForm.name,
      description: manualForm.description,
      category: manualForm.category as any,
      complexity: manualForm.complexity as any,
      agentIds: manualForm.agentIds,
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
      implementation: manualForm.name.toLowerCase().replace(/\s+/g, '_'),
    });
    closeCreateDialog();
  };

  const closeCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setCreateStep('input');
    setCreateMode('ai');
    setAiDescription('');
    setAiCategory('');
    setGeneratedTool(null);
    setPreviewResult(null);
    setManualForm({ name: '', description: '', category: 'demand', complexity: 'simple', agentIds: [], code: '' });
  };

  // ── Edit ────────────────────────────────────────────────────────────────
  const openEdit = (tool: Tool) => {
    setEditingTool(tool);
    setEditForm({ name: tool.name, description: tool.description, category: tool.category, complexity: tool.complexity });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingTool) return;
    await updateMutation.mutateAsync({
      toolId: editingTool.tool_id,
      name: editForm.name,
      description: editForm.description,
      category: editForm.category as any,
      complexity: editForm.complexity as any,
    });
    setIsEditDialogOpen(false);
  };

  const handleDelete = async (toolId: string) => {
    if (!window.confirm('Delete this tool? This cannot be undone.')) return;
    await deleteMutation.mutateAsync({ toolId });
  };

  // ── Chat ────────────────────────────────────────────────────────────────
  const handleSendChat = async () => {
    if (!chatInput.trim() || !selectedTool) return;
    const userMsg: Message = { id: `u${Date.now()}`, role: 'user', content: chatInput, timestamp: new Date() };
    setChatMessages((p) => [...p, userMsg]);
    setChatInput('');
    setIsLoadingChat(true);
    try {
      const reply: Message = {
        id: `a${Date.now()}`,
        role: 'assistant',
        content: `I can help you with **${selectedTool.name}**.\n\n**Description:** ${selectedTool.description}\n\n**Category:** ${selectedTool.category} | **Complexity:** ${selectedTool.complexity}\n\nWhat would you like to know or change about this tool?`,
        timestamp: new Date(),
      };
      setChatMessages((p) => [...p, reply]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // ── Step labels ──────────────────────────────────────────────────────────
  const steps = createMode === 'ai'
    ? [{ key: 'input', label: 'Describe' }, { key: 'preview', label: 'Review Code' }, { key: 'approve', label: 'Approve' }]
    : [{ key: 'input', label: 'Paste Code' }, { key: 'approve', label: 'Preview & Save' }];
  const stepIndex = steps.findIndex((s) => s.key === createStep);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tool Management</h1>
          <p className="text-muted-foreground mt-1">Create, manage, and monitor supply chain tools</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Tool
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-64 flex items-center gap-2 bg-muted px-3 py-2 rounded-lg">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input placeholder="Search tools..." value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={complexityFilter} onValueChange={setComplexityFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All Levels" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {COMPLEXITIES.map((c) => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tools Grid */}
      {toolsQuery.isLoading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8" /></div>
      ) : filteredTools.length === 0 ? (
        <Card><CardContent className="pt-6">
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No tools found matching your filters</p>
          </div>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTools.map((tool) => (
            <Card key={tool.tool_id} className="flex flex-col hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base leading-tight">{tool.name}</CardTitle>
                    <CardDescription className="text-xs mt-0.5 font-mono truncate">{tool.tool_id}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-3 pt-0">
                <p className="text-sm text-muted-foreground line-clamp-2">{tool.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge className={CATEGORY_COLORS[tool.category] || 'bg-gray-100 text-gray-800'}>{tool.category}</Badge>
                  <Badge className={COMPLEXITY_COLORS[tool.complexity] || 'bg-gray-100 text-gray-800'}>{tool.complexity}</Badge>
                  <Badge className={tool.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}>
                    {tool.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">By: {tool.created_by || 'system'}</p>
              </CardContent>
              <div className="border-t px-4 py-2 flex gap-1">
                <Button variant="ghost" size="sm" title="Chat about this tool"
                  onClick={() => { setSelectedTool(tool); setChatMessages([]); setIsChatOpen(true); }}>
                  <MessageSquare className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" title="Edit tool" onClick={() => openEdit(tool)}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" title="Delete tool" onClick={() => handleDelete(tool.tool_id)}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── CREATE DIALOG ─────────────────────────────────────────────────── */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(o) => { if (!o) closeCreateDialog(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Create New Tool
            </DialogTitle>
            <DialogDescription>
              Use AI to generate a tool from a description, or paste your own code
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 py-2">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full transition-colors ${
                  i < stepIndex ? 'bg-green-100 text-green-700' :
                  i === stepIndex ? 'bg-primary text-primary-foreground' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {i < stepIndex ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="text-xs">{i + 1}</span>}
                  {s.label}
                </div>
                {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </div>
            ))}
          </div>

          <Separator />

          {/* Mode tabs — only on step 1 */}
          {createStep === 'input' && (
            <Tabs value={createMode} onValueChange={(v) => setCreateMode(v as 'ai' | 'manual')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ai" className="gap-2">
                  <Sparkles className="w-4 h-4" /> AI Generate
                </TabsTrigger>
                <TabsTrigger value="manual" className="gap-2">
                  <Code2 className="w-4 h-4" /> Manual / Paste Code
                </TabsTrigger>
              </TabsList>

              {/* AI mode */}
              <TabsContent value="ai" className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Describe what this tool should do</label>
                  <Textarea
                    placeholder="e.g. Calculate safety stock levels for each SKU based on demand variability and desired service level. Return recommended safety stock quantity and days of cover."
                    value={aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Be specific — mention inputs, outputs, and any formulas or logic you want applied.</p>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Category (optional)</label>
                  <Select value={aiCategory} onValueChange={setAiCategory}>
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="Let AI decide" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Let AI decide</SelectItem>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleGenerate} disabled={isGenerating || !aiDescription.trim()} className="gap-2">
                    {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate Tool</>}
                  </Button>
                </div>
              </TabsContent>

              {/* Manual mode */}
              <TabsContent value="manual" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Tool Name *</label>
                    <Input placeholder="e.g. Calculate Safety Stock" value={manualForm.name}
                      onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Category</label>
                    <Select value={manualForm.category} onValueChange={(v) => setManualForm({ ...manualForm, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Description *</label>
                  <Textarea placeholder="What does this tool do?" value={manualForm.description}
                    onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })} rows={2} className="resize-none" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Complexity</label>
                  <Select value={manualForm.complexity} onValueChange={(v) => setManualForm({ ...manualForm, complexity: v })}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{COMPLEXITIES.map((c) => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">
                    Tool Code *
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      JavaScript — has access to: <code className="bg-muted px-1 rounded">inputParams</code>, <code className="bg-muted px-1 rounded">skus</code>, <code className="bg-muted px-1 rounded">inventory</code>, <code className="bg-muted px-1 rounded">suppliers</code>, <code className="bg-muted px-1 rounded">purchase_orders</code>, <code className="bg-muted px-1 rounded">sales_history</code>
                    </span>
                  </label>
                  <Textarea
                    placeholder={`// Example:\nconst results = skus.map(sku => {\n  const inv = inventory.find(i => i.sku === sku.sku);\n  return { sku: sku.sku, name: sku.name, on_hand: inv?.on_hand };\n});\nreturn { results };`}
                    value={manualForm.code}
                    onChange={(e) => setManualForm({ ...manualForm, code: e.target.value })}
                    rows={10}
                    className="font-mono text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">Assign to Agents</label>
                  <div className="flex flex-wrap gap-2">
                    {AGENTS.map((a) => (
                      <label key={a.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer text-sm transition-colors ${
                        manualForm.agentIds.includes(a.id) ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                      }`}>
                        <input type="checkbox" className="hidden" checked={manualForm.agentIds.includes(a.id)}
                          onChange={(e) => setManualForm({ ...manualForm, agentIds: e.target.checked
                            ? [...manualForm.agentIds, a.id]
                            : manualForm.agentIds.filter((x) => x !== a.id) })} />
                        {a.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={handleManualPreview} disabled={isPreviewing || !manualForm.code.trim()} className="gap-2">
                    {isPreviewing ? <><Loader2 className="w-4 h-4 animate-spin" /> Running...</> : <><PlayCircle className="w-4 h-4" /> Run Preview</>}
                  </Button>
                  <Button onClick={handleManualSave} disabled={createMutation.isPending || !manualForm.name.trim()} className="gap-2">
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Save Tool
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* Step 2 (AI): Review generated code */}
          {createStep === 'preview' && generatedTool && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Tool Name</p>
                  <p className="font-semibold">{generatedTool.displayName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Category / Complexity</p>
                  <div className="flex gap-2">
                    <Badge className={CATEGORY_COLORS[generatedTool.category] || ''}>{generatedTool.category}</Badge>
                    <Badge className={COMPLEXITY_COLORS[generatedTool.complexity] || ''}>{generatedTool.complexity}</Badge>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Description</p>
                <p className="text-sm">{generatedTool.description}</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Generated Code</p>
                  <Button variant="ghost" size="sm" onClick={() => copyCode(generatedTool.code)} className="h-7 gap-1 text-xs">
                    {copiedCode ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </Button>
                </div>
                <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap">{generatedTool.code}</pre>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Assigned Agents</p>
                <div className="flex flex-wrap gap-1.5">
                  {generatedTool.agentIds.map((id) => (
                    <Badge key={id} variant="outline">{AGENTS.find((a) => a.id === id)?.label || id}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setCreateStep('input')} className="gap-2">
                  <ChevronLeft className="w-4 h-4" /> Back
                </Button>
                <Button onClick={handlePreview} disabled={isPreviewing} className="gap-2">
                  {isPreviewing ? <><Loader2 className="w-4 h-4 animate-spin" /> Running on sample data...</> : <><PlayCircle className="w-4 h-4" /> Run on Sample Data</>}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Preview result + approve */}
          {createStep === 'approve' && previewResult && (
            <div className="space-y-4">
              <div className={`flex items-center gap-2 p-3 rounded-lg ${previewResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {previewResult.success
                  ? <CheckCircle2 className="w-5 h-5 shrink-0" />
                  : <AlertCircle className="w-5 h-5 shrink-0" />}
                <div>
                  <p className="font-medium">{previewResult.success ? 'Execution successful' : 'Execution failed'}</p>
                  <p className="text-xs opacity-80">Ran in {previewResult.executionTimeMs}ms on sample data
                    ({Object.entries(previewResult.sampleDataUsed).map(([k, v]) => `${v} ${k}`).join(', ')})</p>
                </div>
              </div>

              {previewResult.error && (
                <Alert variant="destructive">
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription className="font-mono text-xs">{previewResult.error}</AlertDescription>
                </Alert>
              )}

              {previewResult.success && previewResult.result && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Sample Output</p>
                  </div>
                  <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap">
                    {JSON.stringify(previewResult.result, null, 2)}
                  </pre>
                </div>
              )}

              {generatedTool && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <p className="font-medium">{generatedTool.displayName}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{generatedTool.description}</p>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setCreateStep(createMode === 'ai' ? 'preview' : 'input')} className="gap-2">
                  <ChevronLeft className="w-4 h-4" /> Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={closeCreateDialog}>Discard</Button>
                  <Button
                    onClick={createMode === 'ai' ? handleApproveAndSave : handleManualSave}
                    disabled={saveMutation.isPending || createMutation.isPending || !previewResult.success}
                    className="gap-2"
                  >
                    {(saveMutation.isPending || createMutation.isPending)
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <CheckCircle2 className="w-4 h-4" />}
                    Approve & Save Tool
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── EDIT DIALOG ───────────────────────────────────────────────────── */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Tool</DialogTitle>
            <DialogDescription>Update tool details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">Tool Name</label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Description</label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} className="resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium block mb-1.5">Category</label>
                <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">Complexity</label>
                <Select value={editForm.complexity} onValueChange={(v) => setEditForm({ ...editForm, complexity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{COMPLEXITIES.map((c) => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Update Tool
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CHAT DIALOG ───────────────────────────────────────────────────── */}
      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        <DialogContent className="max-w-2xl flex flex-col" style={{ height: '520px' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Tool Agent: {selectedTool?.name}
            </DialogTitle>
            <DialogDescription>Interact with the tool agent to manage or test this tool</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <MessageSquare className="w-8 h-8 opacity-30" />
                <p className="text-sm">Ask anything about this tool...</p>
              </div>
            ) : chatMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
                  msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'
                }`}>
                  {msg.role === 'assistant' ? <Streamdown>{msg.content}</Streamdown> : msg.content}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t pt-3 flex gap-2">
            <Input placeholder="Ask about this tool..." value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
              disabled={isLoadingChat} />
            <Button onClick={handleSendChat} disabled={isLoadingChat || !chatInput.trim()}>
              {isLoadingChat ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
