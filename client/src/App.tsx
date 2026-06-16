import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ChainMindLayout from "./components/ChainMindLayout";
import Dashboard from "./pages/Dashboard";
import AgentChat from "./pages/AgentChat";
import { AgentChatEnhanced } from "./pages/AgentChatEnhanced";
import HilInbox from "./pages/HilInbox";
import DataTables from "./pages/DataTables";
import DataImport from "./pages/DataImport";
import PlanStore from "./pages/PlanStore";
import AuditTrail from "./pages/AuditTrail";
import Settings from "./pages/Settings";
import AgentRoster from "./pages/AgentRoster";
import AgentWorkspace from "./pages/AgentWorkspace";
import { ToolRegistry } from "./pages/ToolRegistry";
import { ToolCreationAgent } from "./pages/ToolCreationAgent";
import { ToolManagement } from "./pages/ToolManagement";
import ReviewerAgentDashboard from "./pages/ReviewerAgentDashboard";
import LlmLogs from "./pages/LlmLogs";

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <ChainMindLayout><Dashboard /></ChainMindLayout>} />
      <Route path="/agent/:agentId" component={() => <ChainMindLayout><AgentChatEnhanced /></ChainMindLayout>} />
      <Route path="/hil-inbox" component={() => <ChainMindLayout><HilInbox /></ChainMindLayout>} />
      <Route path="/data-tables" component={() => <ChainMindLayout><DataTables /></ChainMindLayout>} />
      <Route path="/data-import" component={() => <ChainMindLayout><DataImport /></ChainMindLayout>} />
      <Route path="/plan-store" component={() => <ChainMindLayout><PlanStore /></ChainMindLayout>} />
      <Route path="/audit-trail" component={() => <ChainMindLayout><AuditTrail /></ChainMindLayout>} />
      <Route path="/settings" component={() => <ChainMindLayout><Settings /></ChainMindLayout>} />
      <Route path="/agents" component={() => <ChainMindLayout><AgentRoster /></ChainMindLayout>} />
      <Route path="/agents/:agentId" component={() => <ChainMindLayout><AgentWorkspace /></ChainMindLayout>} />
      <Route path="/tools" component={() => <ChainMindLayout><ToolManagement /></ChainMindLayout>} />
      <Route path="/tools/create-agent" component={() => <ChainMindLayout><ToolCreationAgent /></ChainMindLayout>} />
      <Route path="/reviewer" component={() => <ChainMindLayout><ReviewerAgentDashboard /></ChainMindLayout>} />
      <Route path="/llm-logs" component={() => <ChainMindLayout><LlmLogs /></ChainMindLayout>} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
