import React from "react";
import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

import { ExternalLink, RefreshCw, Search, ChevronDown, ChevronUp, Clock, Cpu, Hash, Zap } from 'lucide-react';
import type { ReactNode } from 'react';

type CallType = 'primary' | 'followup' | 'retry' | 'reviewer';
type Status = 'success' | 'error' | 'empty';

interface LlmLog {
  id: string;
  agentId: string;
  agentName: string;
  sessionId?: string | null;
  callType: CallType;
  model?: string | null;
  apiUrl?: string | null;
  inputMessages: any;
  inputTools?: any;
  toolChoice?: string | null;
  outputContent?: string | null;
  outputToolCalls?: any;
  finishReason?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  durationMs?: number | null;
  status: Status;
  errorMessage?: string | null;
  createdAt?: Date | null;
}

const callTypeBadge: Record<CallType, string> = {
  primary: 'bg-blue-100 text-blue-800',
  followup: 'bg-purple-100 text-purple-800',
  retry: 'bg-amber-100 text-amber-800',
  reviewer: 'bg-teal-100 text-teal-800',
};

const statusBadge: Record<Status, string> = {
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  empty: 'bg-gray-100 text-gray-700',
};

function JsonViewer({ data, label }: { data: any; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const str = JSON.stringify(data, null, 2);
  const preview = str.length > 200 ? str.slice(0, 200) + '...' : str;
  return (
    <div className="mt-2">
      <button
        className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800"
        onClick={() => setExpanded(e => !e)}
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {label}
      </button>
      <pre className="mt-1 text-xs bg-gray-50 rounded p-2 overflow-auto max-h-64 border border-gray-200 whitespace-pre-wrap">
        {expanded ? str : preview}
      </pre>
    </div>
  );
}

function LogRow({ log, onClick }: { log: LlmLog; onClick: () => void }) {
  const ts = log.createdAt ? new Date(log.createdAt).toLocaleString() : '—';
  const outputPreview = log.outputContent
    ? log.outputContent.slice(0, 120) + (log.outputContent.length > 120 ? '…' : '')
    : log.errorMessage
    ? `Error: ${log.errorMessage.slice(0, 80)}`
    : '(empty)';

  return (
    <div
      className="border border-gray-200 rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${callTypeBadge[log.callType]}`}>
            {log.callType}
          </span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadge[log.status]}`}>
            {log.status}
          </span>
          <span className="text-xs text-gray-600 font-medium">{log.agentName}</span>
          {log.model && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-mono">{log.model}</span>
          )}
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">{ts}</span>
      </div>
      <p className="mt-1.5 text-sm text-gray-700 line-clamp-2">{outputPreview}</p>
      <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
        {log.durationMs != null && (
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{log.durationMs}ms</span>
        )}
        {log.totalTokens != null && (
          <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{log.totalTokens} tokens</span>
        )}
        {log.finishReason && (
          <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{log.finishReason}</span>
        )}
        {log.apiUrl && (
          <a
            href={log.apiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-500 hover:underline"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3" />API
          </a>
        )}
      </div>
    </div>
  );
}

function ToolCallsViewer({ data }: { data: any }) {
  if (!Array.isArray(data) || data.length === 0) return null;
  return <JsonViewer data={data} label={`Tool Calls (${data.length})`} />;
}

function LogDetail({ log, onClose }: { log: LlmLog; onClose: () => void }) {
  const ts = log.createdAt ? new Date(log.createdAt).toLocaleString() : '—';
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${callTypeBadge[log.callType]}`}>
              {log.callType}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadge[log.status]}`}>
              {log.status}
            </span>
            <span className="text-sm font-medium">{log.agentName}</span>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-3 text-sm">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 bg-gray-50 rounded p-3">
              <div><span className="font-medium">ID:</span> <span className="font-mono">{log.id}</span></div>
              <div><span className="font-medium">Time:</span> {ts}</div>
              <div><span className="font-medium">Agent:</span> {log.agentName} ({log.agentId})</div>
              <div><span className="font-medium">Session:</span> {log.sessionId ?? '—'}</div>
              <div><span className="font-medium">Model:</span> <span className="font-mono">{log.model ?? '—'}</span></div>
              <div><span className="font-medium">Finish:</span> {log.finishReason ?? '—'}</div>
              <div><span className="font-medium">Duration:</span> {log.durationMs != null ? `${log.durationMs}ms` : '—'}</div>
              <div><span className="font-medium">Tokens:</span> {log.promptTokens ?? 0}p / {log.completionTokens ?? 0}c / {log.totalTokens ?? 0}t</div>
            </div>

            {/* API URL */}
            {log.apiUrl && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">API Endpoint</p>
                <a
                  href={log.apiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-mono break-all"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />{log.apiUrl}
                </a>
              </div>
            )}

            <div className="border-t border-gray-200 my-2" />

            {/* Output */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Output</p>
              {(() => {
                if (log.status === 'error' && log.errorMessage) {
                  return <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">{log.errorMessage}</div>;
                }
                if (log.outputContent) {
                  return <div className="bg-green-50 border border-green-200 rounded p-2 text-xs text-gray-800 whitespace-pre-wrap">{log.outputContent}</div>;
                }
                return <div className="bg-gray-50 border border-gray-200 rounded p-2 text-xs text-gray-400 italic">(empty response)</div>;
              })()}
            </div>

            <ToolCallsViewer data={log.outputToolCalls} />

            <div className="border-t border-gray-200 my-2" />

            {/* Input messages */}
            <JsonViewer data={log.inputMessages} label="Input Messages" />

            {/* Input tools */}
            {log.inputTools && Array.isArray(log.inputTools) && log.inputTools.length > 0 && (
              <JsonViewer data={log.inputTools} label={`Tools Available (${(log.inputTools as unknown[]).length})`} />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function StatsBar() {
  const { data: stats } = trpc.reviewerAgent.getLlmLogStats.useQuery();
  if (!stats) return null;
  const statItems: { label: string; value: string | number; icon: ReactNode }[] = [
    { label: 'Total Calls', value: stats.total, icon: <Cpu className="w-4 h-4 text-blue-500" /> },
    { label: 'Success', value: stats.successCount, icon: <Zap className="w-4 h-4 text-green-500" /> },
    { label: 'Avg Duration', value: `${stats.avgDuration}ms`, icon: <Clock className="w-4 h-4 text-amber-500" /> },
    { label: 'Total Tokens', value: stats.totalTokens.toLocaleString(), icon: <Hash className="w-4 h-4 text-purple-500" /> },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {statItems.map(s => (
        <Card key={s.label} className="py-3">
          <CardContent className="px-4 flex items-center gap-3">
            {s.icon}
            <div>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-lg font-bold text-gray-800">{s.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function LlmLogs() {
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState<string | undefined>(undefined);
  const [selectedLog, setSelectedLog] = useState<LlmLog | null>(null);

  const { data: logs = [], isLoading, refetch } = trpc.reviewerAgent.getLlmLogs.useQuery({
    agentId: agentFilter,
    limit: 100,
  });

  const filtered = (logs as LlmLog[]).filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.agentName.toLowerCase().includes(q) ||
      (l.model ?? '').toLowerCase().includes(q) ||
      (l.outputContent ?? '').toLowerCase().includes(q) ||
      l.callType.includes(q) ||
      l.status.includes(q)
    );
  });

  const agentNames = Array.from(new Set((logs as LlmLog[]).map(l => l.agentName)));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LLM API Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Full input/output for every LLM call — model, endpoint, tokens, duration</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" />Refresh
        </Button>
      </div>

      <StatsBar />

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by agent, model, output..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <select
          className="border border-gray-200 rounded-md px-3 text-sm text-gray-700 bg-white"
          value={agentFilter ?? ''}
          onChange={e => setAgentFilter(e.target.value || undefined)}
        >
          <option value="">All Agents</option>
          {agentNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="mb-3">
          <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
          <TabsTrigger value="primary">Primary</TabsTrigger>
          <TabsTrigger value="followup">Follow-up</TabsTrigger>
          <TabsTrigger value="retry">Retry</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>

        {(['all', 'primary', 'followup', 'retry', 'errors'] as const).map(tab => {
          const tabLogs = filtered.filter(l => {
            if (tab === 'all') return true;
            if (tab === 'errors') return l.status === 'error' || l.status === 'empty';
            return l.callType === tab;
          });
          return (
            <TabsContent key={tab} value={tab}>
              {isLoading ? (
                <div className="text-center py-12 text-gray-400">Loading logs…</div>
              ) : tabLogs.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  No logs yet. Send a message to any agent to generate LLM calls.
                </div>
              ) : (
                <div className="space-y-2">
                  {tabLogs.map(log => (
                    <LogRow key={log.id} log={log} onClick={() => setSelectedLog(log)} />
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {selectedLog && (
        <LogDetail log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
}
