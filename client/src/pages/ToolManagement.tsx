import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Plus, Edit2, Trash2, MessageSquare, Search } from 'lucide-react';
import { Streamdown } from 'streamdown';

interface Tool {
  tool_id: string;
  name: string;
  description: string;
  category: string;
  complexity: string;
  is_active: boolean;
  created_by: string;
  implementation_type?: 'javascript' | 'python';
  python_script?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function ToolManagement() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [filteredTools, setFilteredTools] = useState<Tool[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [complexityFilter, setComplexityFilter] = useState<string>('all');
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'demand',
    complexity: 'simple',
    implementation_type: 'javascript',
    python_script: '',
    agent_ids: [] as string[],
  });

  const utils = trpc.useUtils?.() || {};
  const toolsQuery = trpc.tools?.list?.useQuery?.({}) || { data: [] };
  const createMutation = trpc.tools?.create?.useMutation?.();
  const updateMutation = trpc.tools?.update?.useMutation?.();
  const deleteMutation = trpc.tools?.delete?.useMutation?.();

  // Update tools when query data changes
  useEffect(() => {
    if (toolsQuery.data) {
      setTools(toolsQuery.data as Tool[]);
    }
  }, [toolsQuery.data]);

  // Filter tools
  useEffect(() => {
    let filtered = tools;

    if (searchQuery) {
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter((t) => t.category === categoryFilter);
    }

    if (complexityFilter !== 'all') {
      filtered = filtered.filter((t) => t.complexity === complexityFilter);
    }

    setFilteredTools(filtered);
  }, [tools, searchQuery, categoryFilter, complexityFilter]);

  const handleCreateTool = async () => {
    if (!formData.name.trim() || !formData.description.trim()) return;

    try {
      await createMutation?.mutateAsync?.({
        name: formData.name,
        description: formData.description,
        category: formData.category as any,
        complexity: formData.complexity as any,
        agentIds: formData.agent_ids,
        inputSchema: { type: 'object', properties: {} },
        outputSchema: { type: 'object', properties: {} },
        implementation: formData.name.toLowerCase().replace(/\s+/g, '_'),
      });

      setIsCreateDialogOpen(false);
      resetForm();
      utils?.tools?.list?.invalidate?.();
    } catch (error) {
      console.error('Error creating tool:', error);
    }
  };

  const handleEditTool = (tool: Tool) => {
    setEditingTool(tool);
    setFormData({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      complexity: tool.complexity,
      implementation_type: tool.implementation_type || 'javascript',
      python_script: tool.python_script || '',
      agent_ids: [],
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateTool = async () => {
    if (!editingTool || !formData.name.trim() || !formData.description.trim()) return;

    try {
      await updateMutation?.mutateAsync?.({
        toolId: editingTool.tool_id,
        name: formData.name,
        description: formData.description,
        category: formData.category as any,
        complexity: formData.complexity as any,
      });

      setIsEditDialogOpen(false);
      setEditingTool(null);
      resetForm();
      utils?.tools?.list?.invalidate?.();
    } catch (error) {
      console.error('Error updating tool:', error);
    }
  };

  const handleDeleteTool = async (toolId: string) => {
    if (!window.confirm('Are you sure you want to delete this tool?')) return;

    try {
      await deleteMutation?.mutateAsync?.({ toolId });
      utils?.tools?.list?.invalidate?.();
    } catch (error) {
      console.error('Error deleting tool:', error);
    }
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !selectedTool) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: chatInput,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setIsLoadingChat(true);

    try {
      const assistantMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: `I can help you with the **${selectedTool.name}** tool.\n\n**Description:** ${selectedTool.description}\n\n**Category:** ${selectedTool.category}\n**Complexity:** ${selectedTool.complexity}\n**Type:** ${selectedTool.implementation_type || 'javascript'}\n\nWhat would you like to know or do with this tool?`,
        timestamp: new Date(),
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'demand',
      complexity: 'simple',
      implementation_type: 'javascript',
      python_script: '',
      agent_ids: [],
    });
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const categories = ['demand', 'supply', 'production', 'procurement', 'operations'];
  const complexities = ['simple', 'medium', 'complex'];
  const agents = ['demand_planner', 'supply_planner', 'production_planner', 'procurement_planner', 'ops_head'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tool Management</h1>
          <p className="text-muted-foreground mt-1">Create, manage, and monitor supply chain tools</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Tool
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Tool</DialogTitle>
              <DialogDescription>Add a new tool to the registry</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Tool Name</label>
                <Input
                  placeholder="e.g., Advanced Demand Forecasting"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Describe what this tool does..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Complexity</label>
                  <Select value={formData.complexity} onValueChange={(v) => setFormData({ ...formData, complexity: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {complexities.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Implementation Type</label>
                  <Select
                    value={formData.implementation_type}
                    onValueChange={(v) => setFormData({ ...formData, implementation_type: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                      <SelectItem value="python">Python</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.implementation_type === 'python' && (
                  <div>
                    <label className="text-sm font-medium">Python Script</label>
                    <Input
                      placeholder="e.g., tools/forecast_demand.py"
                      value={formData.python_script}
                      onChange={(e) => setFormData({ ...formData, python_script: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">Assign to Agents</label>
                <div className="space-y-2">
                  {agents.map((agent) => (
                    <label key={agent} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.agent_ids.includes(agent)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              agent_ids: [...formData.agent_ids, agent],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              agent_ids: formData.agent_ids.filter((a) => a !== agent),
                            });
                          }
                        }}
                      />
                      <span className="text-sm">{agent}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTool}>Create Tool</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-64">
              <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded-lg">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search tools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-0 bg-transparent"
                />
              </div>
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={complexityFilter} onValueChange={setComplexityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Complexity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {complexities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTools.map((tool) => (
          <Card key={tool.tool_id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <CardTitle className="text-lg">{tool.name}</CardTitle>
                  <CardDescription className="text-xs mt-1">{tool.tool_id}</CardDescription>
                </div>
                {tool.implementation_type === 'python' && (
                  <Badge variant="outline" className="bg-blue-50">
                    Python
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 space-y-3">
              <p className="text-sm text-muted-foreground line-clamp-2">{tool.description}</p>

              <div className="flex flex-wrap gap-2">
                <Badge className="bg-blue-100 text-blue-800">{tool.category}</Badge>
                <Badge
                  className={
                    tool.complexity === 'simple'
                      ? 'bg-green-100 text-green-800'
                      : tool.complexity === 'medium'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                  }
                >
                  {tool.complexity}
                </Badge>
                {tool.is_active ? (
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                ) : (
                  <Badge variant="outline" className="bg-gray-100">
                    Inactive
                  </Badge>
                )}
              </div>

              <div className="text-xs text-muted-foreground">Created by: {tool.created_by}</div>
            </CardContent>

            <div className="border-t px-6 py-3 flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedTool(tool);
                  setChatMessages([]);
                  setIsChatOpen(true);
                }}
              >
                <MessageSquare className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditTool(tool)}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeleteTool(tool.tool_id)}
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filteredTools.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No tools found matching your filters</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Tool</DialogTitle>
            <DialogDescription>Update tool details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Tool Name</label>
              <Input
                placeholder="e.g., Advanced Demand Forecasting"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Describe what this tool does..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Complexity</label>
                <Select value={formData.complexity} onValueChange={(v) => setFormData({ ...formData, complexity: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {complexities.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateTool}>Update Tool</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat Dialog */}
      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        <DialogContent className="max-w-2xl h-96 flex flex-col">
          <DialogHeader>
            <DialogTitle>Tool Agent Chat: {selectedTool?.name}</DialogTitle>
            <DialogDescription>Interact with the tool agent to manage this tool</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-4">
            {chatMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Start a conversation about this tool...</p>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-xs px-4 py-2 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <Streamdown>{msg.content}</Streamdown>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t pt-4 flex gap-2">
            <Input
              placeholder="Ask about this tool..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendChatMessage();
                }
              }}
              disabled={isLoadingChat}
            />
            <Button onClick={handleSendChatMessage} disabled={isLoadingChat || !chatInput.trim()}>
              {isLoadingChat ? <Spinner className="w-4 h-4" /> : 'Send'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
