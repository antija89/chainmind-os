import { read, utils } from 'xlsx';
import { getDb } from './db';
import { fgMaster, rmMaster, bom, inventory, poData, salesHistory, forecast } from '../drizzle/schema';
import { InsertFgMaster, InsertRmMaster, InsertBom, InsertInventory, InsertPoData, InsertSalesHistory, InsertForecast } from '../drizzle/schema';

export async function importExcelData(
  tableName: string,
  fileBuffer: Buffer
): Promise<{ success: boolean; message: string; rowsInserted: number }> {
  try {
    const workbook = read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { success: false, message: 'No sheets found in Excel file', rowsInserted: 0 };
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = utils.sheet_to_json(worksheet) as Record<string, unknown>[];

    if (data.length === 0) {
      return { success: false, message: 'No data found in Excel sheet', rowsInserted: 0 };
    }

    if (data.length > 10000) {
      return { success: false, message: 'Maximum 10,000 rows allowed per upload', rowsInserted: 0 };
    }

    const db = await getDb();
    if (!db) {
      return { success: false, message: 'Database connection failed', rowsInserted: 0 };
    }

    let rowsInserted = 0;

    switch (tableName) {
      case 'fg_master':
        for (const row of data as any[]) {
          const insertData: InsertFgMaster = {
            skuId: String(row.sku_id || ''),
            description: row.description || null,
            category: row.category || null,
            division: row.division || null,
            brand: row.brand || null,
            primaryPlant: row.primary_plant || null,
            uom: row.uom || 'EA',
            active: row.active !== false,
          };
          try {
            await db.insert(fgMaster).values(insertData).onDuplicateKeyUpdate({ set: insertData });
            rowsInserted++;
          } catch (e) {
            console.error('Error inserting FG Master row:', e);
          }
        }
        break;

      case 'rm_master':
        for (const row of data as any[]) {
          const insertData: InsertRmMaster = {
            materialId: String(row.material_id || ''),
            description: row.description || null,
            category: row.category || null,
            rmType: row.rm_type || null,
            uom: row.uom || 'KG',
            stdCostAed: String(parseFloat(row.std_cost_aed) || 0),
            leadTimeDays: parseInt(row.lead_time_days) || 0,
            supplierName: row.supplier_name || null,
          };
          try {
            await db.insert(rmMaster).values(insertData).onDuplicateKeyUpdate({ set: insertData });
            rowsInserted++;
          } catch (e) {
            console.error('Error inserting RM Master row:', e);
          }
        }
        break;

      case 'bom':
        for (const row of data as any[]) {
          const insertData: InsertBom = {
            bomId: String(row.bom_id || ''),
            fgCode: row.fg_code || '',
            fgDescription: row.fg_description || null,
            componentType: row.component_type || '',
            componentCode: row.component_code || '',
            componentDescription: row.component_description || null,
            qtyPerFg: parseFloat(row.qty_per_fg) || 1,
            uom: row.uom || 'EA',
            scrapPercent: parseFloat(row.scrap_percent) || 0,
          };
          try {
            await db.insert(bom).values(insertData).onDuplicateKeyUpdate({ set: insertData });
            rowsInserted++;
          } catch (e) {
            console.error('Error inserting BOM row:', e);
          }
        }
        break;

      case 'inventory':
        for (const row of data as any[]) {
          const insertData: InsertInventory = {
            inventoryId: String(row.inventory_id || ''),
            itemId: row.item_id || '',
            itemType: row.item_type || 'FG',
            location: row.location || '',
            batchNo: row.batch_no || null,
            qtyOnHand: parseInt(row.qty_on_hand) || 0,
            allocated: parseInt(row.allocated) || 0,
            available: parseInt(row.available) || 0,
            unitCostAed: String(parseFloat(row.unit_cost_aed) || 0),
            stockStatus: row.stock_status || 'Normal',
            qcStatus: row.qc_status || 'Released',
          };
          try {
            await db.insert(inventory).values(insertData).onDuplicateKeyUpdate({ set: insertData });
            rowsInserted++;
          } catch (e) {
            console.error('Error inserting Inventory row:', e);
          }
        }
        break;

      case 'po_data':
        for (const row of data as any[]) {
          const insertData: InsertPoData = {
            poNo: String(row.po_no || ''),
            itemCode: row.item_code || '',
            itemType: row.item_type || 'RM',
            description: row.description || null,
            supplierName: row.supplier_name || '',
            plant: row.plant || '',
            poDate: row.po_date ? new Date(row.po_date) : new Date(),
            requestedDate: row.requested_date ? new Date(row.requested_date) : null,
            qtyOrdered: parseInt(row.qty_ordered) || 0,
            qtyReceived: parseInt(row.qty_received) || 0,
            openQty: parseInt(row.open_qty) || 0,
            unitCostAed: String(parseFloat(row.unit_cost_aed) || 0),
            status: row.status || 'Open',
            priority: row.priority || 'Normal',
          };
          try {
            await db.insert(poData).values(insertData).onDuplicateKeyUpdate({ set: insertData });
            rowsInserted++;
          } catch (e) {
            console.error('Error inserting PO Data row:', e);
          }
        }
        break;

      case 'sales_history':
        for (const row of data as any[]) {
          const insertData: InsertSalesHistory = {
            historyId: String(row.history_id || ''),
            month: String(row.month || ''),
            fgCode: String(row.fg_code || ''),
            fgDescription: row.fg_description || null,
            division: row.division || null,
            country: row.country || null,
            channel: row.channel || null,
            unitsSold: parseInt(row.units_sold) || 0,
            grossSalesAed: String(parseFloat(row.gross_sales_aed) || 0),
            netSalesAed: String(parseFloat(row.net_sales_aed) || 0),
          };
          try {
            await db.insert(salesHistory).values(insertData).onDuplicateKeyUpdate({ set: insertData });
            rowsInserted++;
          } catch (e) {
            console.error('Error inserting Sales History row:', e);
          }
        }
        break;

      case 'forecast':
        for (const row of data as any[]) {
          const insertData: InsertForecast = {
            forecastId: String(row.forecast_id || ''),
            month: String(row.month || ''),
            fgCode: String(row.fg_code || ''),
            fgDescription: row.fg_description || null,
            division: row.division || null,
            country: row.country || null,
            channel: row.channel || null,
            forecastUnits: parseInt(row.forecast_units) || 0,
            forecastAspAed: String(parseFloat(row.forecast_asp_aed) || 0),
            forecastRevenueAed: String(parseFloat(row.forecast_revenue_aed) || 0),
          };
          try {
            await db.insert(forecast).values(insertData).onDuplicateKeyUpdate({ set: insertData });
            rowsInserted++;
          } catch (e) {
            console.error('Error inserting Forecast row:', e);
          }
        }
        break;

      default:
        return { success: false, message: `Unknown table: ${tableName}`, rowsInserted: 0 };
    }

    return {
      success: true,
      message: `Successfully imported ${rowsInserted} rows to ${tableName}`,
      rowsInserted,
    };
  } catch (error) {
    console.error('Excel import error:', error);
    return {
      success: false,
      message: `Error importing file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      rowsInserted: 0,
    };
  }
}
