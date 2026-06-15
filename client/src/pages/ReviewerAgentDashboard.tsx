'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle, Clock, AlertTriangle, Eye, Code, MessageSquare, ArrowRight, RefreshCw, Wrench, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ─── Message type config ──────────────────────────────────────────────────────

const MESSAGE_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  review: { label: 'Review', color: 'bg-blue-100 text-blue-800', icon: <Eye className="w-3 h-3" /> },
  guidance: { label: 'Guidance', color: 'bg-amber-100 text-amber-800', icon: <MessageSquare className="w-3 h-3" /> },
  retry_request: { label: 'Retry', color: 'bg-purple-100 text-purple-800', icon: <RefreshCw className="w-3 h-3" /> },
  tool_request: { label: 'Tool Request', color: 'bg-orange-100 text-orange-800', icon: <Wrench className="w-3 h-3" /> },
  escalation: { label: 'Escalation', color: 'bg-red-100 text-red-800', icon: <AlertTriangle className="w-3 h-3" /> },
  resolution: { label: 'Resolution', color: 'bg-green-100 text-green-800', icon: <ShieldCheck className="w-3 h-3" /> },
};

function getAgentLabel(agentId: string): string {
  const labels: Record<string, string> = {
    reviewer_agent: '🔍 Reviewer',
    tool_agent: '🔧 Tool Agent',
    demand_planner: '📈 Demand Planner',
    supply_planner: '🚚 Supply Planner',
    production_planner: '🏭 Production Planner',
    procurement_planner: '🛒 Procurement Planner',
    ops_head: '👔 Ops Head',
  };
  return labels[agentId] || agentId;
}

