import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

type HilGate = {
  id: number;
  title: string;
  description: string;
  agentName: string;
  gateType: string;
  priority: string;
  status: string;
  requestedData?: string | null;
  createdAt: Date;
};

const PRIORITY_STYLE: Record<string, string> = {
  urgent: 'border-l-red-500 bg-red-50',
  normal: 'border-l-amber-500 bg-amber-50',
  low: 'border-l-blue-500 bg-blue-50',
};

const PRIORITY_BADGE: Record<string, 'destructive' | 'default' | 'secondary'> = {
  urgent: 'destructive',
  normal: 'default',
  low: 'secondary',
};

function ActionDialog({ gate, action, open, onClose, onConfirm }: {
  gate: HilGate; action: 'approve' | 'reject' | 'override';
  open: boolean; onClose: () => void; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const labels = { approve: 'Approve', reject: 'Reject', override: 'Override' };
  const colors = { approve: 'bg-emerald-600 hover:bg-emerald-700', reject: 'bg-red-600 hover:bg-red-700', override: 'bg-amber-600 hover:bg-amber-700' };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === 'approve' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
            {action === 'reject' && <XCircle className="w-5 h-5 text-red-600" />}
            {action === 'override' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
            {labels[action]}: {gate.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-slate-600">{gate.description}</p>
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1 block">
              Reason <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder={`Enter reason for ${action}...`}
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="min-h-[80px]"
            />
            <p className="text-xs text-slate-400 mt-1">Reason is mandatory and will be logged in the audit trail.</p>
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          <button
            onClick={() => { if (!reason.trim()) { toast.error('Reason is required'); return; } onConfirm(reason); }}
            className={`px-4 py-2 text-sm text-white rounded-lg transition-colors ${colors[action]}`}
          >
            Confirm {labels[action]}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function HilInbox() {
  const [dialog, setDialog] = useState<{ gate: HilGate; action: 'approve' | 'reject' | 'override' } | null>(null);
  const utils = trpc.useUtils();

  const { data: gates, isLoading } = trpc.hil.list.useQuery({ status: 'pending' });

  const respondMutation = trpc.hil.respond.useMutation({
    onSuccess: () => {
      toast.success('Response recorded and audit trail updated');
      utils.hil.list.invalidate();
      utils.dashboard.kpis.invalidate();
      setDialog(null);
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const handleConfirm = (reason: string) => {
    if (!dialog) return;
    respondMutation.mutate({ id: dialog.gate.id, action: dialog.action, reason });
  };

  const pendingCount = gates?.length ?? 0;

  return (
    <div className="p-6 space-y-4 bg-slate-50 min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Inbox className="w-6 h-6 text-slate-700" />
            HIL Inbox
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Human-in-the-loop approvals — items requiring your decision</p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="destructive" className="text-sm px-3 py-1">{pendingCount} Pending</Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : !gates || gates.length === 0 ? (
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="py-16 text-center text-slate-400">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">All clear!</p>
            <p className="text-sm mt-1">No pending approvals at this time.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {gates.map(gate => (
            <Card key={gate.id} className={`border-l-4 border border-slate-200 shadow-sm ${PRIORITY_STYLE[gate.priority ?? 'normal'] || PRIORITY_STYLE.normal}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">{gate.title}</span>
                      <Badge variant={PRIORITY_BADGE[gate.priority ?? 'normal'] || 'default'} className="text-xs capitalize">{gate.priority ?? 'normal'}</Badge>
                      <Badge variant="outline" className="text-xs">{gate.gateType}</Badge>
                      <Badge variant="outline" className="text-xs text-slate-500">{gate.agentName}</Badge>
                    </div>
                    <p className="text-sm text-slate-600 mt-1.5">{gate.description}</p>
                    {gate.requestedData && (
                      <div className="mt-2 p-2 bg-white rounded border border-slate-200 text-xs text-slate-600 font-mono max-h-20 overflow-y-auto">
                        {gate.requestedData}
                      </div>
                    )}
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {gate.createdAt ? formatDistanceToNow(new Date(gate.createdAt), { addSuffix: true }) : 'Unknown time'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => setDialog({ gate: gate as HilGate, action: 'approve' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => setDialog({ gate: gate as HilGate, action: 'reject' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                    <button
                      onClick={() => setDialog({ gate: gate as HilGate, action: 'override' })}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-xs rounded-lg hover:bg-amber-600 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Override
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {dialog && (
        <ActionDialog
          gate={dialog.gate}
          action={dialog.action}
          open={!!dialog}
          onClose={() => setDialog(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
