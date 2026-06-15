import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface ImportResult {
  success: boolean;
  message: string;
  rowsInserted?: number;
  rowsSkipped?: number;
  errors?: Array<{ row: number; error: string }>;
}

export default function DataImport() {
  const [file, setFile] = useState<File | null>(null);
  const [selectedTable, setSelectedTable] = useState<string>('fg_master');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

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
      setUploadProgress(0);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setResult({ success: false, message: 'Please select a file' });
      return;
    }

    setUploading(true);
    setUploadProgress(10);
    
    try {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          setUploadProgress(30);
          
          const data = event.target?.result as ArrayBuffer;
          const bytes = new Uint8Array(data);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);

          setUploadProgress(50);
          
          // Call the mutation and wait for response
          const response = await importMutation.mutateAsync({
            tableName: selectedTable,
            fileData: base64,
            fileName: file.name,
          });

          setUploadProgress(100);

          setResult({
            success: response.success,
            message: response.message,
            rowsInserted: response.rowsInserted,
            rowsSkipped: response.rowsSkipped,
            errors: response.errors,
          });
          
          if (response.success) {
            setFile(null);
            setTimeout(() => setUploadProgress(0), 1000);
          }
        } catch (error) {
          console.error('Upload error:', error);
          setResult({
            success: false,
            message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
          setUploadProgress(0);
        } finally {
          setUploading(false);
        }
      };

      reader.onerror = () => {
        setResult({
          success: false,
          message: 'Error reading file. Please try again.',
        });
        setUploading(false);
        setUploadProgress(0);
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Upload error:', error);
      setResult({
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      setUploading(false);
      setUploadProgress(0);
    }
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
              disabled={uploading}
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
            <div 
              className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer"
              onClick={() => !uploading && document.getElementById('file-input')?.click()}
              style={{ opacity: uploading ? 0.5 : 1, pointerEvents: uploading ? 'none' : 'auto' }}
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
                disabled={uploading}
              />
            </div>
          </div>

          {/* Progress Bar */}
          {uploading && uploadProgress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Uploading...</span>
                <span className="text-sm text-muted-foreground">{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

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
                Uploading... {Math.round(uploadProgress)}%
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
            <div className="space-y-3">
              <Alert variant={result.success ? 'default' : 'destructive'}>
                {result.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>{result.message}</AlertDescription>
              </Alert>
              
              {/* Show row counts */}
              {(result.rowsInserted !== undefined || result.rowsSkipped !== undefined) && (
                <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                  {result.rowsInserted !== undefined && (
                    <p className="text-green-600 font-medium">✓ Rows inserted: {result.rowsInserted}</p>
                  )}
                  {result.rowsSkipped !== undefined && result.rowsSkipped > 0 && (
                    <p className="text-amber-600 font-medium">⚠ Rows skipped: {result.rowsSkipped}</p>
                  )}
                </div>
              )}
              
              {/* Show first few errors */}
              {result.errors && result.errors.length > 0 && (
                <div className="bg-destructive/10 p-3 rounded-md text-sm space-y-1 max-h-48 overflow-y-auto border border-destructive/20">
                  <p className="font-medium text-destructive">
                    {result.errors.length > 5 ? `First 5 of ${result.errors.length} errors:` : `${result.errors.length} error(s):`}
                  </p>
                  {result.errors.slice(0, 5).map((err, idx) => (
                    <p key={idx} className="text-destructive text-xs font-mono">
                      Row {err.row}: {err.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
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
              <li>First row must contain column headers (can be snake_case or Title Case)</li>
              <li>Data starts from row 2</li>
              <li>Maximum 10,000 rows per upload</li>
              <li>Extra columns in Excel will be ignored</li>
              <li>Missing columns will be filled with defaults (null or 0)</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Column Names by Table (either format accepted):</h4>
            <div className="space-y-2 text-muted-foreground text-xs">
              <p><strong>FG Master:</strong> sku_id, description, category, division, brand, primary_plant, uom, active</p>
              <p><strong>RM Master:</strong> material_id, description, category, rm_type, uom, std_cost_aed, lead_time_days, supplier_name</p>
              <p><strong>BOM:</strong> bom_id, fg_code, fg_description, component_type, component_code, qty_per_fg, uom, scrap_percent</p>
              <p><strong>Inventory:</strong> inventory_id, item_id, item_type, location, batch_no, qty_on_hand, allocated, available, unit_cost_aed</p>
              <p><strong>PO Data:</strong> po_no, item_code, item_type, description, supplier_name, plant, po_date, qty_ordered, qty_received, status</p>
              <p><strong>Sales History:</strong> month, fg_code, fg_description, division, country, channel, units_sold, gross_sales_aed, promo_discount_percent, net_asp_aed, net_sales_aed, returns_units, fill_rate_percent, trade_spend_aed, sell_through_percent</p>
              <p><strong>Forecast:</strong> forecast_id, month, fg_code, fg_description, division, country, channel, forecast_units, forecast_asp_aed, forecast_revenue_aed</p>
            </div>
          </div>
          <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
            <p className="text-xs text-blue-900">
              <strong>💡 Tip:</strong> The importer is flexible! Use either snake_case (sku_id) or Title Case (SKU ID) column names. Missing columns are filled with defaults. Extra columns are ignored.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
