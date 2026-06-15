import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export default function ReviewerAgentDashboard() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
          <p className="text-gray-600 mt-1">Monitor and review all agent interactions</p>
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
          <CardDescription>Choose an agent to view detailed interactions and guidance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {summary?.agentStats?.map((agent: any) => (
              <Button
                key={agent.agentId}
                variant={selectedAgent === agent.agentId ? 'default' : 'outline'}
                onClick={() => setSelectedAgent(agent.agentId)}
                className="capitalize"
              >
                {agent.agentId.replace(/-/g, ' ')}
                <Badge className="ml-2 bg-blue-100 text-blue-800">{agent.interactionCount}</Badge>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed View */}
      {selectedAgent && (
        <Tabs defaultValue="interactions" className="w-full">
          <TabsList>
            <TabsTrigger value="interactions">Interactions</TabsTrigger>
            <TabsTrigger value="conversations">Conversations</TabsTrigger>
            <TabsTrigger value="guidance">Guidance</TabsTrigger>
          </TabsList>

          {/* Interactions Tab */}
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
                          {log.opsHeadIntervention && (
                            <div className="mt-2 p-2 bg-yellow-50 rounded text-sm">
                              <strong>Reviewer Guidance:</strong> {log.opsHeadGuidance}
                            </div>
                          )}
                        </div>
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
                <CardDescription>Guidance provided to {selectedAgent}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {guidance?.map((g: any) => (
                    <div key={g.guidanceId} className="border rounded-lg p-4 bg-blue-50">
                      <div className="flex items-start justify-between mb-2">
                        <Badge className="bg-blue-600">{g.guidanceType}</Badge>
                        <Badge variant={g.resolved ? 'default' : 'secondary'}>
                          {g.resolved ? 'Resolved' : 'Pending'}
                        </Badge>
                      </div>
                      <div className="mb-2">
                        <strong className="text-sm">Guidance:</strong>
                        <p className="text-sm text-gray-700 mt-1">{g.guidanceText}</p>
                      </div>
                      <div className="mb-2">
                        <strong className="text-sm">Suggested Action:</strong>
                        <p className="text-sm text-gray-700 mt-1 capitalize">{g.guidanceAction}</p>
                      </div>
                      {g.agentResponseAfterGuidance && (
                        <div>
                          <strong className="text-sm">Agent Response:</strong>
                          <p className="text-sm text-gray-700 mt-1">{g.agentResponseAfterGuidance}</p>
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-2">
                        {new Date(g.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                  {!guidance || guidance.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No pending guidance
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Agent Stats */}
      {summary?.agentStats && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Performance Metrics</CardTitle>
            <CardDescription>Quality metrics for all monitored agents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Agent</th>
                    <th className="text-center py-2 px-2">Total</th>
                    <th className="text-center py-2 px-2">Success</th>
                    <th className="text-center py-2 px-2">Blank</th>
                    <th className="text-center py-2 px-2">Error</th>
                    <th className="text-center py-2 px-2">Incomplete</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.agentStats.map((agent: any) => (
                    <tr key={agent.agentId} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2 capitalize">{agent.agentId.replace(/-/g, ' ')}</td>
                      <td className="text-center py-2 px-2">{agent.interactionCount}</td>
                      <td className="text-center py-2 px-2">
                        <Badge className="bg-green-100 text-green-800">
                          {agent.interactionCount - (agent.blankResponses + agent.errorResponses + agent.incompleteResponses)}
                        </Badge>
                      </td>
                      <td className="text-center py-2 px-2">
                        <Badge className="bg-yellow-100 text-yellow-800">{agent.blankResponses}</Badge>
                      </td>
                      <td className="text-center py-2 px-2">
                        <Badge className="bg-red-100 text-red-800">{agent.errorResponses}</Badge>
                      </td>
                      <td className="text-center py-2 px-2">
                        <Badge className="bg-orange-100 text-orange-800">{agent.incompleteResponses}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
