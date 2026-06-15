import { read, utils } from 'xlsx';
import { getDb } from './db';
import { Buffer } from 'buffer';
import { nanoid } from 'nanoid';
import { fgMaster, rmMaster, bom, inventory, poData, salesHistory, forecast } from '../drizzle/schema';
import { InsertFgMaster, InsertRmMaster, InsertBom, InsertInventory, InsertPoData, InsertSalesHistory, InsertForecast } from '../drizzle/schema';

interface ImportResult {
  success: boolean;
  message: string;
  rowsInserted: number;
  rowsSkipped: number;
  errors: Array<{ row: number; error: string }>;
}

// Helper function to safely parse numbers
function safeParseNumber(value: unknown, defaultValue: number = 0): number {
  if (value === null || value === undefined || value === '') return defaultValue;
  const num = parseFloat(String(value));
  return isNaN(num) ? defaultValue : num;
}

// Helper function to safely parse integers
function safeParseInt(value: unknown, defaultValue: number = 0): number {
  if (value === null || value === undefined || value === '') return defaultValue;
  const num = parseInt(String(value));
  return isNaN(num) ? defaultValue : num;
}

// Helper function to safely parse dates
function safeParseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  try {
    const date = new Date(String(value));
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

// Helper function to get value from multiple possible column names
function getColumnValue(row: Record<string, unknown>, ...columnNames: string[]): unknown {
  for (const name of columnNames) {
    if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
      return row[name];
    }
  }
  return undefined;
}

