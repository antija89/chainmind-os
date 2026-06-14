import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';

export default function DataImport() {
  const [file, setFile] = useState<File | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>('fg_master');
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const importMutation = trpc.data.importExcel.useMutation();

  const tables = [
    { value: 'fg_master', label: 'FG Master' },
    { value: 'rm_master', label: 'RM Master' },
    { value: 'bom', label: 'BOM' },
    { value: 'inventory', label: 'Inventory' },
    { value: 'po_data', label: 'PO Data' },
    { value: 'sales_history', label: 'Sales History' },
    { value: 'forecast', label: 'Forecast' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setResult({ success: false, message: 'Please select a file' });
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result as ArrayBuffer;
        const base64 = Buffer.from(data).toString('base64');
        
        const response = await importMutation.mutateAsync({
          tableName: selectedTable,
          fileData: base64,
          fileName: file.name,
        });

        setResult({
          success: response.success,
          message: response.message,
        });
        
        if (response.success) {
          setFile(null);
        }
      } catch (error) {
        setResult({
          success: false,
          message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      } finally {
        setUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Data Import</h1>
        <p className="text-muted-foreground mt-2">Upload Excel files to populate your supply chain data</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Excel Data</CardTitle>
          <CardDescription>Select a table and upload the corresponding Excel file</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Table Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Select Table</label>
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            >
              {tables.map((table) => (
                <option key={table.value} value={table.value}>
                  {table.label}
                </option>
              ))}
            </select>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">Select File</label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">{file?.name || 'Click to select or drag file here'}</p>
              <p className="text-xs text-muted-foreground">Excel files (.xlsx, .xls)</p>
              <input
                id="file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full"
            size="lg"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Data
              </>
            )}
          </Button>

          {/* Result Message */}
          {result && (
            <Alert variant={result.success ? 'default' : 'destructive'}>
              {result.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium mb-2">File Format Requirements:</h4>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Excel file (.xlsx or .xls)</li>
              <li>First row must contain column headers matching database field names</li>
              <li>Data starts from row 2</li>
              <li>Maximum 10,000 rows per upload</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Column Names by Table:</h4>
            <div className="space-y-2 text-muted-foreground text-xs">
              <p><strong>FG Master:</strong> sku_id, description, category, division, brand, primary_plant, uom, active</p>
              <p><strong>RM Master:</strong> material_id, description, category, rm_type, uom, std_cost_aed, lead_time_days, supplier_name</p>
              <p><strong>BOM:</strong> bom_id, fg_code, fg_description, component_type, component_code, qty_per_fg, uom, scrap_percent</p>
              <p><strong>Inventory:</strong> inventory_id, item_id, item_type, location, batch_no, qty_on_hand, allocated, available, unit_cost_aed</p>
              <p><strong>PO Data:</strong> po_no, item_code, item_type, description, supplier_name, plant, po_date, qty_ordered, qty_received, status</p>
              <p><strong>Sales History:</strong> history_id, month, fg_code, fg_description, division, country, channel, units_sold, net_sales_aed</p>
              <p><strong>Forecast:</strong> forecast_id, month, fg_code, fg_description, division, country, channel, forecast_units, forecast_revenue_aed</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
