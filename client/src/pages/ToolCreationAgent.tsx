import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle, Lightbulb, CheckCircle2 } from 'lucide-react';
import { AIChatBox } from '@/components/AIChatBox';

interface ToolSuggestion {
  name: string;
  description: string;
  category: 'demand' | 'supply' | 'production' | 'procurement' | 'operations';
  implementation: string;
  agentIds: string[];
  complexity: 'simple' | 'medium' | 'complex';
  inputExample: any;
  outputExample: any;
}

export function ToolCreationAgent() {
  const [userInput, setUserInput] = useState('');
  const [suggestions, setSuggestions] = useState<ToolSuggestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<ToolSuggestion | null>(null);

  const utils = trpc.useUtils();
  const createMutation = trpc.tools.create.useMutation({
    onSuccess: () => {
      utils.tools.list.invalidate();
      setSelectedSuggestion(null);
      setSuggestions([]);
      setUserInput('');
    },
  });

  const handleGenerateSuggestions = async () => {
    if (!userInput.trim()) return;

    setIsGenerating(true);
    try {
      // Parse the user input and generate tool suggestions
      const mockSuggestions: ToolSuggestion[] = generateToolSuggestions(userInput);
      setSuggestions(mockSuggestions);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateTool = async (suggestion: ToolSuggestion) => {
    await createMutation.mutateAsync({
      name: suggestion.name,
      description: suggestion.description,
      category: suggestion.category,
      agentIds: suggestion.agentIds,
      inputSchema: { type: 'object', properties: suggestion.inputExample },
      outputSchema: { type: 'object', properties: suggestion.outputExample },
      implementation: suggestion.implementation,
      complexity: suggestion.complexity,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Tool Creation Agent</h1>
        <p className="text-muted-foreground mt-1">
          Describe what you need, and AI will suggest tools for your supply chain
        </p>
      </div>

      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            Describe Your Need
          </CardTitle>
          <CardDescription>
            Tell the AI what problem you're trying to solve or what capability you need
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="e.g., 'I need a tool to calculate safety stock levels based on demand variability and service level targets'"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <Button
            onClick={handleGenerateSuggestions}
            disabled={isGenerating || !userInput.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Spinner className="w-4 h-4 mr-2" />
                Generating Suggestions...
              </>
            ) : (
              'Generate Tool Suggestions'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Suggested Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suggestions.map((suggestion, idx) => (
              <Card
                key={idx}
                className={`cursor-pointer transition-all ${
                  selectedSuggestion === suggestion
                    ? 'ring-2 ring-primary'
                    : 'hover:shadow-lg'
                }`}
                onClick={() => setSelectedSuggestion(suggestion)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">{suggestion.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {suggestion.implementation}
                      </CardDescription>
                    </div>
                    {selectedSuggestion === suggestion && (
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{suggestion.description}</p>

                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-blue-100 text-blue-800">
                      {suggestion.category}
                    </Badge>
                    <Badge className="bg-gray-100 text-gray-800">
                      {suggestion.complexity}
                    </Badge>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <p>Agents: {suggestion.agentIds.join(', ')}</p>
                  </div>

                  {selectedSuggestion === suggestion && (
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateTool(suggestion);
                      }}
                      disabled={createMutation.isPending}
                      className="w-full"
                    >
                      {createMutation.isPending ? (
                        <>
                          <Spinner className="w-4 h-4 mr-2" />
                          Creating...
                        </>
                      ) : (
                        'Create This Tool'
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {suggestions.length === 0 && !isGenerating && userInput && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-12 text-center">
              <div>
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Click "Generate Tool Suggestions" to create tools</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper function to generate tool suggestions based on user input
function generateToolSuggestions(input: string): ToolSuggestion[] {
  const lowerInput = input.toLowerCase();
  const suggestions: ToolSuggestion[] = [];

  // Demand planning tools
  if (
    lowerInput.includes('demand') ||
    lowerInput.includes('forecast') ||
    lowerInput.includes('sales')
  ) {
    suggestions.push({
      name: 'forecast_demand_by_sku',
      description: 'Predict future demand for specific SKUs using historical sales data and trends',
      category: 'demand',
      implementation: 'forecastDemandBySku',
      agentIds: ['demand_planner'],
      complexity: 'medium',
      inputExample: { sku: 'string', months: 'number', includeSeasonality: 'boolean' },
      outputExample: { forecast: 'array', confidence: 'number', trend: 'string' },
    });
  }

  // Supply planning tools
  if (
    lowerInput.includes('safety stock') ||
    lowerInput.includes('inventory') ||
    lowerInput.includes('stock level')
  ) {
    suggestions.push({
      name: 'calculate_safety_stock',
      description: 'Calculate optimal safety stock levels based on demand variability and service level',
      category: 'supply',
      implementation: 'calculateSafetyStock',
      agentIds: ['supply_planner'],
      complexity: 'medium',
      inputExample: {
        demandMean: 'number',
        demandStdDev: 'number',
        leadTime: 'number',
        serviceLevel: 'number',
      },
      outputExample: { safetyStock: 'number', reorderPoint: 'number' },
    });

    suggestions.push({
      name: 'calculate_reorder_point',
      description: 'Determine the inventory level at which to trigger a new purchase order',
      category: 'supply',
      implementation: 'calculateReorderPoint',
      agentIds: ['supply_planner'],
      complexity: 'simple',
      inputExample: { averageDemand: 'number', leadTime: 'number', safetyStock: 'number' },
      outputExample: { reorderPoint: 'number' },
    });
  }

  // Production planning tools
  if (
    lowerInput.includes('production') ||
    lowerInput.includes('capacity') ||
    lowerInput.includes('material requirement')
  ) {
    suggestions.push({
      name: 'calculate_material_requirements',
      description: 'Compute raw materials needed based on production plan and bill of materials',
      category: 'production',
      implementation: 'calculateMaterialRequirements',
      agentIds: ['production_planner'],
      complexity: 'complex',
      inputExample: {
        productionPlan: 'array',
        bomId: 'string',
        scrapRate: 'number',
      },
      outputExample: { materials: 'array', totalCost: 'number' },
    });

    suggestions.push({
      name: 'check_capacity_constraints',
      description: 'Identify production bottlenecks and capacity constraints',
      category: 'production',
      implementation: 'checkCapacityConstraints',
      agentIds: ['production_planner'],
      complexity: 'medium',
      inputExample: { productionPlan: 'array', plantId: 'string' },
      outputExample: { bottlenecks: 'array', utilizationRate: 'number' },
    });
  }

  // Procurement tools
  if (
    lowerInput.includes('procurement') ||
    lowerInput.includes('purchase order') ||
    lowerInput.includes('supplier')
  ) {
    suggestions.push({
      name: 'evaluate_supplier_performance',
      description: 'Score suppliers based on delivery, quality, and cost metrics',
      category: 'procurement',
      implementation: 'evaluateSupplierPerformance',
      agentIds: ['procurement_planner'],
      complexity: 'medium',
      inputExample: {
        supplierId: 'string',
        period: 'string',
        metrics: 'array',
      },
      outputExample: { score: 'number', rating: 'string', recommendations: 'array' },
    });
  }

  // Operations tools
  if (
    lowerInput.includes('kpi') ||
    lowerInput.includes('performance') ||
    lowerInput.includes('operations')
  ) {
    suggestions.push({
      name: 'get_consolidated_kpis',
      description: 'Fetch all key performance indicators across demand, supply, production, and procurement',
      category: 'operations',
      implementation: 'getConsolidatedKpis',
      agentIds: ['ops_head'],
      complexity: 'complex',
      inputExample: { period: 'string', departments: 'array' },
      outputExample: { kpis: 'object', trends: 'array', alerts: 'array' },
    });
  }

  // If no specific matches, suggest generic tools
  if (suggestions.length === 0) {
    suggestions.push({
      name: 'analyze_supply_chain_data',
      description: 'Generic tool to analyze supply chain data and provide insights',
      category: 'operations',
      implementation: 'analyzeSupplyChainData',
      agentIds: ['ops_head', 'demand_planner', 'supply_planner'],
      complexity: 'medium',
      inputExample: { dataType: 'string', filters: 'object' },
      outputExample: { insights: 'array', recommendations: 'array' },
    });
  }

  return suggestions;
}
