import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter } from "lucide-react";

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  reason: string;
  impact: Record<string, any>;
}

export default function AuditTrail() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState("all");

  const auditLogs: AuditEntry[] = [
    {
      id: "log-001",
      timestamp: "2024-06-14 14:32:15",
      actor: "Ahmed (Demand Planner)",
      action: "PLAN_PUBLISHED",
      resource: "Demand Plan W24-26 v5",
      reason: "Forecast confidence reached 88%, ready for supply review",
      impact: { status: "draft -> under_review", version: 5 },
    },
    {
      id: "log-002",
      timestamp: "2024-06-14 13:45:22",
      actor: "Fatima (Supply Planner)",
      action: "PLAN_CREATED",
      resource: "Supply Plan Q3 2024 v1",
      reason: "Initial supply plan based on demand forecast",
      impact: { status: "draft", version: 1 },
    },
    {
      id: "log-003",
      timestamp: "2024-06-14 12:15:08",
      actor: "Ops Head (Human)",
      action: "HIL_APPROVED",
      resource: "PO-2024-001 (AED 84,500)",
      reason: "Strategic supplier, favorable terms, approved for procurement",
      impact: { po_status: "pending -> approved", value: 84500 },
    },
    {
      id: "log-004",
      timestamp: "2024-06-14 11:20:33",
      actor: "Mohammed (Production Planner)",
      action: "SCHEDULE_UPDATED",
      resource: "Production Schedule W24",
      reason: "Capacity constraint detected, rescheduled SKU-001 to W25",
      impact: { lines_affected: 2, changeovers: 3 },
    },
    {
      id: "log-005",
      timestamp: "2024-06-14 10:05:12",
      actor: "System",
      action: "DATA_REFRESH",
      resource: "Sales History & Inventory",
      reason: "Automatic S&OP data refresh cycle",
      impact: { records_updated: 1250, duration_ms: 3420 },
    },
  ];

  const actionColors: Record<string, string> = {
    PLAN_PUBLISHED: "bg-green-100 text-green-800",
    PLAN_CREATED: "bg-blue-100 text-blue-800",
    HIL_APPROVED: "bg-purple-100 text-purple-800",
    SCHEDULE_UPDATED: "bg-amber-100 text-amber-800",
    DATA_REFRESH: "bg-gray-100 text-gray-800",
  };

  const filtered = auditLogs.filter((log) => {
    const matchesSearch =
      log.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterAction === "all" || log.action === filterAction;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Audit Trail</h1>
        <p className="text-gray-600 mt-1">Immutable log of all system actions and decisions</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search by actor, action, or resource..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filter
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {filtered.map((log) => (
          <Card key={log.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Time</p>
                  <p className="text-sm font-mono text-gray-900">{log.timestamp}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Actor</p>
                  <p className="text-sm text-gray-900">{log.actor}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Action</p>
                  <Badge className={actionColors[log.action] || "bg-gray-100 text-gray-800"}>
                    {log.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Resource</p>
                  <p className="text-sm text-gray-900">{log.resource}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Reason</p>
                  <p className="text-sm text-gray-700">{log.reason}</p>
                </div>
              </div>

              {Object.keys(log.impact).length > 0 && (
                <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="text-xs font-medium text-gray-600 mb-2">Impact</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {Object.entries(log.impact).map(([key, value]) => (
                      <div key={key} className="font-mono">
                        <span className="text-gray-600">{key}:</span>{" "}
                        <span className="text-gray-900 font-semibold">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
