import { ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, X, Settings as SettingsIcon } from "lucide-react";
import { useState } from "react";

interface ChainMindLayoutProps {
  children: ReactNode;
}

export default function ChainMindLayout({ children }: ChainMindLayoutProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const agents = [
    { id: "demand_planner", title: "Demand Planner", icon: "📊", color: "#00D4B8" },
    { id: "supply_planner", title: "Supply Planner", icon: "📦", color: "#FF6B6B" },
    { id: "production_planner", title: "Production Planner", icon: "🏭", color: "#4ECDC4" },
    { id: "procurement_planner", title: "Procurement Planner", icon: "🤝", color: "#FFD93D" },
    { id: "ops_head", title: "Ops Head", icon: "👔", color: "#6C5CE7" },
  ];

  const navItems = [
    { path: "/", label: "Dashboard", icon: "📊" },
    { path: "/hil-inbox", label: "Needs Your Input", icon: "⚡", badge: "3" },
    { path: "/data-tables", label: "Data Tables", icon: "📋" },
    { path: "/data-import", label: "Data Import", icon: "📥" },
    { path: "/plan-store", label: "Plan Store", icon: "📑" },
    { path: "/audit-trail", label: "Audit Trail", icon: "📜" },
    { path: "/settings", label: "Settings", icon: "⚙️" },
  ];

  const isActive = (path: string) => location === path;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? "w-64" : "w-20"} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
        {/* Logo */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="text-2xl">⛓️</div>
            {sidebarOpen && <span className="font-bold text-lg text-gray-900">ChainMind</span>}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {navItems.map((item) => (
            <Link key={item.path} href={item.path}>
              <Button
                variant={isActive(item.path) ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setLocation(item.path)}
              >
                <span className="text-lg">{item.icon}</span>
                {sidebarOpen && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">{item.badge}</span>}
                  </>
                )}
              </Button>
            </Link>
          ))}

          {sidebarOpen && <div className="pt-4 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-600 px-2 py-2">AGENTS</p>
          </div>}

          {agents.map((agent) => (
            <Link key={agent.id} href={`/agent/${agent.id}`}>
              <Button
                variant={location === `/agent/${agent.id}` ? "default" : "ghost"}
                className="w-full justify-start"
                onClick={() => setLocation(`/agent/${agent.id}`)}
              >
                <span className="text-lg">{agent.icon}</span>
                {sidebarOpen && <span className="flex-1 text-left text-sm">{agent.title}</span>}
              </Button>
            </Link>
          ))}
        </div>

        {/* User Section */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          {sidebarOpen && <div className="text-xs text-gray-600">
            <p className="font-medium text-gray-900">{user?.name || "User"}</p>
            <p className="text-gray-500">{user?.role || "user"}</p>
          </div>}
          <Button variant="outline" size="sm" className="w-full" onClick={logout}>
            <LogOut className="w-4 h-4" />
            {sidebarOpen && <span className="ml-2">Logout</span>}
          </Button>
        </div>

        {/* Toggle Button */}
        <div className="p-2 border-t border-gray-200">
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-900">ChainMind Supply Chain OS</h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
