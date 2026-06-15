import { ReactNode, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  LogOut, Menu, X, LayoutDashboard, Inbox, Table2,
  Upload, BookOpen, ScrollText, Settings, Users, ChevronDown, ChevronRight, Wrench, Eye, FileText
} from "lucide-react";

interface ChainMindLayoutProps {
  children: ReactNode;
}

const AGENTS = [
  { id: "demand_planner", title: "Demand Planner", emoji: "📊" },
  { id: "supply_planner", title: "Supply Planner", emoji: "📦" },
  { id: "production_planner", title: "Production Planner", emoji: "🏭" },
  { id: "procurement_planner", title: "Procurement Planner", emoji: "🤝" },
  { id: "ops_head", title: "Ops Head", emoji: "👔" },
];

export default function ChainMindLayout({ children }: ChainMindLayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(true);

  // Live HIL badge count
  const { data: hilGates } = trpc.hil.list.useQuery({ status: 'pending' }, {
    refetchInterval: 30_000,
  });
  const hilCount = hilGates?.length ?? 0;

  const navItems = [
    { path: "/", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { path: "/hil-inbox", label: "Needs Your Input", icon: <Inbox className="w-4 h-4" />, badge: hilCount > 0 ? hilCount : undefined },
    { path: "/data-tables", label: "Data Tables", icon: <Table2 className="w-4 h-4" /> },
    { path: "/data-import", label: "Data Import", icon: <Upload className="w-4 h-4" /> },
    { path: "/plan-store", label: "Plan Store", icon: <BookOpen className="w-4 h-4" /> },
    { path: "/audit-trail", label: "Audit Trail", icon: <ScrollText className="w-4 h-4" /> },
    { path: "/agents", label: "Agent Roster", icon: <Users className="w-4 h-4" /> },
    { path: "/tools", label: "Tool Management", icon: <Wrench className="w-4 h-4" /> },
    { path: "/reviewer", label: "Reviewer Dashboard", icon: <Eye className="w-4 h-4" /> },
    { path: "/llm-logs", label: "LLM API Logs", icon: <FileText className="w-4 h-4" /> },
    { path: "/settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
  ];

  const isActive = (path: string) => location === path;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${collapsed ? "w-16" : "w-60"} bg-white border-r border-slate-200 flex flex-col transition-all duration-200 shrink-0`}>
        {/* Logo */}
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-slate-200">
          <span className="text-xl">⛓️</span>
          {!collapsed && <span className="font-bold text-slate-900 text-base tracking-tight">ChainMind</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map((item) => (
            <Link key={item.path} href={item.path}>
              <button
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <span className={`shrink-0 ${isActive(item.path) ? "text-white" : "text-slate-500"}`}>{item.icon}</span>
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            </Link>
          ))}

          {/* Agents section */}
          {!collapsed && (
            <div className="pt-3">
              <button
                className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors"
                onClick={() => setAgentsOpen(o => !o)}
              >
                {agentsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Agents
              </button>
              {agentsOpen && AGENTS.map((agent) => (
                <Link key={agent.id} href={`/agent/${agent.id}`}>
                  <button
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                      location === `/agent/${agent.id}`
                        ? "bg-slate-100 text-slate-900 font-medium"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    }`}
                  >
                    <span className="text-base">{agent.emoji}</span>
                    <span className="truncate">{agent.title}</span>
                  </button>
                </Link>
              ))}
            </div>
          )}

          {collapsed && AGENTS.map((agent) => (
            <Link key={agent.id} href={`/agent/${agent.id}`}>
              <button
                className={`w-full flex items-center justify-center py-2 rounded-lg transition-colors ${
                  location === `/agent/${agent.id}` ? "bg-slate-100" : "hover:bg-slate-50"
                }`}
                title={agent.title}
              >
                <span className="text-base">{agent.emoji}</span>
              </button>
            </Link>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-slate-200 p-3 space-y-2">
          {!collapsed && (
            <div className="px-1">
              <p className="text-sm font-medium text-slate-900 truncate">{user?.name || "User"}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.role || "user"}</p>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-full flex items-center justify-center py-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            {collapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-500">ChainMind</span>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-semibold text-slate-900">
              {navItems.find(n => n.path === location)?.label ??
               AGENTS.find(a => `/agent/${a.id}` === location)?.title ??
               "Supply Chain OS"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {hilCount > 0 && (
              <Link href="/hil-inbox">
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-medium hover:bg-red-100 transition-colors">
                  <Inbox className="w-3.5 h-3.5" />
                  {hilCount} pending approval{hilCount > 1 ? 's' : ''}
                </button>
              </Link>
            )}
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
