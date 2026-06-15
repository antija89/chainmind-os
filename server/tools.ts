import { getDb } from './db';
import { salesHistory, forecast, inventory, poData, fgMaster, suppliers } from '../drizzle/schema';
import { desc, eq, sql, and } from 'drizzle-orm';

// ─── Real DB-backed analytics ─────────────────────────────────────────────────

export async function getTopSellingSkus(limit = 5): Promise<string> {
  const db = await getDb();
  if (!db) return 'Database unavailable';
  try {
    const rows = await db
      .select({
        fgCode: salesHistory.fgCode,
        totalUnits: sql<number>`SUM(${salesHistory.unitsSold})`,
        totalRevenue: sql<number>`SUM(${salesHistory.grossSalesAed})`,
      })
      .from(salesHistory)
      .groupBy(salesHistory.fgCode)
      .orderBy(desc(sql`SUM(${salesHistory.unitsSold})`))
      .limit(limit);
    if (!rows.length) return 'No sales data available yet. Please upload sales history via Data Import.';
    const lines = rows.map((r, i) =>
      `${i + 1}. ${r.fgCode} — ${Number(r.totalUnits).toLocaleString()} units sold, AED ${Number(r.totalRevenue).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    );
    return `Top ${limit} SKUs by sales volume:\n${lines.join('\n')}`;
  } catch (e) {
    return `Error querying sales data: ${e}`;
  }
}

export async function getInventorySummary(): Promise<string> {
  const db = await getDb();
  if (!db) return 'Database unavailable';
  try {
    const rows = await db
      .select({
        itemId: inventory.itemId,
        itemType: inventory.itemType,
        qtyOnHand: inventory.qtyOnHand,
        available: inventory.available,
        inventoryValueAed: inventory.inventoryValueAed,
        stockStatus: inventory.stockStatus,
        ageDays: inventory.ageDays,
      })
      .from(inventory)
      .orderBy(desc(inventory.inventoryValueAed))
      .limit(15);
    if (!rows.length) return 'No inventory data available yet.';
    const totalValue = rows.reduce((s, r) => s + Number(r.inventoryValueAed || 0), 0);
    const lines = rows.map(r =>
      `• ${r.itemId} (${r.itemType}): ${Number(r.qtyOnHand).toLocaleString()} on hand, Status: ${r.stockStatus ?? 'N/A'}, Value: AED ${Number(r.inventoryValueAed || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    );
    return `Inventory (top ${rows.length} by value):\n${lines.join('\n')}\nTotal: AED ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  } catch (e) {
    return `Error querying inventory: ${e}`;
  }
}

export async function getOpenPoSummary(): Promise<string> {
  const db = await getDb();
  if (!db) return 'Database unavailable';
  try {
    const rows = await db
      .select({
        poNo: poData.poNo,
        supplierName: poData.supplierName,
        itemCode: poData.itemCode,
        openQty: poData.openQty,
        poValueAed: poData.poValueAed,
        status: poData.status,
        confirmedEta: poData.confirmedEta,
      })
      .from(poData)
      .where(eq(poData.status, 'open'))
      .orderBy(desc(poData.poValueAed))
      .limit(10);
    if (!rows.length) return 'No open purchase orders found.';
    const totalValue = rows.reduce((s, r) => s + Number(r.poValueAed || 0), 0);
    const lines = rows.map(r =>
      `• PO ${r.poNo} | ${r.itemCode} from ${r.supplierName}: ${Number(r.openQty).toLocaleString()} units open, AED ${Number(r.poValueAed || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}, ETA: ${r.confirmedEta ?? 'TBD'}`
    );
    return `Open POs (top ${rows.length} by value):\n${lines.join('\n')}\nTotal open PO value: AED ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  } catch (e) {
    return `Error querying PO data: ${e}`;
  }
}

export async function getForecastSummary(): Promise<string> {
  const db = await getDb();
  if (!db) return 'Database unavailable';
  try {
    const rows = await db
      .select({
        fgCode: forecast.fgCode,
        forecastPeriod: forecast.month,
        forecastUnits: forecast.forecastUnits,
        forecastRevenueAed: forecast.forecastRevenueAed,
        confidencePercent: forecast.confidencePercent,
      })
      .from(forecast)
      .orderBy(desc(forecast.forecastUnits))
      .limit(10);
    if (!rows.length) return 'No forecast data available yet.';
    const lines = rows.map(r =>
      `• ${r.fgCode} (${r.forecastPeriod ?? r.fgCode}): ${Number(r.forecastUnits).toLocaleString()} units, AED ${Number(r.forecastRevenueAed || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}, confidence: ${r.confidencePercent ?? 'N/A'}%`
    );
    return `Demand Forecast (top ${rows.length}):\n${lines.join('\n')}`;
  } catch (e) {
    return `Error querying forecast: ${e}`;
  }
}

export async function getLowStockAlerts(dosThreshold = 14): Promise<string> {
  const db = await getDb();
  if (!db) return 'Database unavailable';
  try {
    const rows = await db
      .select({
        itemId: inventory.itemId,
        itemType: inventory.itemType,
        qtyOnHand: inventory.qtyOnHand,
        stockStatus: inventory.stockStatus,
        ageDays: inventory.ageDays,
      })
      .from(inventory)
      .where(eq(inventory.stockStatus, 'low'))
      .orderBy(inventory.ageDays)
      .limit(10);
    if (!rows.length) return `No low-stock items found — inventory looks healthy.`;
    const lines = rows.map(r =>
      `• ${r.itemId} (${r.itemType}): ${Number(r.qtyOnHand).toLocaleString()} on hand, Status: ${r.stockStatus}, Age: ${r.ageDays ?? 'N/A'} days`
    );
    return `Low Stock Alerts (< ${dosThreshold} DOS):\n${lines.join('\n')}`;
  } catch (e) {
    return `Error querying low stock: ${e}`;
  }
}

export async function getSupplierList(): Promise<string> {
  const db = await getDb();
  if (!db) return 'Database unavailable';
  try {
    const rows = await db.select().from(suppliers).limit(20);
    if (!rows.length) return 'No supplier data available yet.';
    const lines = rows.map(r =>
      `• ${r.supplierName} (${r.supplierCode}) — ${r.country ?? 'N/A'}, Lead time: ${r.leadTimeDays ?? 'N/A'} days, ${r.paymentTerms ?? ''}`
    );
    return `Suppliers (${rows.length}):\n${lines.join('\n')}`;
  } catch (e) {
    return `Error querying suppliers: ${e}`;
  }
}

export async function getSalesTrend(fgCode?: string): Promise<string> {
  const db = await getDb();
  if (!db) return 'Database unavailable';
  try {
    const rows = fgCode
      ? await db.select({
        fgCode: salesHistory.fgCode,
        month: salesHistory.month,
        unitsSold: salesHistory.unitsSold,
        grossSalesAed: salesHistory.grossSalesAed,
        }).from(salesHistory).where(eq(salesHistory.fgCode, fgCode)).orderBy(salesHistory.month).limit(12)
      : await db.select({
          fgCode: salesHistory.fgCode,
          month: salesHistory.month,
          unitsSold: salesHistory.unitsSold,
          grossSalesAed: salesHistory.grossSalesAed,
        }).from(salesHistory).orderBy(desc(salesHistory.unitsSold)).limit(20);
    if (!rows.length) return 'No sales history data available yet.';
    const lines = rows.map(r =>
      `• ${r.fgCode} | ${r.month}: ${Number(r.unitsSold).toLocaleString()} units, AED ${Number(r.grossSalesAed || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    );
    return `Sales Trend${fgCode ? ` for ${fgCode}` : ''}:\n${lines.join('\n')}`;
  } catch (e) {
    return `Error querying sales trend: ${e}`;
  }
}

// ─── Gather live context for each agent ──────────────────────────────────────

export async function gatherAgentContext(agentName: string): Promise<string> {
  const parts: string[] = [];
  try {
    if (agentName === 'Demand Planner') {
      parts.push(await getTopSellingSkus(10));
      parts.push(await getForecastSummary());
      parts.push(await getSalesTrend());
    } else if (agentName === 'Supply Planner') {
      parts.push(await getInventorySummary());
      parts.push(await getLowStockAlerts(14));
      parts.push(await getOpenPoSummary());
    } else if (agentName === 'Production Planner') {
      parts.push(await getInventorySummary());
      parts.push(await getForecastSummary());
    } else if (agentName === 'Procurement Planner') {
      parts.push(await getOpenPoSummary());
      parts.push(await getSupplierList());
    } else if (agentName === 'Ops Head') {
      parts.push(await getTopSellingSkus(5));
      parts.push(await getInventorySummary());
      parts.push(await getOpenPoSummary());
      parts.push(await getLowStockAlerts(14));
    }
  } catch (e) {
    parts.push(`Note: Some data could not be loaded — ${e}`);
  }
  return parts.filter(Boolean).join('\n\n---\n\n');
}

// ─── Legacy exports (kept for compatibility) ──────────────────────────────────

export const TOOL_REGISTRY: Record<string, () => Promise<string>> = {
  top_selling_skus: () => getTopSellingSkus(5),
  inventory_summary: () => getInventorySummary(),
  open_po_summary: () => getOpenPoSummary(),
  forecast_summary: () => getForecastSummary(),
  low_stock_alerts: () => getLowStockAlerts(14),
  supplier_list: () => getSupplierList(),
  sales_trend: () => getSalesTrend(),
};

export async function executeTool(toolName: string): Promise<string> {
  const fn = TOOL_REGISTRY[toolName];
  if (!fn) return `Unknown tool: ${toolName}`;
  return fn();
}