export default function ReviewerAgentDashboard() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);

  // Fetch dashboard summary
  const { data: summary } = trpc.reviewerAgent.getDashboardSummary.useQuery();

  // Fetch reviewer stats
  const { data: reviewerStats } = trpc.reviewerAgent.getReviewerStats.useQuery();

  // Fetch supervision logs
  const { data: logs } = trpc.reviewerAgent.getSupervisionLogs.useQuery({
    limit: 50,
    agentId: selectedAgent || undefined,
  });

  // Fetch conversation history for selected agent
  const { data: conversations } = trpc.reviewerAgent.getAgentConversationHistory.useQuery(
    { agentId: selectedAgent || 'all', limit: 100 },
    { enabled: !!selectedAgent }
  );

  // Fetch guidance records
  const { data: guidance } = trpc.reviewerAgent.getAgentGuidance.useQuery(
    { agentId: selectedAgent || 'all', resolved: false },
    { enabled: !!selectedAgent }
  );

  // Fetch inter-agent conversations (reviewer ↔ agent dialogue)
  const { data: interAgentConvs } = trpc.reviewerAgent.getInterAgentConversations.useQuery({
    agentId: selectedAgent || undefined,
    limit: 100,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'blank': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'incomplete': return <Clock className="w-4 h-4 text-orange-500" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      success: 'bg-green-100 text-green-800',
      blank: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
      incomplete: 'bg-orange-100 text-orange-800',
    };
    return variants[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reviewer Agent Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Monitor all agent interactions, reviewer evaluations, and inter-agent communications
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Interventions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalInterventions ?? 0}</div>
            <p className="text-xs text-gray-600">Guidance provided to agents</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Guidance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary?.pendingGuidance ?? 0}</div>
            <p className="text-xs text-gray-600">Awaiting agent response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Reviewer Reviews</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{reviewerStats?.totalReviews ?? 0}</div>
            <p className="text-xs text-gray-600">LLM quality evaluations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.agentStats?.length ?? 0}</div>
            <p className="text-xs text-gray-600">Monitored agents</p>
          </CardContent>
        </Card>
      </div>

      {/* Reviewer Stats Row */}
      {reviewerStats && (reviewerStats.interventions > 0 || reviewerStats.toolRequests > 0) && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-purple-200 bg-purple-50">
            <CardContent className="pt-4">
              <div className="text-lg font-bold text-purple-700">{reviewerStats.interventions}</div>
              <p className="text-xs text-purple-600">Retries triggered</p>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-4">
              <div className="text-lg font-bold text-orange-700">{reviewerStats.toolRequests}</div>
              <p className="text-xs text-orange-600">Tool creation requests</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4">
              <div className="text-lg font-bold text-green-700">{reviewerStats.resolutions}</div>
              <p className="text-xs text-green-600">Resolved conversations</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Agent Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Filter by Agent</CardTitle>
          <CardDescription>Select an agent to view detailed interactions, or view all</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedAgent === null ? 'default' : 'outline'}
              onClick={() => setSelectedAgent(null)}
            >
              All Agents
            </Button>
            {summary?.agentStats?.map((agent: any) => (
              <Button
                key={agent.agentId}
                variant={selectedAgent === agent.agentId ? 'default' : 'outline'}
                onClick={() => setSelectedAgent(agent.agentId)}
                className="relative"
              >
                {agent.agentId}
                <Badge variant="secondary" className="ml-2">
                  {agent.interactionCount}
                </Badge>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="inter-agent" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="inter-agent">
            <MessageSquare className="w-4 h-4 mr-1" />
            Inter-Agent Chats
          </TabsTrigger>
          <TabsTrigger value="interactions">Interactions</TabsTrigger>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="guidance">Guidance</TabsTrigger>
          <TabsTrigger value="reasoning">Reasoning</TabsTrigger>
        </TabsList>

        {/* ── Inter-Agent Conversations Tab ── */}
        <TabsContent value="inter-agent">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-600" />
                Reviewer ↔ Agent Dialogue
              </CardTitle>
              <CardDescription>
                All reviewer evaluations, guidance messages, retry requests, and resolutions.
                This is the live inter-agent communication log.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!interAgentConvs || interAgentConvs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No inter-agent conversations yet</p>
                  <p className="text-sm mt-1">
                    Conversations will appear here once agents start responding to user queries.
                    The Reviewer Agent evaluates every response and logs its findings here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {interAgentConvs.map((conv: any) => {
                    const typeConfig = MESSAGE_TYPE_CONFIG[conv.messageType] || {
                      label: conv.messageType,
                      color: 'bg-gray-100 text-gray-800',
                      icon: null,
                    };
                    const isFromReviewer = conv.fromAgent === 'reviewer_agent';
                    return (
                      <div
                        key={conv.conversationId}
                        className={`border rounded-lg p-4 ${isFromReviewer ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white'}`}
                      >
                        {/* Header row */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-semibold text-sm">{getAgentLabel(conv.fromAgent)}</span>
                          <ArrowRight className="w-3 h-3 text-gray-400" />
                          <span className="font-semibold text-sm">{getAgentLabel(conv.toAgent)}</span>
                          <span className="ml-auto flex items-center gap-1">
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${typeConfig.color}`}>
                              {typeConfig.icon}
                              {typeConfig.label}
                            </span>
                          </span>
                        </div>

                        {/* Message body */}
                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                          {conv.message}
                        </p>

                        {/* Context details if present */}
                        {conv.context && conv.messageType === 'review' && conv.context.evaluation && (
                          <div className="mt-2 p-2 bg-white rounded border border-blue-100 text-xs">
                            <span className="font-medium text-blue-700">
                              Score: {conv.context.evaluation.score}/100
                            </span>
                            {conv.context.evaluation.issues?.length > 0 && (
                              <span className="ml-3 text-gray-600">
                                Issues: {conv.context.evaluation.issues.join('; ')}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Timestamp */}
                        <div className="text-xs text-gray-400 mt-2">
                          {conv.createdAt ? new Date(conv.createdAt).toLocaleString() : ''}
                          {conv.supervisionId && (
                            <span className="ml-2 font-mono opacity-60">session: {conv.sessionId?.substring(0, 12)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Interactions Tab ── */}
        <TabsContent value="interactions">
          <Card>
            <CardHeader>
              <CardTitle>Agent Interactions</CardTitle>
              <CardDescription>
                {selectedAgent ? `All recorded interactions for ${selectedAgent}` : 'All agent interactions'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {logs?.map((log: any) => (
                  <div key={log.supervisionId} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {getStatusIcon(log.responseStatus)}
                          <span className="font-medium text-sm">{log.question}</span>
                          <Badge className={getStatusBadge(log.responseStatus)}>
                            {log.responseStatus}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">{log.agentResponse}</p>
                        {log.toolsUsed && log.toolsUsed.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {log.toolsUsed.map((tool: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {tool}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSelectedLog(log); setShowPromptModal(true); }}
                        className="ml-2 shrink-0"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Prompt
                      </Button>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
                {(!logs || logs.length === 0) && (
                  <div className="text-center py-8 text-gray-500">No interactions recorded yet</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Conversations Tab ── */}
        <TabsContent value="conversations">
          <Card>
            <CardHeader>
              <CardTitle>Conversation History</CardTitle>
              <CardDescription>User ↔ Agent conversation log</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {conversations?.map((conv: any) => (
                  <div key={conv.conversationId} className="border rounded-lg p-4">
                    <Badge variant="outline" className="mb-2">{conv.conversationType}</Badge>
                    <div className="space-y-2">
                      <div>
                        <strong className="text-sm">User:</strong>
                        <p className="text-sm text-gray-700">{conv.userMessage}</p>
                      </div>
                      <div>
                        <strong className="text-sm">Agent:</strong>
                        <p className="text-sm text-gray-700">{conv.agentMessage}</p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      {new Date(conv.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
                {(!conversations || conversations.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    {selectedAgent ? 'No conversations recorded yet' : 'Select an agent to view conversations'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Guidance Tab ── */}
        <TabsContent value="guidance">
          <Card>
            <CardHeader>
              <CardTitle>Reviewer Guidance</CardTitle>
              <CardDescription>Guidance records issued by the Reviewer Agent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {guidance?.map((g: any) => (
                  <div key={g.guidanceId} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex gap-2">
                        <Badge>{g.guidanceType}</Badge>
                        <Badge variant="outline">{g.guidanceAction}</Badge>
                      </div>
                      <Badge variant={g.resolved ? 'default' : 'secondary'}>
                        {g.resolved ? 'Resolved' : 'Pending'}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium mb-2">{g.guidanceText}</p>
                    {g.agentResponseAfterGuidance && (
                      <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                        <strong>Agent Response:</strong> {g.agentResponseAfterGuidance}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-2">
                      {new Date(g.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
                {(!guidance || guidance.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    {selectedAgent ? 'No guidance records yet' : 'Select an agent to view guidance'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Reasoning Tab ── */}
        <TabsContent value="reasoning">
          <Card>
            <CardHeader>
              <CardTitle>Agent Reasoning & Tool Execution</CardTitle>
              <CardDescription>Internal reasoning and tool calls</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {logs?.map((log: any) => (
                  <div key={log.supervisionId} className="border rounded-lg p-4">
                    <div className="mb-2">
                      <span className="font-medium text-sm">{log.question}</span>
                      <Badge className={`ml-2 ${getStatusBadge(log.responseStatus)}`}>
                        {log.responseStatus}
                      </Badge>
                    </div>

                    {log.toolCalls && log.toolCalls.length > 0 && (
                      <div className="mt-3 p-3 bg-gray-50 rounded">
                        <div className="font-medium text-sm mb-2 flex items-center">
                          <Code className="w-4 h-4 mr-2" />
                          Tool Calls ({log.toolCalls.length})
                        </div>
                        <div className="space-y-2">
                          {log.toolCalls.map((tool: any, idx: number) => (
                            <div key={idx} className="text-xs bg-white p-2 rounded border">
                              <div className="font-mono font-bold">{tool.name}</div>
                              <div className="text-gray-600">Status: {tool.status}</div>
                              {tool.executionTime && (
                                <div className="text-gray-600">Time: {tool.executionTime}ms</div>
                              )}
                              {tool.result && (
                                <div className="mt-1 text-gray-700 max-h-32 overflow-y-auto">
                                  <pre className="text-xs">{JSON.stringify(tool.result, null, 2)}</pre>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {log.executionDetails && (
                      <div className="mt-3 p-3 bg-blue-50 rounded text-xs">
                        <div className="font-medium mb-2">Execution Details</div>
                        <div className="space-y-1 text-gray-700">
                          <div>Tools Used: {log.executionDetails.toolCount || 0}</div>
                          <div>Response Length: {log.executionDetails.responseLength || 0} chars</div>
                          {log.executionDetails.timestamp && (
                            <div>Timestamp: {new Date(log.executionDetails.timestamp).toLocaleString()}</div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-gray-500 mt-2">
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
                {(!logs || logs.length === 0) && (
                  <div className="text-center py-8 text-gray-500">No reasoning data available</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Prompt Visibility Modal */}
      <Dialog open={showPromptModal} onOpenChange={setShowPromptModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Prompt & Response</DialogTitle>
            <DialogDescription>
              Full system prompt and agent reasoning for: {selectedLog?.question}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-bold mb-2 flex items-center">
                <Code className="w-4 h-4 mr-2" />
                System Prompt
              </h3>
              <pre className="text-xs bg-white p-3 rounded border overflow-x-auto max-h-48">
                {selectedLog?.systemPrompt || 'No system prompt captured'}
              </pre>
            </div>

            <div className="border rounded-lg p-4 bg-blue-50">
              <h3 className="font-bold mb-2">User Question</h3>
              <p className="text-sm">{selectedLog?.question}</p>
            </div>

            <div className="border rounded-lg p-4 bg-green-50">
              <h3 className="font-bold mb-2">Agent Response</h3>
              <p className="text-sm">{selectedLog?.agentResponse}</p>
            </div>

            {selectedLog?.toolCalls && selectedLog.toolCalls.length > 0 && (
              <div className="border rounded-lg p-4 bg-yellow-50">
                <h3 className="font-bold mb-2">Tool Calls</h3>
                <pre className="text-xs bg-white p-3 rounded border overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.toolCalls, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
