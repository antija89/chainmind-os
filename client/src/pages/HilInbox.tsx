import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, XCircle, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface HilItem {
  id: string;
  priority: "urgent" | "high" | "normal";
  agent: string;
  title: string;
  description: string;
  payload: Record<string, any>;
  createdAt: string;
}

export default function HilInbox() {
  const [items, setItems] = useState<HilItem[]>([
    {
      id: "gate-001",
      priority: "urgent",
      agent: "Demand Planner",
      title: "Demand spike detected: PCP-0105 KSA +67%",
      description: "Demand spike in KSA market exceeds 40% threshold. Requires human confirmation if promo planned.",
      payload: { sku: "PCP-0105", country: "KSA", spike: 67, baseline: 1000 },
      createdAt: "5 min ago",
    },
    {
      id: "gate-002",
      priority: "high",
      agent: "Procurement Planner",
      title: "High-value PO requires approval",
      description: "PO for Argan Oil (Supplier: AlRawabi) exceeds auto-approve threshold at AED 84,500",
      payload: { poNo: "PO-2024-001", value: 84500, supplier: "AlRawabi" },
      createdAt: "12 min ago",
    },
    {
      id: "gate-003",
      priority: "normal",
      agent: "Production Planner",
      title: "Capacity breach warning",
      description: "Production schedule change affects 3 lines. Minor impact expected.",
      payload: { lines: 3, impact: "minor" },
      createdAt: "1 hr ago",
    },
  ]);

  const [selectedItem, setSelectedItem] = useState<HilItem | null>(null);
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | "override" | null>(null);

  const handleAction = (item: HilItem, act: "approve" | "reject" | "override") => {
    setSelectedItem(item);
    setAction(act);
  };

  const submitAction = () => {
    if (!reason.trim() || !selectedItem) return;

    console.log(`${action} on ${selectedItem.id}: ${reason}`);
    setItems((prev) => prev.filter((item) => item.id !== selectedItem.id));
    setSelectedItem(null);
    setReason("");
    setAction(null);
  };

  const priorityColor = {
    urgent: "bg-red-100 text-red-800 border-red-300",
    high: "bg-amber-100 text-amber-800 border-amber-300",
    normal: "bg-blue-100 text-blue-800 border-blue-300",
  };

  const priorityIcon = {
    urgent: <AlertCircle className="w-5 h-5 text-red-600" />,
    high: <AlertCircle className="w-5 h-5 text-amber-600" />,
    normal: <MessageSquare className="w-5 h-5 text-blue-600" />,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Needs Your Input</h1>
        <p className="text-gray-600 mt-1">{items.length} pending approvals and decisions</p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id} className={`border-l-4 ${priorityColor[item.priority]}`}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  {priorityIcon[item.priority]}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{item.title}</h3>
                      <Badge variant="outline" className="text-xs">
                        {item.agent}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                    <p className="text-xs text-gray-500 mt-2">{item.createdAt}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleAction(item, "approve")}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(item, "reject")}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(item, "override")}
                  >
                    Override
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && (setSelectedItem(null), setReason(""), setAction(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "approve" && "Approve"}
              {action === "reject" && "Reject"}
              {action === "override" && "Override"} Decision
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Gate: {selectedItem?.title}</p>
              <p className="text-sm text-gray-600 mt-1">{selectedItem?.description}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Reason (mandatory)</label>
              <Textarea
                placeholder="Explain your decision..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => (setSelectedItem(null), setReason(""), setAction(null))}>
              Cancel
            </Button>
            <Button
              onClick={submitAction}
              disabled={!reason.trim()}
              className={action === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
            >
              Confirm {action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
