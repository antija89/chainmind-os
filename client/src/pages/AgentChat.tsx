import { useState } from "react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2 } from "lucide-react";
import { Streamdown } from "streamdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const AGENTS = {
  demand_planner: {
    title: "Demand Planner",
    icon: "📊",
    description: "Analyze demand patterns and create forecasts",
    color: "bg-blue-50",
  },
  supply_planner: {
    title: "Supply Planner",
    icon: "📦",
    description: "Optimize supply chain and supplier coordination",
    color: "bg-red-50",
  },
  production_planner: {
    title: "Production Planner",
    icon: "🏭",
    description: "Plan production schedules and capacity",
    color: "bg-teal-50",
  },
  procurement_planner: {
    title: "Procurement Planner",
    icon: "🤝",
    description: "Manage procurement and vendor relationships",
    color: "bg-yellow-50",
  },
  ops_head: {
    title: "Ops Head",
    icon: "👔",
    description: "Executive oversight and decision making",
    color: "bg-purple-50",
  },
};

export default function AgentChat() {
  const { agentId } = useParams<{ agentId: string }>();
  const agent = AGENTS[agentId as keyof typeof AGENTS] || AGENTS.demand_planner;

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: `Hello! I'm the ${agent.title}. ${agent.description}. How can I help you today?`,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `I've analyzed your request about "${input}". Based on current data, here are my recommendations:\n\n**Key Insights:**\n- Service Level Target: 95%\n- Current Forecast Accuracy: 87.5%\n- Inventory Days of Supply: 28.3 days\n\n**Recommended Actions:**\n1. Increase safety stock by 5% to improve service level\n2. Review demand forecast methodology for Q3\n3. Coordinate with supply chain on lead time optimization\n\nWould you like me to elaborate on any of these recommendations?`,
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className={`${agent.color} p-6 rounded-lg border border-gray-200`}>
        <div className="flex items-center gap-3">
          <span className="text-4xl">{agent.icon}</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{agent.title}</h1>
            <p className="text-gray-600">{agent.description}</p>
          </div>
        </div>
      </div>

      <Card className="h-96 flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Conversation</span>
            <Badge variant="outline">Ready</Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto space-y-4 mb-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xs px-4 py-2 rounded-lg ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white rounded-br-none"
                    : "bg-gray-100 text-gray-900 rounded-bl-none"
                }`}
              >
                <Streamdown>{msg.content}</Streamdown>
                <p className={`text-xs mt-1 ${msg.role === "user" ? "text-blue-100" : "text-gray-600"}`}>
                  {msg.timestamp}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg rounded-bl-none">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            </div>
          )}
        </CardContent>

        <div className="border-t p-4 flex gap-2">
          <Input
            placeholder="Ask me anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            disabled={isLoading}
          />
          <Button onClick={handleSendMessage} disabled={isLoading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm text-gray-600">
            <p>✓ Last forecast run: 2 hours ago</p>
            <p>✓ Current plan status: Under Review (v5)</p>
            <p>✓ Pending approvals: 3</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
