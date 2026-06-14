import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2 } from "lucide-react";
import { useParams } from "wouter";

export default function AgentChat() {
  const { user } = useAuth();
  const params = useParams();
  const agentId = params?.agentId || "demand_planner";
  
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([
    {
      role: "assistant",
      content: "Hello! I am the Demand Planner agent. How can I help you with demand forecasting and S&OP planning today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const agentInfo: Record<string, any> = {
    demand_planner: {
      title: "Demand Planner",
      color: "#00D4B8",
      icon: "📊",
      domain: "Demand forecasting, S&OP, channel planning",
    },
    supply_planner: {
      title: "Supply Planner",
      color: "#FF6B6B",
      icon: "📦",
      domain: "Supply planning, inventory optimization",
    },
    production_planner: {
      title: "Production Planner",
      color: "#4ECDC4",
      icon: "🏭",
      domain: "Production scheduling, capacity planning",
    },
    procurement_planner: {
      title: "Procurement Planner",
      color: "#FFD93D",
      icon: "🤝",
      domain: "Procurement, supplier management",
    },
    ops_head: {
      title: "Ops Head",
      color: "#6C5CE7",
      icon: "👔",
      domain: "S&OP orchestration, conflict resolution",
    },
  };

  const agent = agentInfo[agentId] || agentInfo.demand_planner;

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    setTimeout(() => {
      const responses: Record<string, string> = {
        demand_planner: "I've analyzed the sales history for the requested SKU. The forecast shows a 12% growth trend for the next 13 weeks with 85% confidence. Should I apply promo uplift adjustments?",
        supply_planner: "The supply plan is now constrained. We have a 2,000-unit gap in weeks 3-4. I recommend increasing production capacity or expediting raw material orders.",
        production_planner: "Current line utilization is at 78.5%. I can accommodate the additional 2,000 units with minimal changeover impact. Shall I build the revised schedule?",
        procurement_planner: "MRP analysis shows 3 materials at risk. Lead times are critical for SKU-001. I recommend placing expedited orders with our top 2 suppliers.",
        ops_head: "All functions have submitted their inputs. Service level vs. cost trade-off is favorable. I recommend approving the constrained supply plan.",
      };

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: responses[agentId] || "I've processed your request. What would you like me to do next?",
        },
      ]);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="text-4xl">{agent.icon}</div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{agent.title}</h1>
          <p className="text-gray-600 text-sm">{agent.domain}</p>
        </div>
      </div>

      <Card className="h-96 flex flex-col">
        <CardHeader>
          <CardTitle className="text-lg">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xs px-4 py-2 rounded-lg ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-gray-100 text-gray-900 rounded-bl-none"
                }`}
              >
                <p className="text-sm">{msg.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg rounded-bl-none">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Input
          placeholder="Ask the agent a question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          disabled={loading}
        />
        <Button onClick={handleSend} disabled={loading || !input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
