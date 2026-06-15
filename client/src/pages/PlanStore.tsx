import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, GitBranch, Plus, CheckCircle, Clock, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/_core/hooks/useAuth';

type PlanRow = {
  planId: string;
  version: number | null;
  type: string | null;
  agentId: string | null;
  status: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  dataPayload: unknown;
};

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  under_review: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  draft: <FileText className="w-3.5 h-3.5" />,
  under_review: <Clock className="w-3.5 h-3.5" />,
  approved: <CheckCircle className="w-3.5 h-3.5" />,
  rejected: <AlertCircle className="w-3.5 h-3.5" />,
};

function PlanCard({ plan, onViewDiff, onUpdateStatus }: {
  plan: PlanRow;
  onViewDiff: (plan: PlanRow) => void;
  onUpdateStatus: (planId: string, status: string) => void;
}) {
  const status = plan.status ?? 'draft';
  return (
    <Card className="border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900">{plan.type ?? 'Plan'} Plan</span>
              <Badge className={`flex items-center gap-1 text-xs ${STATUS_STYLE[status] ?? STATUS_STYLE.draft}`}>
                {STATUS_ICON[status]} {status.replace('_', ' ').toUpperCase()}
              </Badge>
              <Badge variant="outline" className="text-xs">v{plan.version ?? 1}</Badge>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-3 text-xs text-slate-500">
              <div><span className="font-medium text-slate-400 uppercase tracking-wide">Plan ID</span><p className="text-slate-700 font-mono mt-0.5">{plan.planId}</p></div>
              <div><span className="font-medium text-slate-400 uppercase tracking-wide">Agent</span><p className="text-slate-700 mt-0.5">{plan.agentId ?? '—'}</p></div>
              <div><span className="font-medium text-slate-400 uppercase tracking-wide">Created</span><p className="text-slate-700 mt-0.5">{plan.createdAt ? formatDistanceToNow(new Date(plan.createdAt), { addSuffix: true }) : '—'}</p></div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <Button size="sm" variant="outline" className="text-xs" onClick={() => onViewDiff(plan)}>
              <GitBranch className="w-3.5 h-3.5 mr-1" /> Diff
            </Button>
            <Button size="sm" variant="outline" className="text-xs">
              <Eye className="w-3.5 h-3.5 mr-1" /> View
            </Button>
            {status === 'draft' && (
              <Button size="sm" className="text-xs bg-amber-500 hover:bg-amber-600 text-white" onClick={() => onUpdateStatus(plan.planId, 'under_review')}>
                Submit
              </Button>
            )}
            {status === 'under_review' && (
              <Button size="sm" className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => onUpdateStatus(plan.planId, 'approved')}>
                Approve
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DiffPanel({ plan, onClose }: { plan: PlanRow; onClose: () => void }) {
  const payload = plan.dataPayload as Record<string, unknown> | null;
  const changes = payload?.changes as Array<{ field: string; from: unknown; to: unknown }> | undefined;
  const summary = payload?.summary as string | undefined;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-slate-600" />
            Version Diff — {plan.type} Plan v{plan.version}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {summary && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              {summary}
            </div>
          )}
          {changes && changes.length > 0 ? (
            <div className="space-y-2">
              {changes.map((c, i) => (
                <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                  <span className="font-medium text-slate-700">{c.field}:</span>
                  <span className="ml-2 text-red-600 line-through">{String(c.from)}</span>
                  <span className="mx-2 text-slate-400">→</span>
                  <span className="text-emerald-700">{String(c.to)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No structured diff available for this plan version.</p>
              <p className="text-xs mt-1">Diff data is populated when agents update plans via the chat interface.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreatePlanDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState('Demand');
  const { user } = useAuth();
  const createMutation = trpc.plans.create.useMutation({
    onSuccess: () => { toast.success('Plan created'); onCreated(); onClose(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Create New Plan</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Plan Type</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Demand', 'Supply', 'Production', 'Procurement'].map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => createMutation.mutate({ type, agentId: user?.openId ?? 'manual', dataPayload: { changes: [], summary: 'Manually created plan' }, version: 1 })}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PlanStore() {
  const [diffPlan, setDiffPlan] = useState<PlanRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const utils = trpc.useUtils();

  const { data: plans, isLoading } = trpc.plans.list.useQuery({});

  const updateStatusMutation = trpc.plans.updateStatus.useMutation({
    onSuccess: () => { toast.success('Plan status updated'); utils.plans.list.invalidate(); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const handleUpdateStatus = (planId: string, status: string) => {
    updateStatusMutation.mutate({ planId, status: status as 'draft' | 'under_review' | 'approved' | 'rejected' });
  };

  const filterByStatus = (status: string) => (plans ?? []).filter(p => p.status === status) as PlanRow[];
  const allPlans = (plans ?? []) as PlanRow[];

  const tabContent = (filtered: PlanRow[]) => (
    isLoading ? (
      <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
    ) : filtered.length === 0 ? (
      <Card className="border border-slate-200"><CardContent className="py-12 text-center text-slate-400">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No plans in this category</p>
      </CardContent></Card>
    ) : (
      <div className="space-y-3">
        {filtered.map(plan => (
          <PlanCard key={plan.planId} plan={plan} onViewDiff={setDiffPlan} onUpdateStatus={handleUpdateStatus} />
        ))}
      </div>
    )
  );

  return (
    <div className="p-6 space-y-5 bg-slate-50 min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-slate-700" /> Plan Store
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Versioned demand and supply plans with approval workflow</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New Plan
        </Button>
      </div>

      <div className="flex gap-3 text-sm">
        {['all', 'draft', 'under_review', 'approved'].map(s => {
          const count = s === 'all' ? allPlans.length : filterByStatus(s).length;
          return (
            <div key={s} className={`px-3 py-1.5 rounded-full border text-xs font-medium ${STATUS_STYLE[s] ?? 'bg-slate-100 text-slate-600'}`}>
              {s === 'all' ? 'All' : s.replace('_', ' ')} ({count})
            </div>
          );
        })}
      </div>

      <Tabs defaultValue="all">
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="all">All Plans</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="under_review">Under Review</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-4">{tabContent(allPlans)}</TabsContent>
        <TabsContent value="approved" className="mt-4">{tabContent(filterByStatus('approved'))}</TabsContent>
        <TabsContent value="under_review" className="mt-4">{tabContent(filterByStatus('under_review'))}</TabsContent>
        <TabsContent value="draft" className="mt-4">{tabContent(filterByStatus('draft'))}</TabsContent>
      </Tabs>

      {diffPlan && <DiffPanel plan={diffPlan} onClose={() => setDiffPlan(null)} />}
      {showCreate && <CreatePlanDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={() => utils.plans.list.invalidate()} />}
    </div>
  );
}