export async function importExcelData(
  tableName: string,
  fileBuffer: Buffer
): Promise<ImportResult> {
  const errors: Array<{ row: number; error: string }> = [];
  let rowsInserted = 0;
  let rowsSkipped = 0;

  try {
    // Parse Excel file
    let workbook;
    try {
      workbook = read(fileBuffer, { type: 'buffer' });
    } catch (e) {
      return {
        success: false,
        message: `Failed to parse Excel file: ${e instanceof Error ? e.message : 'Invalid file format'}`,
        rowsInserted: 0,
        rowsSkipped: 0,
        errors: [{ row: 0, error: 'File parsing failed' }],
      };
    }

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        success: false,
        message: 'No sheets found in Excel file',
        rowsInserted: 0,
        rowsSkipped: 0,
        errors: [{ row: 0, error: 'No sheets found' }],
      };
    }

    // Parse sheet data
    const worksheet = workbook.Sheets[sheetName];
    let data: Record<string, unknown>[];
    try {
      data = utils.sheet_to_json(worksheet) as Record<string, unknown>[];
    } catch (e) {
      return {
        success: false,
        message: `Failed to parse sheet data: ${e instanceof Error ? e.message : 'Unknown error'}`,
        rowsInserted: 0,
        rowsSkipped: 0,
        errors: [{ row: 0, error: 'Sheet parsing failed' }],
      };
    }

    // Validate data
    if (data.length === 0) {
      return {
        success: false,
        message: 'No data found in Excel sheet',
        rowsInserted: 0,
        rowsSkipped: 0,
        errors: [{ row: 0, error: 'Empty sheet' }],
      };
    }

    if (data.length > 10000) {
      return {
        success: false,
        message: 'Maximum 10,000 rows allowed per upload. Your file has ' + data.length + ' rows.',
        rowsInserted: 0,
        rowsSkipped: 0,
        errors: [{ row: 0, error: `Too many rows: ${data.length}` }],
      };
    }

    // Get database connection
    const db = await getDb();
    if (!db) {
      return {
        success: false,
        message: 'Database connection failed',
        rowsInserted: 0,
        rowsSkipped: 0,
        errors: [{ row: 0, error: 'Database connection failed' }],
      };
    }

    // Process rows based on table type
    switch (tableName) {
      case 'fg_master':
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          try {
            const insertData: InsertFgMaster = {
              skuId: String(getColumnValue(row, 'sku_id') || ''),
              description: (getColumnValue(row, 'description') as string | null) || null,
              category: (getColumnValue(row, 'category') as string | null) || null,
              division: (getColumnValue(row, 'division') as string | null) || null,
              brand: (getColumnValue(row, 'brand') as string | null) || null,
              primaryPlant: (getColumnValue(row, 'primary_plant') as string | null) || null,
              uom: String(getColumnValue(row, 'uom') || 'EA'),
              active: getColumnValue(row, 'active') !== false,
            };

            if (!insertData.skuId) {
              errors.push({ row: i + 2, error: 'Missing required field: sku_id' });
              rowsSkipped++;
              continue;
            }

            await db.insert(fgMaster).values(insertData).onDuplicateKeyUpdate({ set: insertData });
            rowsInserted++;
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : 'Unknown error';
            errors.push({ row: i + 2, error: errorMsg });
            rowsSkipped++;
          }
        }
        break;

      case 'rm_master':
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          try {
            const insertData: InsertRmMaster = {
              materialId: String(getColumnValue(row, 'material_id') || ''),
              description: (getColumnValue(row, 'description') as string | null) || null,
              category: (getColumnValue(row, 'category') as string | null) || null,
              rmType: (getColumnValue(row, 'rm_type') as string | null) || null,
              uom: String(getColumnValue(row, 'uom') || 'KG'),
              stdCostAed: String(safeParseNumber(getColumnValue(row, 'std_cost_aed'))),
              leadTimeDays: safeParseInt(getColumnValue(row, 'lead_time_days')),
              supplierName: (getColumnValue(row, 'supplier_name') as string | null) || null,
            };

            if (!insertData.materialId) {
              errors.push({ row: i + 2, error: 'Missing required field: material_id' });
              rowsSkipped++;
              continue;
            }

            await db.insert(rmMaster).values(insertData).onDuplicateKeyUpdate({ set: insertData });
            rowsInserted++;
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : 'Unknown error';
            errors.push({ row: i + 2, error: errorMsg });
            rowsSkipped++;
          }
        }
        break;

      case 'bom':
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          try {
            const insertData: InsertBom = {
              bomId: String(getColumnValue(row, 'bom_id') || nanoid()),
              fgCode: String(getColumnValue(row, 'fg_code') || ''),
              fgDescription: (getColumnValue(row, 'fg_description') as string | null) || null,
              componentType: String(getColumnValue(row, 'component_type') || ''),
              componentCode: String(getColumnValue(row, 'component_code') || ''),
              componentDescription: (getColumnValue(row, 'component_description') as string | null) || null,
              qtyPerFg: safeParseNumber(getColumnValue(row, 'qty_per_fg'), 1),
              uom: String(getColumnValue(row, 'uom') || 'EA'),
              scrapPercent: safeParseNumber(getColumnValue(row, 'scrap_percent')),
            };

            await db.insert(bom).values(insertData).onDuplicateKeyUpdate({ set: insertData });
            rowsInserted++;
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : 'Unknown error';
            errors.push({ row: i + 2, error: errorMsg });
            rowsSkipped++;
          }
        }
        break;

      case 'inventory':
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          try {
            const insertData: InsertInventory = {
              inventoryId: String(getColumnValue(row, 'inventory_id') || nanoid()),
              itemId: String(getColumnValue(row, 'item_id') || ''),
              itemType: String(getColumnValue(row, 'item_type') || 'FG'),
              location: String(getColumnValue(row, 'location') || ''),
              batchNo: (getColumnValue(row, 'batch_no') as string | null) || null,
              qtyOnHand: safeParseInt(getColumnValue(row, 'qty_on_hand')),
              allocated: safeParseInt(getColumnValue(row, 'allocated')),
              available: safeParseInt(getColumnValue(row, 'available')),
              unitCostAed: String(safeParseNumber(getColumnValue(row, 'unit_cost_aed'))),
              stockStatus: String(getColumnValue(row, 'stock_status') || 'Normal'),
              qcStatus: String(getColumnValue(row, 'qc_status') || 'Released'),
            };

            await db.insert(inventory).values(insertData).onDuplicateKeyUpdate({ set: insertData });
            rowsInserted++;
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : 'Unknown error';
            errors.push({ row: i + 2, error: errorMsg });
            rowsSkipped++;
          }
        }
        break;

      case 'po_data':
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          try {
            const insertData: InsertPoData = {
              poNo: String(getColumnValue(row, 'po_no') || ''),
              itemCode: String(getColumnValue(row, 'item_code') || ''),
              itemType: String(getColumnValue(row, 'item_type') || 'RM'),
              description: (getColumnValue(row, 'description') as string | null) || null,
              supplierName: String(getColumnValue(row, 'supplier_name') || ''),
              plant: String(getColumnValue(row, 'plant') || ''),
              poDate: safeParseDate(getColumnValue(row, 'po_date')) || new Date(),
              requestedDate: safeParseDate(getColumnValue(row, 'requested_date')),
              qtyOrdered: safeParseInt(getColumnValue(row, 'qty_ordered')),
              qtyReceived: safeParseInt(getColumnValue(row, 'qty_received')),
              openQty: safeParseInt(getColumnValue(row, 'open_qty')),
              unitCostAed: String(safeParseNumber(getColumnValue(row, 'unit_cost_aed'))),
              status: String(getColumnValue(row, 'status') || 'Open'),
              priority: String(getColumnValue(row, 'priority') || 'Normal'),
            };

            if (!insertData.poNo) {
              errors.push({ row: i + 2, error: 'Missing required field: po_no' });
              rowsSkipped++;
              continue;
            }

            await db.insert(poData).values(insertData).onDuplicateKeyUpdate({ set: insertData });
            rowsInserted++;
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : 'Unknown error';
            errors.push({ row: i + 2, error: errorMsg });
            rowsSkipped++;
          }
        }
        break;

      case 'sales_history':
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          try {
            // Support multiple column name variations
            const month = String(getColumnValue(row, 'month', 'Month') || '');
            const fgCode = String(getColumnValue(row, 'fg_code', 'FG Code') || '');
            const fgDescription = (getColumnValue(row, 'fg_description', 'FG Description') as string | null) || null;
            const division = (getColumnValue(row, 'division', 'Division') as string | null) || null;
            const country = (getColumnValue(row, 'country', 'Country') as string | null) || null;
            const channel = (getColumnValue(row, 'channel', 'Channel') as string | null) || null;
            const unitsSold = safeParseNumber(getColumnValue(row, 'units_sold', 'Units Sold'));
            const grossSalesAed = String(safeParseNumber(getColumnValue(row, 'gross_sales_aed', 'Gross Sales AED')));
            const promoDiscountPercent = safeParseNumber(getColumnValue(row, 'promo_discount_percent', 'Promo Discount %'));
            const netAspAed = String(safeParseNumber(getColumnValue(row, 'net_asp_aed', 'Net ASP AED')));
            const netSalesAed = String(safeParseNumber(getColumnValue(row, 'net_sales_aed', 'Net Sales AED')));
            const returnsUnits = safeParseNumber(getColumnValue(row, 'returns_units', 'Returns Units'));
            const fillRatePercent = safeParseNumber(getColumnValue(row, 'fill_rate_percent', 'Fill Rate %'));
            const tradeSpendAed = String(safeParseNumber(getColumnValue(row, 'trade_spend_aed', 'Trade Spend AED')));
            const sellThroughPercent = safeParseNumber(getColumnValue(row, 'sell_through_percent', 'Sell Through %'));

            const insertData: InsertSalesHistory = {
              historyId: String(getColumnValue(row, 'history_id') || nanoid()),
              month,
              fgCode,
              fgDescription,
              division,
              country,
              channel,
              unitsSold,
              grossSalesAed,
              promoDiscountPercent,
              netAspAed,
              netSalesAed,
              returnsUnits,
              fillRatePercent,
              tradeSpendAed,
              sellThroughPercent,
            };

            await db.insert(salesHistory).values(insertData).onDuplicateKeyUpdate({ set: insertData });
            rowsInserted++;
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : 'Unknown error';
            errors.push({ row: i + 2, error: errorMsg });
            rowsSkipped++;
          }
        }
        break;

      case 'forecast':
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          try {
            const insertData: InsertForecast = {
              forecastId: String(getColumnValue(row, 'forecast_id') || nanoid()),
              month: String(getColumnValue(row, 'month', 'Month') || ''),
              fgCode: String(getColumnValue(row, 'fg_code', 'FG Code') || ''),
              fgDescription: (getColumnValue(row, 'fg_description', 'FG Description') as string | null) || null,
              division: (getColumnValue(row, 'division', 'Division') as string | null) || null,
              country: (getColumnValue(row, 'country', 'Country') as string | null) || null,
              channel: (getColumnValue(row, 'channel', 'Channel') as string | null) || null,
              forecastUnits: safeParseInt(getColumnValue(row, 'forecast_units', 'Forecast Units')),
              forecastAspAed: String(safeParseNumber(getColumnValue(row, 'forecast_asp_aed', 'Forecast ASP AED'))),
              forecastRevenueAed: String(safeParseNumber(getColumnValue(row, 'forecast_revenue_aed', 'Forecast Revenue AED'))),
            };

            await db.insert(forecast).values(insertData).onDuplicateKeyUpdate({ set: insertData });
            rowsInserted++;
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : 'Unknown error';
            errors.push({ row: i + 2, error: errorMsg });
            rowsSkipped++;
          }
        }
        break;

      default:
        return {
          success: false,
          message: `Unknown table: ${tableName}`,
          rowsInserted: 0,
          rowsSkipped: 0,
          errors: [{ row: 0, error: `Unknown table: ${tableName}` }],
        };
    }

    // Build success message
    let message = `Successfully imported ${rowsInserted} rows to ${tableName}`;
    if (rowsSkipped > 0) {
      message += ` (${rowsSkipped} rows skipped due to errors)`;
    }

    return {
      success: rowsInserted > 0,
      message,
      rowsInserted,
      rowsSkipped,
      errors: errors.slice(0, 10), // Return first 10 errors only
    };
  } catch (error) {
    console.error('Excel import error:', error);
    return {
      success: false,
      message: `Error importing file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      rowsInserted: 0,
      rowsSkipped: 0,
      errors: [{ row: 0, error: error instanceof Error ? error.message : 'Unknown error' }],
    };
  }
}
