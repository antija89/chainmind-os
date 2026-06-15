import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Package, Box, Layers, BarChart2, TrendingUp, ShoppingCart, Truck, Database } from 'lucide-react';

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function DataTable({ headers, rows, loading, emptyMsg }: {
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  loading: boolean;
  emptyMsg: string;
}) {
  if (loading) return <TableSkeleton />;
  if (!rows.length) return (
    <div className="text-center py-12 text-slate-400">
      <Database className="w-10 h-10 mx-auto mb-2 opacity-30" />
      <p className="text-sm">{emptyMsg}</p>
    </div>
  );
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            {headers.map(h => (
              <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                  {cell === null || cell === undefined
                    ? <span className="text-slate-300">—</span>
                    : typeof cell === 'boolean'
                      ? <Badge variant={cell ? 'default' : 'secondary'}>{cell ? 'Yes' : 'No'}</Badge>
                      : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-400">{rows.length} records shown</div>
    </div>
  );
}

function SearchBar({ value, onChange, onSearch, placeholder }: {
  value: string; onChange: (v: string) => void; onSearch: () => void; placeholder: string;
}) {
  return (
    <div className="flex gap-2 mb-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input className="pl-9" placeholder={placeholder} value={value}
          onChange={e => onChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSearch()} />
      </div>
      <button onClick={onSearch}
        className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors">
        Search
      </button>
    </div>
  );
}

function FgMasterTab() {
  const [s, setS] = useState(''); const [q, setQ] = useState('');
  const { data, isLoading } = trpc.data.fgMaster.useQuery({ search: q });
  const rows = (data ?? []).map(r => [r.skuId, r.description, r.brand, r.category, r.division, r.packFormat, r.uom, r.skuStatus, r.lifecycleStage, r.active]);
  return (<><SearchBar value={s} onChange={setS} onSearch={() => setQ(s)} placeholder="Search SKU, description, brand..." />
    <DataTable headers={['SKU ID','Description','Brand','Category','Division','Pack Format','UOM','Status','Lifecycle','Active']} rows={rows} loading={isLoading} emptyMsg="No FG master data. Upload via Data Import." /></>);
}

function RmMasterTab() {
  const [s, setS] = useState(''); const [q, setQ] = useState('');
  const { data, isLoading } = trpc.data.rmMaster.useQuery({ search: q });
  const rows = (data ?? []).map(r => [r.materialId, r.description, r.category, r.rmType, r.uom, r.leadTimeDays, r.supplierName, r.country, r.qualityStatus]);
  return (<><SearchBar value={s} onChange={setS} onSearch={() => setQ(s)} placeholder="Search material ID or description..." />
    <DataTable headers={['Material ID','Description','Category','Type','UOM','Lead Time (d)','Supplier','Country','QC Status']} rows={rows} loading={isLoading} emptyMsg="No RM master data. Upload via Data Import." /></>);
}

function BomTab() {
  const [s, setS] = useState(''); const [q, setQ] = useState('');
  const { data, isLoading } = trpc.data.bom.useQuery({ search: q });
  const rows = (data ?? []).map(r => [r.bomId, r.fgCode, r.fgDescription, r.componentType, r.componentCode, r.componentDescription, r.qtyPerFg, r.uom, r.stdCostAed]);
  return (<><SearchBar value={s} onChange={setS} onSearch={() => setQ(s)} placeholder="Search FG code or component..." />
    <DataTable headers={['BOM ID','FG Code','FG Desc','Comp Type','Comp Code','Comp Desc','Qty/FG','UOM','Std Cost AED']} rows={rows} loading={isLoading} emptyMsg="No BOM data. Upload via Data Import." /></>);
}

function InventoryTab() {
  const [s, setS] = useState(''); const [q, setQ] = useState('');
  const { data, isLoading } = trpc.data.inventory.useQuery({ search: q });
  const rows = (data ?? []).map(r => [r.inventoryId, r.itemId, r.itemType, r.location, r.qtyOnHand, r.available, r.holdQty, r.stockStatus, r.ageDays, r.inventoryValueAed]);
  return (<><SearchBar value={s} onChange={setS} onSearch={() => setQ(s)} placeholder="Search item ID or location..." />
    <DataTable headers={['Inv ID','Item ID','Type','Location','On Hand','Available','Hold','Status','Age (d)','Value AED']} rows={rows} loading={isLoading} emptyMsg="No inventory data. Upload via Data Import." /></>);
}

function SalesHistoryTab() {
  const [s, setS] = useState(''); const [q, setQ] = useState('');
  const { data, isLoading } = trpc.data.salesHistory.useQuery({ search: q });
  const rows = (data ?? []).map(r => [r.month, r.fgCode, r.fgDescription, r.division, r.country, r.channel, r.unitsSold, r.netSalesAed, r.fillRatePercent]);
  return (<><SearchBar value={s} onChange={setS} onSearch={() => setQ(s)} placeholder="Search SKU or country..." />
    <DataTable headers={['Month','FG Code','Description','Division','Country','Channel','Units Sold','Net Sales AED','Fill Rate %']} rows={rows} loading={isLoading} emptyMsg="No sales history. Upload via Data Import." /></>);
}

function ForecastTab() {
  const [s, setS] = useState(''); const [q, setQ] = useState('');
  const { data, isLoading } = trpc.data.forecast.useQuery({ search: q });
  const rows = (data ?? []).map(r => [r.month, r.fgCode, r.fgDescription, r.country, r.channel, r.forecastUnits, r.forecastRevenueAed, r.confidencePercent, r.forecastMethod]);
  return (<><SearchBar value={s} onChange={setS} onSearch={() => setQ(s)} placeholder="Search SKU or country..." />
    <DataTable headers={['Month','FG Code','Description','Country','Channel','Forecast Units','Revenue AED','Confidence %','Method']} rows={rows} loading={isLoading} emptyMsg="No forecast data. Upload via Data Import." /></>);
}

function PoDataTab() {
  const [s, setS] = useState(''); const [q, setQ] = useState('');
  const { data, isLoading } = trpc.data.poData.useQuery({ search: q });
  const rows = (data ?? []).map(r => [r.poNo, r.itemCode, r.description, r.supplierName, r.supplierCountry, r.qtyOrdered, r.openQty, r.poValueAed, r.currency, r.status, r.confirmedEta ? new Date(r.confirmedEta).toLocaleDateString() : null]);
  return (<><SearchBar value={s} onChange={setS} onSearch={() => setQ(s)} placeholder="Search PO number or supplier..." />
    <DataTable headers={['PO No','Item Code','Description','Supplier','Country','Qty Ordered','Open Qty','Value AED','Currency','Status','ETA']} rows={rows} loading={isLoading} emptyMsg="No PO data. Upload via Data Import." /></>);
}

function SuppliersTab() {
  const [s, setS] = useState(''); const [q, setQ] = useState('');
  const { data, isLoading } = trpc.data.suppliers.useQuery({ search: q });
  const rows = (data ?? []).map(r => [r.supplierCode, r.supplierName, r.category, r.country, r.leadTimeDays, r.paymentTerms, r.approved]);
  return (<><SearchBar value={s} onChange={setS} onSearch={() => setQ(s)} placeholder="Search supplier code or name..." />
    <DataTable headers={['Code','Name','Category','Country','Lead Time (d)','Payment Terms','Approved']} rows={rows} loading={isLoading} emptyMsg="No supplier data. Upload via Data Import." /></>);
}

const TABS = [
  { value: 'fg', label: 'FG Master', icon: Package, component: FgMasterTab },
  { value: 'rm', label: 'RM Master', icon: Box, component: RmMasterTab },
  { value: 'bom', label: 'BOM', icon: Layers, component: BomTab },
  { value: 'inventory', label: 'Inventory', icon: Database, component: InventoryTab },
  { value: 'sales', label: 'Sales History', icon: BarChart2, component: SalesHistoryTab },
  { value: 'forecast', label: 'Forecast', icon: TrendingUp, component: ForecastTab },
  { value: 'po', label: 'PO Data', icon: ShoppingCart, component: PoDataTab },
  { value: 'suppliers', label: 'Suppliers', icon: Truck, component: SuppliersTab },
];

export default function DataTables() {
  return (
    <div className="p-6 space-y-4 bg-slate-50 min-h-full">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Supply Chain Data</h1>
        <p className="text-sm text-slate-500 mt-0.5">Browse and search all master data tables — live from database</p>
      </div>
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Data Lake</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="fg">
            <TabsList className="flex flex-wrap h-auto gap-1 bg-slate-100 p-1 rounded-lg mb-4">
              {TABS.map(t => {
                const Icon = t.icon;
                return (
                  <TabsTrigger key={t.value} value={t.value} className="flex items-center gap-1.5 text-xs px-3 py-1.5">
                    <Icon className="w-3.5 h-3.5" />{t.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {TABS.map(t => (
              <TabsContent key={t.value} value={t.value}>
                <t.component />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
