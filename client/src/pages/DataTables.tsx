import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Download } from "lucide-react";

export default function DataTables() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("fg-master");

  const fgMasterData = [
    { sku: "PCP-0105", description: "Premium Care Pack 105ml", division: "Personal Care", category: "Shampoo", active: true, price: 45.5 },
    { sku: "AO-250", description: "Argan Oil 250ml", division: "Beauty", category: "Hair Oil", active: true, price: 125.0 },
    { sku: "HC-500", description: "Hair Conditioner 500ml", division: "Personal Care", category: "Conditioner", active: true, price: 65.0 },
  ];

  const rmMasterData = [
    { material: "RM-001", description: "Argan Oil Extract", category: "Raw Material", supplier: "AlRawabi", leadTime: 14, cost: 85.5 },
    { material: "RM-002", description: "Shea Butter", category: "Raw Material", supplier: "Supplier B", leadTime: 21, cost: 45.0 },
    { material: "RM-003", description: "Packaging Film", category: "Packaging", supplier: "Supplier C", leadTime: 7, cost: 12.5 },
  ];

  const inventoryData = [
    { item: "PCP-0105", location: "Dubai", qty: 5200, dos: 26, status: "Normal" },
    { item: "AO-250", location: "Abu Dhabi", qty: 1850, dos: 18, status: "Low" },
    { item: "HC-500", location: "Dubai", qty: 3400, dos: 34, status: "High" },
  ];

  const poData = [
    { po: "PO-2024-001", item: "RM-001", supplier: "AlRawabi", qty: 5000, value: 84500, status: "Pending", eta: "2024-07-15" },
    { po: "PO-2024-002", item: "RM-002", supplier: "Supplier B", qty: 2000, value: 45000, status: "Confirmed", eta: "2024-07-20" },
    { po: "PO-2024-003", item: "RM-003", supplier: "Supplier C", qty: 10000, value: 28500, status: "Shipped", eta: "2024-07-10" },
  ];

  const renderTable = (data: any[], columns: string[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100 border-b">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-4 py-3 text-left font-semibold text-gray-700">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} className="border-b hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col} className="px-4 py-3 text-gray-900">
                  {typeof row[col.toLowerCase().replace(/\s+/g, "")] === "boolean" ? (
                    <Badge variant={row[col.toLowerCase().replace(/\s+/g, "")] ? "default" : "secondary"}>
                      {row[col.toLowerCase().replace(/\s+/g, "")] ? "Yes" : "No"}
                    </Badge>
                  ) : typeof row[col.toLowerCase().replace(/\s+/g, "")] === "number" ? (
                    <span className="font-mono">{row[col.toLowerCase().replace(/\s+/g, "")]}</span>
                  ) : (
                    row[col.toLowerCase().replace(/\s+/g, "")] || "-"
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Supply Chain Data</h1>
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Export
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search across all tables..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Master Data & Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="fg-master">FG Master</TabsTrigger>
              <TabsTrigger value="rm-master">RM Master</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="po-data">PO Data</TabsTrigger>
            </TabsList>

            <TabsContent value="fg-master" className="mt-6">
              {renderTable(fgMasterData, ["SKU", "Description", "Division", "Category", "Active", "Price"])}
            </TabsContent>

            <TabsContent value="rm-master" className="mt-6">
              {renderTable(rmMasterData, ["Material", "Description", "Category", "Supplier", "Lead Time", "Cost"])}
            </TabsContent>

            <TabsContent value="inventory" className="mt-6">
              {renderTable(inventoryData, ["Item", "Location", "Qty", "DOS", "Status"])}
            </TabsContent>

            <TabsContent value="po-data" className="mt-6">
              {renderTable(poData, ["PO", "Item", "Supplier", "Qty", "Value", "Status", "ETA"])}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
