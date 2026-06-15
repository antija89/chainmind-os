'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle, Clock, AlertTriangle, Eye, Code } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function ReviewerAgentDashboard() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);

  // Fetch dashboard summary
  const { data: summary } = trpc.reviewerAgent.getDashboardSummary.useQuery();

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'blank':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'incomplete':
        return <Clock className="w-4 h-4 text-orange-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
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
          <p className="text-gray-600 mt-1">Monitor and review all agent interactions with full prompt visibility</p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Interventions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalInterventions}</div>
              <p className="text-xs text-gray-600">Guidance provided to agents</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending Guidance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summary.pendingGuidance}</div>
              <p className="text-xs text-gray-600">Awaiting agent response</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.agentStats?.length || 0}</div>
              <p className="text-xs text-gray-600">Monitored agents</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Agent Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Agent to Review</CardTitle>
          <CardDescription>Choose an agent to view detailed interactions and prompts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
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

      {/* Tabs for Interactions, Conversations, Guidance, and Reasoning */}
      {selectedAgent && (
        <Tabs defaultValue="interactions" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="interactions">Interactions</TabsTrigger>
            <TabsTrigger value="conversations">Conversations</TabsTrigger>
            <TabsTrigger value="guidance">Guidance</TabsTrigger>
            <TabsTrigger value="reasoning">Reasoning</TabsTrigger>
          </TabsList>

          {/* Interactions Tab - with Prompt Visibility */}
          <TabsContent value="interactions">
            <Card>
              <CardHeader>
                <CardTitle>Agent Interactions</CardTitle>
                <CardDescription>All recorded interactions for {selectedAgent}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {logs?.map((log: any) => (
                    <div key={log.supervisionId} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusIcon(log.responseStatus)}
                            <span className="font-medium">{log.question}</span>
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
                          onClick={() => {
                            setSelectedLog(log);
                            setShowPromptModal(true);
                          }}
                          className="ml-2"
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
                  {!logs || logs.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No interactions recorded yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conversations Tab */}
          <TabsContent value="conversations">
            <Card>
              <CardHeader>
                <CardTitle>Conversation History</CardTitle>
                <CardDescription>Full conversation log for {selectedAgent}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {conversations?.map((conv: any) => (
                    <div key={conv.conversationId} className="border rounded-lg p-4">
                      <div className="mb-2">
                        <Badge variant="outline" className="mb-2">
                          {conv.conversationType}
                        </Badge>
                      </div>
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
                  {!conversations || conversations.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No conversations recorded yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Guidance Tab */}
          <TabsContent value="guidance">
            <Card>
              <CardHeader>
                <CardTitle>Reviewer Guidance</CardTitle>
                <CardDescription>Guidance records for {selectedAgent}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {guidance?.map((g: any) => (
                    <div key={g.guidanceId} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <Badge>{g.guidanceType}</Badge>
                          <Badge variant="outline" className="ml-2">
                            {g.guidanceAction}
                          </Badge>
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
                  {!guidance || guidance.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No guidance records yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reasoning Tab - Shows Tool Calls and Execution Details */}
          <TabsContent value="reasoning">
            <Card>
              <CardHeader>
                <CardTitle>Agent Reasoning & Tool Execution</CardTitle>
                <CardDescription>Internal reasoning and tool calls for {selectedAgent}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {logs?.map((log: any) => (
                    <div key={log.supervisionId} className="border rounded-lg p-4">
                      <div className="mb-2">
                        <span className="font-medium">{log.question}</span>
                        <Badge className={`ml-2 ${getStatusBadge(log.responseStatus)}`}>
                          {log.responseStatus}
                        </Badge>
                      </div>

                      {/* Tool Calls */}
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

                      {/* Execution Details */}
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
                  {!logs || logs.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No reasoning data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

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
            {/* System Prompt */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-bold mb-2 flex items-center">
                <Code className="w-4 h-4 mr-2" />
                System Prompt
              </h3>
              <pre className="text-xs bg-white p-3 rounded border overflow-x-auto max-h-48">
                {selectedLog?.systemPrompt || 'No system prompt captured'}
              </pre>
            </div>

            {/* User Question */}
            <div className="border rounded-lg p-4 bg-blue-50">
              <h3 className="font-bold mb-2">User Question</h3>
              <p className="text-sm">{selectedLog?.question}</p>
            </div>

            {/* Agent Response */}
            <div className="border rounded-lg p-4 bg-green-50">
              <h3 className="font-bold mb-2">Agent Response</h3>
              <p className="text-sm">{selectedLog?.agentResponse}</p>
            </div>

            {/* Tool Calls */}
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
