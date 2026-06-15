import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, TrendingUp, Package, ShoppingCart, Activity, Clock } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';

const TREND_DATA = [
  { month: 'Jan', serviceLevel: 91, forecastAccuracy: 84, dos: 32 },
  { month: 'Feb', serviceLevel: 92, forecastAccuracy: 85, dos: 30 },
  { month: 'Mar', serviceLevel: 90, forecastAccuracy: 83, dos: 35 },
  { month: 'Apr', serviceLevel: 93, forecastAccuracy: 87, dos: 29 },
  { month: 'May', serviceLevel: 94, forecastAccuracy: 88, dos: 27 },
];

function KpiCard({ title, value, unit, target, icon: Icon, color, bg, loading }: {
  title: string; value: number | null; unit: string; target: string;
  icon: React.ElementType; color: string; bg: string; loading: boolean;
}) {
  return (
    <Card className="border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-24 mt-1" />
            ) : (
              <p className={`text-3xl font-bold mt-1 ${color}`}>
                {value !== null ? value.toFixed(1) : '--'}
                <span className="text-base font-normal text-slate-500 ml-1">{unit}</span>
              </p>
            )}
            <p className="text-xs text-slate-400 mt-1">Target: {target}</p>
          </div>
          <div className={`p-2.5 rounded-lg ${bg}`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const PRIORITY_STYLE: Record<string, string> = {
  urgent: 'bg-red-50 text-red-700 border-red-200',
  normal: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-blue-50 text-blue-700 border-blue-200',
};

export default function Dashboard() {
  const { user } = useAuth();
  const { data: kpis, isLoading: kpisLoading } = trpc.dashboard.kpis.useQuery();
  const { data: alerts, isLoading: alertsLoading } = trpc.dashboard.alerts.useQuery();

  const trendData = [
    ...TREND_DATA,
    {
      month: 'Jun (Live)',
      serviceLevel: kpis?.serviceLevel ?? 0,
      forecastAccuracy: kpis?.forecastAccuracy ?? 0,
      dos: kpis?.inventoryDos ?? 0,
    },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-full">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Supply Chain Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Welcome back, {user?.name || 'User'} — Live KPIs from your supply chain data
        </p>
      </div>

      {/* KPI Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title="Service Level" value={kpis?.serviceLevel ?? null} unit="%" target="95%" icon={TrendingUp} color="text-emerald-600" bg="bg-emerald-50" loading={kpisLoading} />
        <KpiCard title="Forecast Accuracy" value={kpis?.forecastAccuracy ?? null} unit="%" target="90%" icon={Activity} color="text-blue-600" bg="bg-blue-50" loading={kpisLoading} />
        <KpiCard title="Inventory DOS" value={kpis?.inventoryDos ?? null} unit="days" target="30 days" icon={Package} color="text-violet-600" bg="bg-violet-50" loading={kpisLoading} />
        <KpiCard title="Open POs" value={kpis?.openPoCount ?? null} unit="" target="< 50" icon={ShoppingCart} color="text-orange-600" bg="bg-orange-50" loading={kpisLoading} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-orange-50"><ShoppingCart className="w-4 h-4 text-orange-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Open PO Value</p>
              {kpisLoading ? <Skeleton className="h-5 w-28 mt-1" /> : (
                <p className="text-lg font-semibold text-slate-800">AED {(kpis?.openPoValue ?? 0).toLocaleString()}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-violet-50"><Package className="w-4 h-4 text-violet-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Inventory Value</p>
              {kpisLoading ? <Skeleton className="h-5 w-28 mt-1" /> : (
                <p className="text-lg font-semibold text-slate-800">AED {(kpis?.totalInventoryValue ?? 0).toLocaleString()}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-red-50"><AlertTriangle className="w-4 h-4 text-red-600" /></div>
            <div>
              <p className="text-xs text-slate-500">Pending Approvals</p>
              {kpisLoading ? <Skeleton className="h-5 w-12 mt-1" /> : (
                <p className="text-lg font-semibold text-red-600">{kpis?.pendingHilGates ?? 0}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700">KPI Trends (6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorSL" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorFA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[70, 100]} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Area type="monotone" dataKey="serviceLevel" name="Service Level %" stroke="#10b981" fill="url(#colorSL)" strokeWidth={2} dot={{ r: 3 }} />
                <Area type="monotone" dataKey="forecastAccuracy" name="Forecast Accuracy %" stroke="#3b82f6" fill="url(#colorFA)" strokeWidth={2} dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Pending Approvals
              {!alertsLoading && alerts && alerts.length > 0 && (
                <Badge variant="destructive" className="ml-auto text-xs">{alerts.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 overflow-y-auto max-h-64">
            {alertsLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
            ) : alerts && alerts.length > 0 ? (
              alerts.map(alert => (
                <div key={alert.id} className={`p-3 rounded-lg border text-xs ${PRIORITY_STYLE[alert.priority] || PRIORITY_STYLE.normal}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold truncate">{alert.title}</span>
                    <Badge variant="outline" className="text-[10px] capitalize shrink-0">{alert.priority}</Badge>
                  </div>
                  <p className="text-xs mt-0.5 opacity-80 truncate">{alert.description}</p>
                  {alert.createdAt && (
                    <p className="text-[10px] mt-1 opacity-60 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No pending approvals</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* DOS Bar Chart */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Days of Supply Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="dos" name="DOS (days)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
