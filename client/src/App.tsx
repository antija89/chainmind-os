import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ChainMindLayout from "./components/ChainMindLayout";
import Dashboard from "./pages/Dashboard";
import AgentChat from "./pages/AgentChat";
import HilInbox from "./pages/HilInbox";
import DataTables from "./pages/DataTables";
import DataImport from "./pages/DataImport";
import PlanStore from "./pages/PlanStore";
import AuditTrail from "./pages/AuditTrail";
import Settings from "./pages/Settings";
import AgentRoster from "./pages/AgentRoster";

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <ChainMindLayout><Dashboard /></ChainMindLayout>} />
      <Route path="/agent/:agentId" component={() => <ChainMindLayout><AgentChat /></ChainMindLayout>} />
      <Route path="/hil-inbox" component={() => <ChainMindLayout><HilInbox /></ChainMindLayout>} />
      <Route path="/data-tables" component={() => <ChainMindLayout><DataTables /></ChainMindLayout>} />
      <Route path="/data-import" component={() => <ChainMindLayout><DataImport /></ChainMindLayout>} />
      <Route path="/plan-store" component={() => <ChainMindLayout><PlanStore /></ChainMindLayout>} />
      <Route path="/audit-trail" component={() => <ChainMindLayout><AuditTrail /></ChainMindLayout>} />
      <Route path="/settings" component={() => <ChainMindLayout><Settings /></ChainMindLayout>} />
      <Route path="/agents" component={() => <ChainMindLayout><AgentRoster /></ChainMindLayout>} />
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
