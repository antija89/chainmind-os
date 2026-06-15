import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Bot, Edit2, Save, X, ChevronDown, ChevronUp, Wrench } from 'lucide-react';
import { toast } from 'sonner';

const AGENT_COLORS: Record<string, string> = {
  'Demand Planner': 'bg-blue-100 text-blue-700 border-blue-200',
  'Supply Planner': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Production Planner': 'bg-violet-100 text-violet-700 border-violet-200',
  'Procurement Planner': 'bg-orange-100 text-orange-700 border-orange-200',
  'Ops Head': 'bg-red-100 text-red-700 border-red-200',
};

type Agent = {
  agentId: string;
  roleTitle: string | null;
  shortCode: string | null;
  domain: string | null;
  seniority: string | null;
  tone: string | null;
  icon: string | null;
  color: string | null;
  instructionStack: unknown;
  kpiTargets: unknown;
  status: string | null;
  reportsTo: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

function AgentCard({ agent, onEdit }: { agent: Agent; onEdit: (a: Agent) => void }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = AGENT_COLORS[agent.roleTitle ?? ''] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg border ${colorClass}`}>
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{agent.roleTitle ?? agent.agentId}</h3>
              <p className="text-xs text-slate-500">{agent.domain ?? agent.seniority ?? ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={agent.status === 'active' ? 'default' : 'secondary'} className="text-xs">
              {agent.status === 'active' ? 'Active' : 'Inactive'}
            </Badge>
            <button onClick={() => onEdit(agent)}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-800">
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Domain</p>
          <p className={`text-sm text-slate-700 leading-relaxed ${!expanded ? 'line-clamp-3' : ''}`}>
            {agent.domain ?? 'No domain description set.'}
          </p>
          {(agent.domain ?? '').length > 200 && (
            <button onClick={() => setExpanded(!expanded)}
              className="text-xs text-blue-600 hover:text-blue-700 mt-1 flex items-center gap-1">
              {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show more</>}
            </button>
          )}
        </div>
        {Array.isArray(agent.instructionStack) && (agent.instructionStack as string[]).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Wrench className="w-3 h-3" /> Instructions ({(agent.instructionStack as string[]).length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(agent.instructionStack as string[]).slice(0, 3).map((t: string, i: number) => (
                <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditDialog({ agent, open, onClose }: { agent: Agent; open: boolean; onClose: () => void }) {
  const stackStr = Array.isArray(agent.instructionStack)
    ? (agent.instructionStack as string[]).join('\n')
    : typeof agent.instructionStack === 'string' ? agent.instructionStack : '';
  const [instructionStack, setInstructionStack] = useState(stackStr);
  const utils = trpc.useUtils();

  const updateMutation = trpc.agents.updateInstructions.useMutation({
    onSuccess: () => {
      toast.success(`${agent.roleTitle ?? agent.agentId} instructions updated`);
      utils.agents.list.invalidate();
      onClose();
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" /> Edit: {agent.roleTitle ?? agent.agentId}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">Agent Domain</label>
            <p className="text-xs text-slate-500 p-2 bg-slate-50 rounded border">{agent.domain ?? 'No domain set'}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">Instruction Stack (one per line)</label>
            <Textarea value={instructionStack} onChange={e => setInstructionStack(e.target.value)}
              className="min-h-[160px] font-mono text-xs" placeholder="Step 1: Always check inventory first&#10;Step 2: Validate against safety stock..." />
            <p className="text-xs text-slate-400 mt-1">Ordered instructions the agent follows for each task.</p>
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="flex items-center gap-1.5 px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
            <X className="w-4 h-4" /> Cancel
          </button>
          <button
            onClick={() => updateMutation.mutate({ agentId: agent.agentId, instructionStack: instructionStack.split('\n').filter(Boolean) })}
            disabled={updateMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AgentRoster() {
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const { data: agents, isLoading } = trpc.agents.list.useQuery();

  return (
    <div className="p-6 space-y-4 bg-slate-50 min-h-full">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Bot className="w-6 h-6 text-slate-700" />
          Agent Roster
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage agent configurations, system prompts, and instruction stacks</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(agents ?? []).map(agent => (
            <AgentCard key={agent.agentId} agent={agent as Agent} onEdit={setEditAgent} />
          ))}
        </div>
      )}

      {editAgent && (
        <EditDialog agent={editAgent} open={!!editAgent} onClose={() => setEditAgent(null)} />
      )}
    </div>
  );
}
