import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Search, User, Bot, Clock } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const ACTION_STYLE: Record<string, string> = {
  approve: 'bg-emerald-100 text-emerald-700',
  reject: 'bg-red-100 text-red-700',
  override: 'bg-amber-100 text-amber-700',
  agent_action: 'bg-blue-100 text-blue-700',
  plan_created: 'bg-violet-100 text-violet-700',
  plan_approved: 'bg-emerald-100 text-emerald-700',
  settings_changed: 'bg-slate-100 text-slate-700',
  data_import: 'bg-cyan-100 text-cyan-700',
};

export default function AuditTrail() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [actorType, setActorType] = useState('all');
  const [page, setPage] = useState(0);

  const { data, isLoading } = trpc.audit.list.useQuery({ search: q, actorType: actorType === 'all' ? undefined : actorType, offset: page * 50 });

  return (
    <div className="p-6 space-y-4 bg-slate-50 min-h-full">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-slate-700" />
          Audit Trail
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Immutable log of all agent actions, approvals, and overrides</p>
      </div>

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input className="pl-9" placeholder="Search actions, actors..." value={search}
                onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && setQ(search)} />
            </div>
            <Select value={actorType} onValueChange={setActorType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Actor type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actors</SelectItem>
                <SelectItem value="human">Human</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
            <button onClick={() => { setQ(search); setPage(0); }}
              className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors">
              Filter
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : !data || data.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No audit records found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.map(entry => (
                <div key={entry.id} className="flex items-start gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className={`p-1.5 rounded-full mt-0.5 ${entry.actorType === 'human' ? 'bg-blue-100' : entry.actorType === 'agent' ? 'bg-violet-100' : 'bg-slate-100'}`}>
                    {entry.actorType === 'human' ? <User className="w-3.5 h-3.5 text-blue-600" /> : <Bot className="w-3.5 h-3.5 text-violet-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-800">{entry.actorName || 'System'}</span>
                      <Badge className={`text-xs capitalize ${ACTION_STYLE[entry.action ?? ''] || 'bg-slate-100 text-slate-700'}`}>{(entry.action ?? '').replace(/_/g, ' ')}</Badge>
                      {entry.entityType && <span className="text-xs text-slate-500">{entry.entityType} #{entry.entityId}</span>}
                    </div>
                    {entry.description && <p className="text-xs text-slate-600 mt-0.5 truncate">{entry.description}</p>}
                    {entry.reason && (
                      <p className="text-xs text-slate-500 mt-0.5 italic">Reason: {entry.reason}</p>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span title={entry.createdAt ? format(new Date(entry.createdAt), 'PPpp') : ''}>
                      {entry.createdAt ? formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true }) : 'Unknown'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {data && data.length === 50 && (
            <div className="p-3 border-t border-slate-100 flex justify-between items-center">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">
                Previous
              </button>
              <span className="text-xs text-slate-400">Page {page + 1}</span>
              <button onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-slate-50">
                Next
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
