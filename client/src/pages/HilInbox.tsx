import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";

interface HILItem {
  id: string;
  type: "po_approval" | "exception" | "threshold" | "override";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  value?: number;
  createdAt: string;
  requiredBy: string;
}

export default function HilInbox() {
  const [items, setItems] = useState<HILItem[]>([
    {
      id: "hil-001",
      type: "po_approval",
      title: "High-Value PO Approval",
      description: "PO-2024-001 (AED 84,500) from AlRawabi requires Ops Head approval",
      priority: "high",
      value: 84500,
      createdAt: "2024-06-14 12:15",
      requiredBy: "2024-06-15",
    },
    {
      id: "hil-002",
      type: "exception",
      title: "Inventory Exception",
      description: "SKU-001 DOS below 20 days. Current: 18 days. Recommend emergency purchase.",
      priority: "high",
      createdAt: "2024-06-14 11:45",
      requiredBy: "2024-06-14",
    },
    {
      id: "hil-003",
      type: "threshold",
      title: "Service Level Threshold Breach",
      description: "Service level dropped to 94.2%, below 95% target. Review demand forecast.",
      priority: "medium",
      createdAt: "2024-06-14 10:30",
      requiredBy: "2024-06-15",
    },
  ]);

  const [selectedItem, setSelectedItem] = useState<HILItem | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | "override" | null>(null);
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAction = async (itemId: string, actionType: "approve" | "reject" | "override") => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    setSelectedItem(item);
    setAction(actionType);
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      alert("Reason is mandatory");
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      console.log(`Action: ${action}, Item: ${selectedItem?.id}, Reason: ${reason}`);

      setItems((prev) => prev.filter((i) => i.id !== selectedItem?.id));
      setSelectedItem(null);
      setAction(null);
      setReason("");
      setIsSubmitting(false);

      alert(`${action?.toUpperCase()} recorded with reason: "${reason}"`);
    }, 1000);
  };

  const priorityColor = {
    high: "bg-red-100 text-red-800",
    medium: "bg-amber-100 text-amber-800",
    low: "bg-green-100 text-green-800",
  };

  const typeIcon = {
    po_approval: "💰",
    exception: "⚠️",
    threshold: "📊",
    override: "🔄",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Needs Your Input</h1>
        <Badge className="bg-red-500 text-white text-lg px-3 py-1">{items.length} Pending</Badge>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">All Clear!</h3>
            <p className="text-gray-600">No pending approvals or exceptions</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{typeIcon[item.type]}</span>
                      <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                      <Badge className={priorityColor[item.priority]}>
                        {item.priority.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-gray-700 mb-3">{item.description}</p>
                    <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <p className="text-xs font-medium text-gray-500">CREATED</p>
                        <p>{item.createdAt}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500">REQUIRED BY</p>
                        <p>{item.requiredBy}</p>
                      </div>
                      {item.value && (
                        <div>
                          <p className="text-xs font-medium text-gray-500">VALUE</p>
                          <p className="font-mono font-semibold">AED {item.value.toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 border-green-300 hover:bg-green-50"
                      onClick={() => handleAction(item.id, "approve")}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => handleAction(item.id, "reject")}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-amber-600 border-amber-300 hover:bg-amber-50"
                      onClick={() => handleAction(item.id, "override")}
                    >
                      <AlertCircle className="w-4 h-4 mr-1" />
                      Override
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!action} onOpenChange={() => action && (setAction(null), setReason(""))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "approve" && "Approve Request"}
              {action === "reject" && "Reject Request"}
              {action === "override" && "Override Decision"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Item</p>
              <p className="text-gray-900 font-semibold">{selectedItem?.title}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Reason <span className="text-red-500">*</span>
              </label>
              <Textarea
                placeholder="Provide detailed reason for this decision (mandatory)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-24"
              />
              <p className="text-xs text-gray-500 mt-1">This will be logged in the audit trail</p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => (setAction(null), setReason(""))}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !reason.trim()}
                className={
                  action === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : action === "reject"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-amber-600 hover:bg-amber-700"
                }
              >
                {isSubmitting ? "Processing..." : `${action?.toUpperCase()}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
