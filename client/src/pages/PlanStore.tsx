import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Download, GitBranch } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  type: string;
  agent: string;
  version: number;
  status: "draft" | "under_review" | "approved";
  createdAt: string;
  createdBy: string;
}

export default function PlanStore() {
  const [plans, setPlans] = useState<Plan[]>([
    {
      id: "plan-001",
      name: "Demand Plan W24-26",
      type: "Demand",
      agent: "Demand Planner",
      version: 5,
      status: "approved",
      createdAt: "2024-06-14",
      createdBy: "Ahmed",
    },
    {
      id: "plan-002",
      name: "Supply Plan Q3 2024",
      type: "Supply",
      agent: "Supply Planner",
      version: 3,
      status: "under_review",
      createdAt: "2024-06-13",
      createdBy: "Fatima",
    },
    {
      id: "plan-003",
      name: "Production Schedule W24",
      type: "Production",
      agent: "Production Planner",
      version: 2,
      status: "draft",
      createdAt: "2024-06-12",
      createdBy: "Mohammed",
    },
  ]);

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const statusColor = {
    draft: "bg-gray-100 text-gray-800",
    under_review: "bg-amber-100 text-amber-800",
    approved: "bg-green-100 text-green-800",
  };

  const dummyDiff = {
    added: [
      { field: "SKU-001", change: "Forecast increased from 5000 to 5500 units" },
      { field: "SKU-002", change: "Lead time adjusted from 14 to 16 days" },
    ],
    modified: [
      { field: "Service Level", change: "Target updated from 94% to 95%" },
    ],
    removed: [
      { field: "SKU-003", change: "Removed from active planning" },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Plan Store</h1>
        <Button variant="default">Create New Plan</Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Plans</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="under-review">Under Review</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {plans.map((plan) => (
            <Card key={plan.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                      <Badge className={statusColor[plan.status]}>
                        {plan.status.replace("_", " ").toUpperCase()}
                      </Badge>
                      <Badge variant="outline">v{plan.version}</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <p className="text-xs font-medium text-gray-500">TYPE</p>
                        <p>{plan.type}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500">AGENT</p>
                        <p>{plan.agent}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500">CREATED</p>
                        <p>{plan.createdAt}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500">BY</p>
                        <p>{plan.createdBy}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button size="sm" variant="outline" onClick={() => (setSelectedPlan(plan), setShowDiff(true))}>
                      <GitBranch className="w-4 h-4 mr-1" />
                      Diff
                    </Button>
                    <Button size="sm" variant="outline">
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button size="sm" variant="outline">
                      <Download className="w-4 h-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="approved">
          {plans
            .filter((p) => p.status === "approved")
            .map((plan) => (
              <Card key={plan.id} className="mb-4">
                <CardContent className="pt-6">
                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{plan.agent}</p>
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        <TabsContent value="under-review">
          {plans
            .filter((p) => p.status === "under_review")
            .map((plan) => (
              <Card key={plan.id} className="mb-4">
                <CardContent className="pt-6">
                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{plan.agent}</p>
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        <TabsContent value="draft">
          {plans
            .filter((p) => p.status === "draft")
            .map((plan) => (
              <Card key={plan.id} className="mb-4">
                <CardContent className="pt-6">
                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{plan.agent}</p>
                </CardContent>
              </Card>
            ))}
        </TabsContent>
      </Tabs>

      {showDiff && selectedPlan && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Version Diff: {selectedPlan.name}</CardTitle>
              <Button variant="ghost" onClick={() => setShowDiff(false)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {dummyDiff.added.length > 0 && (
              <div>
                <h4 className="font-semibold text-green-700 mb-2">Added</h4>
                <div className="space-y-2">
                  {dummyDiff.added.map((item, idx) => (
                    <div key={idx} className="p-2 bg-green-50 border border-green-200 rounded text-sm">
                      <span className="font-mono text-green-900">{item.field}:</span> {item.change}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {dummyDiff.modified.length > 0 && (
              <div>
                <h4 className="font-semibold text-amber-700 mb-2">Modified</h4>
                <div className="space-y-2">
                  {dummyDiff.modified.map((item, idx) => (
                    <div key={idx} className="p-2 bg-amber-50 border border-amber-200 rounded text-sm">
                      <span className="font-mono text-amber-900">{item.field}:</span> {item.change}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {dummyDiff.removed.length > 0 && (
              <div>
                <h4 className="font-semibold text-red-700 mb-2">Removed</h4>
                <div className="space-y-2">
                  {dummyDiff.removed.map((item, idx) => (
                    <div key={idx} className="p-2 bg-red-50 border border-red-200 rounded text-sm">
                      <span className="font-mono text-red-900">{item.field}:</span> {item.change}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
