import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, Package, Zap } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuth();

  const kpis = [
    {
      title: "Service Level",
      value: "94.2%",
      target: "95%",
      trend: -0.8,
      icon: TrendingUp,
      color: "text-blue-600",
    },
    {
      title: "Forecast Accuracy",
      value: "87.5%",
      target: "90%",
      trend: 2.1,
      icon: Zap,
      color: "text-green-600",
    },
    {
      title: "Inventory DOS",
      value: "28.3 days",
      target: "30 days",
      trend: -1.5,
      icon: Package,
      color: "text-amber-600",
    },
    {
      title: "Open POs",
      value: "142",
      target: "<150",
      trend: 5,
      icon: AlertCircle,
      color: "text-red-600",
    },
  ];

  const alerts = [
    {
      id: 1,
      type: "warning",
      title: "SKU-001 DOS Below Target",
      message: "Days of stock for SKU-001 (UAE) is 18 days, below 20-day threshold",
      time: "5 min ago",
    },
    {
      id: 2,
      type: "error",
      title: "High-Value PO Pending Approval",
      message: "PO-2024-001 (AED 85,000) requires Ops Head approval",
      time: "12 min ago",
    },
    {
      id: 3,
      type: "info",
      title: "Demand Plan v5 Published",
      message: "Demand Planner published W24-26 forecast with 88% confidence",
      time: "1 hr ago",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back, {user?.name || "User"}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.title} className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-700">{kpi.title}</CardTitle>
                  <Icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{kpi.value}</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-600">Target: {kpi.target}</span>
                  <Badge variant={kpi.trend < 0 ? "destructive" : "default"} className="text-xs">
                    {kpi.trend > 0 ? "+" : ""}{kpi.trend}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Real-Time Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className={`w-2 h-2 mt-2 rounded-full ${alert.type === "error" ? "bg-red-500" : alert.type === "warning" ? "bg-amber-500" : "bg-blue-500"}`} />
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900">{alert.title}</div>
                  <div className="text-xs text-gray-600 mt-1">{alert.message}</div>
                  <div className="text-xs text-gray-500 mt-2">{alert.time}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
