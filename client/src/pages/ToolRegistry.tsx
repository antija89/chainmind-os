import { useState } from 'react';
import { useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle, Plus, Trash2, BarChart3 } from 'lucide-react';

type ToolCategory = 'demand' | 'supply' | 'production' | 'procurement' | 'operations';
type Complexity = 'simple' | 'medium' | 'complex';

interface Tool {
  tool_id: string;
  name: string;
  description?: string;
  category: ToolCategory;
  agent_ids: string[];
  implementation: string;
  complexity?: Complexity;
  is_active: boolean;
  created_at?: string;
}

export function ToolRegistry() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory | 'all'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'demand' as ToolCategory,
    agentIds: [] as string[],
    implementation: '',
    complexity: 'simple' as Complexity,
  });

  const utils = trpc.useUtils();
  const toolsQuery = trpc.tools.list.useQuery({ search });
  const createMutation = trpc.tools.create.useMutation({
    onSuccess: () => {
      utils.tools.list.invalidate();
      setIsCreateOpen(false);
      setFormData({
        name: '',
        description: '',
        category: 'demand',
        agentIds: [],
        implementation: '',
        complexity: 'simple',
      });
    },
  });
  const deleteMutation = trpc.tools.delete.useMutation({
    onSuccess: () => {
      utils.tools.list.invalidate();
    },
  });

  const tools = (toolsQuery.data as Tool[]) || [];
  const filteredTools = selectedCategory === 'all' 
    ? tools 
    : tools.filter(t => t.category === selectedCategory);

  const handleCreateTool = async () => {
    if (!formData.name || !formData.implementation) {
      alert('Name and implementation are required');
      return;
    }

    await createMutation.mutateAsync({
      name: formData.name,
      description: formData.description,
      category: formData.category,
      agentIds: formData.agentIds.length > 0 ? formData.agentIds : ['demand_planner'],
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
      implementation: formData.implementation,
      complexity: formData.complexity,
    });
  };

  const handleDeleteTool = async (toolId: string) => {
    if (confirm('Are you sure you want to delete this tool?')) {
      await deleteMutation.mutateAsync({ toolId });
    }
  };

  const categoryColors: Record<ToolCategory, string> = {
    demand: 'bg-blue-100 text-blue-800',
    supply: 'bg-green-100 text-green-800',
    production: 'bg-orange-100 text-orange-800',
    procurement: 'bg-purple-100 text-purple-800',
    operations: 'bg-red-100 text-red-800',
  };

  const complexityColors: Record<Complexity, string> = {
    simple: 'bg-gray-100 text-gray-800',
    medium: 'bg-yellow-100 text-yellow-800',
    complex: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tool Registry</h1>
          <p className="text-muted-foreground mt-1">Manage AI agent tools and capabilities</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Tool
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Tool</DialogTitle>
              <DialogDescription>
                Define a new tool that AI agents can use to solve supply chain problems
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Tool Name *</label>
                <Input
                  placeholder="e.g., forecast_demand_by_sku"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea
                  placeholder="What does this tool do? When should agents use it?"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v as ToolCategory })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="demand">Demand Planning</SelectItem>
                      <SelectItem value="supply">Supply Planning</SelectItem>
                      <SelectItem value="production">Production Planning</SelectItem>
                      <SelectItem value="procurement">Procurement</SelectItem>
                      <SelectItem value="operations">Operations</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Complexity</label>
                  <Select value={formData.complexity} onValueChange={(v) => setFormData({ ...formData, complexity: v as Complexity })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple">Simple</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="complex">Complex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Implementation Function *</label>
                <Input
                  placeholder="e.g., calculateSafetyStock"
                  value={formData.implementation}
                  onChange={(e) => setFormData({ ...formData, implementation: e.target.value })}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTool} disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Spinner className="w-4 h-4 mr-2" /> : null}
                  Create Tool
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Input
          placeholder="Search tools..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as ToolCategory | 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="demand">Demand Planning</SelectItem>
            <SelectItem value="supply">Supply Planning</SelectItem>
            <SelectItem value="production">Production Planning</SelectItem>
            <SelectItem value="procurement">Procurement</SelectItem>
            <SelectItem value="operations">Operations</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tools Grid */}
      {toolsQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="w-8 h-8" />
        </div>
      ) : filteredTools.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-12 text-center">
              <div>
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No tools found</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTools.map((tool) => (
            <Card key={tool.tool_id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{tool.name}</CardTitle>
                    <CardDescription className="mt-1">{tool.implementation}</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTool(tool.tool_id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {tool.description && (
                  <p className="text-sm text-muted-foreground">{tool.description}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Badge className={categoryColors[tool.category]}>
                    {tool.category}
                  </Badge>
                  {tool.complexity && (
                    <Badge className={complexityColors[tool.complexity]}>
                      {tool.complexity}
                    </Badge>
                  )}
                </div>

                <div className="text-xs text-muted-foreground">
                  <p>Agents: {tool.agent_ids?.join(', ') || 'None'}</p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => setSelectedTool(tool)}
                >
                  <BarChart3 className="w-4 h-4" />
                  View Stats
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Stats Dialog */}
      {selectedTool && (
        <ToolStatsDialog tool={selectedTool} onClose={() => setSelectedTool(null)} />
      )}
    </div>
  );
}

function ToolStatsDialog({ tool, onClose }: { tool: Tool; onClose: () => void }) {
  const statsQuery = trpc.tools.getStats.useQuery({ toolId: tool.tool_id });
  const stats = statsQuery.data as any;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tool.name} - Statistics</DialogTitle>
        </DialogHeader>
        {statsQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner className="w-6 h-6" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted rounded">
                <p className="text-sm text-muted-foreground">Total Calls</p>
                <p className="text-2xl font-bold">{stats?.total_calls || 0}</p>
              </div>
              <div className="p-3 bg-green-50 rounded">
                <p className="text-sm text-green-700">Success Rate</p>
                <p className="text-2xl font-bold">
                  {stats?.total_calls ? Math.round((stats.success_count / stats.total_calls) * 100) : 0}%
                </p>
              </div>
              <div className="p-3 bg-muted rounded">
                <p className="text-sm text-muted-foreground">Avg Execution Time</p>
                <p className="text-2xl font-bold">{Math.round(stats?.avg_execution_time || 0)}ms</p>
              </div>
              <div className="p-3 bg-muted rounded">
                <p className="text-sm text-muted-foreground">Max Execution Time</p>
                <p className="text-2xl font-bold">{Math.round(stats?.max_execution_time || 0)}ms</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
