import { DailyUsage } from '../models/DailyUsage.js';
import { StockMovement } from '../models/StockMovement.js';
import { Batch } from '../models/Batch.js';
import { Medicine } from '../models/Medicine.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { Forecast } from '../models/Forecast.js';
import { ReorderRecommendation } from '../models/ReorderRecommendation.js';
import { getStartOfToday, calculateDaysToExpiry } from '../utils/dates.js';

/**
 * Helper to convert an array of objects to CSV string
 */
export function jsonToCsv(headers, rows) {
  const headerLine = headers.map((h) => `"${h.label}"`).join(',');
  const rowLines = rows.map((row) =>
    headers
      .map((h) => {
        const val = row[h.key];
        if (val === null || val === undefined) return '""';
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(',')
  );
  return [headerLine, ...rowLines].join('\n');
}

/**
 * 1. Consumption Trends Report
 */
export async function getConsumptionReport({ from, to, medicineId }) {
  const filter = {};
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
  }
  if (medicineId) {
    filter.medicineId = medicineId;
  }

  const records = await DailyUsage.find(filter)
    .populate('medicineId', 'name medicineCode unit')
    .sort({ date: 1 });

  const tableData = records.map((r) => {
    const dateStr = r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).slice(0, 10);
    return {
      date: dateStr,
      medicineCode: r.medicineId?.medicineCode || 'N/A',
      medicineName: r.medicineId?.name || 'Unknown',
      unitsDispensed: r.unitsDispensed || 0,
      stockoutObserved: r.stockoutObserved ? 'Yes' : 'No',
      dataSource: r.dataSource || 'ledger'
    };
  });

  // Aggregate by date for the chart
  const dateMap = {};
  tableData.forEach((r) => {
    dateMap[r.date] = (dateMap[r.date] || 0) + (r.unitsDispensed || 0);
  });
  const chartData = Object.keys(dateMap)
    .sort()
    .map((d) => ({ date: d, unitsDispensed: dateMap[d] }));

  const headers = [
    { key: 'date', label: 'Date' },
    { key: 'medicineCode', label: 'Medicine Code' },
    { key: 'medicineName', label: 'Medicine Name' },
    { key: 'unitsDispensed', label: 'Units Dispensed' },
    { key: 'stockoutObserved', label: 'Stockout Observed' },
    { key: 'dataSource', label: 'Data Source' }
  ];

  return {
    title: 'Consumption Trends',
    explanation: 'Daily dispensing and aggregate consumption trends across active medicines over the selected timeframe.',
    chartData,
    tableData,
    headers,
    totalDispensed: tableData.reduce((sum, r) => sum + r.unitsDispensed, 0)
  };
}

/**
 * 2. Stock Movements Summary Report
 */
export async function getStockMovementsReport({ from, to, medicineId }) {
  const filter = {};
  if (from || to) {
    filter.timestamp = {};
    if (from) filter.timestamp.$gte = new Date(from);
    if (to) filter.timestamp.$lte = new Date(to);
  }
  if (medicineId) {
    filter.medicineId = medicineId;
  }

  const movements = await StockMovement.find(filter)
    .populate('medicineId', 'name medicineCode')
    .populate('batchId', 'batchNumber')
    .populate('performedBy', 'name')
    .sort({ timestamp: -1 });

  // Group summary by type
  const typeMap = {};
  movements.forEach((m) => {
    const t = m.movementType;
    if (!typeMap[t]) {
      typeMap[t] = { movementType: t, count: 0, totalQuantityChange: 0 };
    }
    typeMap[t].count++;
    typeMap[t].totalQuantityChange += m.quantityChange;
  });

  const chartData = Object.values(typeMap);

  const tableData = movements.map((m) => ({
    timestamp: m.timestamp ? new Date(m.timestamp).toISOString().split('T')[0] : '',
    medicineCode: m.medicineId?.medicineCode || 'N/A',
    medicineName: m.medicineId?.name || 'Unknown',
    batchNumber: m.batchId?.batchNumber || 'N/A',
    movementType: m.movementType,
    quantityChange: m.quantityChange,
    balanceBefore: m.balanceBefore,
    balanceAfter: m.balanceAfter,
    reason: m.reason || 'None',
    performedBy: m.performedBy?.name || 'System'
  }));

  const headers = [
    { key: 'timestamp', label: 'Date' },
    { key: 'medicineCode', label: 'Medicine Code' },
    { key: 'medicineName', label: 'Medicine Name' },
    { key: 'batchNumber', label: 'Batch No.' },
    { key: 'movementType', label: 'Movement Type' },
    { key: 'quantityChange', label: 'Quantity Change' },
    { key: 'balanceBefore', label: 'Balance Before' },
    { key: 'balanceAfter', label: 'Balance After' },
    { key: 'reason', label: 'Reason' },
    { key: 'performedBy', label: 'User' }
  ];

  return {
    title: 'Stock Movements Summary',
    explanation: 'Summary breakdown of inventory ledger transactions grouped by movement type (receipt, dispense, return, adjust, write-off, correction).',
    chartData,
    tableData,
    headers,
    totalMovements: movements.length
  };
}

/**
 * 3. Realized Wastage Report (Expiry Write-offs only)
 */
export async function getWastageReport({ from, to, medicineId }) {
  const filter = { movementType: 'expiry_writeoff' };
  if (from || to) {
    filter.timestamp = {};
    if (from) filter.timestamp.$gte = new Date(from);
    if (to) filter.timestamp.$lte = new Date(to);
  }
  if (medicineId) {
    filter.medicineId = medicineId;
  }

  const writeoffs = await StockMovement.find(filter)
    .populate('medicineId', 'name medicineCode unit')
    .populate('batchId', 'batchNumber purchaseCostPerUnit')
    .sort({ timestamp: -1 });

  let totalRealizedLoss = 0;
  let totalUnitsWrittenOff = 0;

  const tableData = writeoffs.map((w) => {
    const qty = Math.abs(w.quantityChange);
    const unitCost = w.batchId?.purchaseCostPerUnit ?? null;
    const loss = unitCost !== null && unitCost > 0 ? Number((unitCost * qty).toFixed(2)) : null;

    totalUnitsWrittenOff += qty;
    if (loss !== null) {
      totalRealizedLoss += loss;
    }

    return {
      date: w.timestamp ? new Date(w.timestamp).toISOString().split('T')[0] : '',
      medicineCode: w.medicineId?.medicineCode || 'N/A',
      medicineName: w.medicineId?.name || 'Unknown',
      batchNumber: w.batchId?.batchNumber || 'N/A',
      quantityWrittenOff: qty,
      unitCost: unitCost !== null ? `$${unitCost.toFixed(2)}` : 'Cost unavailable',
      realizedLoss: loss !== null ? `$${loss.toFixed(2)}` : 'Cost unavailable',
      reason: w.reason || 'Expired batch write-off'
    };
  });

  const chartMap = {};
  tableData.forEach((r) => {
    chartMap[r.medicineName] = (chartMap[r.medicineName] || 0) + r.quantityWrittenOff;
  });
  const chartData = Object.keys(chartMap).map((k) => ({ medicine: k, quantity: chartMap[k] }));

  const headers = [
    { key: 'date', label: 'Date' },
    { key: 'medicineCode', label: 'Medicine Code' },
    { key: 'medicineName', label: 'Medicine Name' },
    { key: 'batchNumber', label: 'Batch No.' },
    { key: 'quantityWrittenOff', label: 'Units Written Off' },
    { key: 'unitCost', label: 'Unit Cost' },
    { key: 'realizedLoss', label: 'Realized Loss' },
    { key: 'reason', label: 'Reason' }
  ];

  return {
    title: 'Realized Wastage (Write-offs)',
    explanation: 'Realized inventory losses from verified expiry write-offs and disposals (excludes projected exposure).',
    chartData,
    tableData,
    headers,
    totalUnitsWrittenOff,
    totalRealizedLoss: Number(totalRealizedLoss.toFixed(2))
  };
}

/**
 * 4. Projected Expiry Exposure Report (Estimated)
 */
export async function getExpiryExposureReport({ medicineId }) {
  const startOfToday = getStartOfToday();
  const filter = {
    status: 'active',
    currentQuantity: { $gt: 0 },
    expiryDate: { $gte: startOfToday }
  };
  if (medicineId) {
    filter.medicineId = medicineId;
  }

  const batches = await Batch.find(filter)
    .populate('medicineId', 'name medicineCode')
    .sort({ expiryDate: 1 });

  let estimatedExposureUnits = 0;
  let estimatedExposureValue = 0;

  const tableData = batches.map((b) => {
    const daysLeft = calculateDaysToExpiry(b.expiryDate);
    const unitCost = b.purchaseCostPerUnit ?? null;
    // Estimated risk calculation based on shelf life
    let leftoverPct = 0;
    if (daysLeft <= 14) leftoverPct = 80;
    else if (daysLeft <= 30) leftoverPct = 50;
    else if (daysLeft <= 60) leftoverPct = 25;
    else leftoverPct = 5;

    const estimatedLeftover = Math.round((b.currentQuantity * leftoverPct) / 100);
    const exposureVal = unitCost !== null ? Number((estimatedLeftover * unitCost).toFixed(2)) : null;

    estimatedExposureUnits += estimatedLeftover;
    if (exposureVal !== null) {
      estimatedExposureValue += exposureVal;
    }

    let riskLevel = 'low';
    if (leftoverPct >= 60 || (leftoverPct >= 30 && daysLeft <= 14)) riskLevel = 'critical';
    else if (leftoverPct >= 30) riskLevel = 'high';
    else if (leftoverPct >= 10) riskLevel = 'medium';

    return {
      batchNumber: b.batchNumber,
      medicineCode: b.medicineId?.medicineCode || 'N/A',
      medicineName: b.medicineId?.name || 'Unknown',
      expiryDate: b.expiryDate ? new Date(b.expiryDate).toISOString().split('T')[0] : '',
      daysLeft,
      currentQuantity: b.currentQuantity,
      estimatedLeftover,
      leftoverPct: `${leftoverPct}%`,
      exposureValue: exposureVal !== null ? `$${exposureVal.toFixed(2)}` : 'Cost unavailable',
      riskLevel: riskLevel.toUpperCase()
    };
  });

  const chartData = [
    { risk: 'CRITICAL', batches: tableData.filter((r) => r.riskLevel === 'CRITICAL').length },
    { risk: 'HIGH', batches: tableData.filter((r) => r.riskLevel === 'HIGH').length },
    { risk: 'MEDIUM', batches: tableData.filter((r) => r.riskLevel === 'MEDIUM').length },
    { risk: 'LOW', batches: tableData.filter((r) => r.riskLevel === 'LOW').length }
  ];

  const headers = [
    { key: 'batchNumber', label: 'Batch No.' },
    { key: 'medicineCode', label: 'Medicine Code' },
    { key: 'medicineName', label: 'Medicine Name' },
    { key: 'expiryDate', label: 'Expiry Date' },
    { key: 'daysLeft', label: 'Days Left' },
    { key: 'currentQuantity', label: 'Current Quantity' },
    { key: 'estimatedLeftover', label: 'Estimated Leftover' },
    { key: 'leftoverPct', label: 'Leftover %' },
    { key: 'exposureValue', label: 'Exposure Value' },
    { key: 'riskLevel', label: 'Risk Level' }
  ];

  return {
    title: 'Projected Expiry Exposure (Estimated)',
    explanation: 'Estimated future expiry exposure based on current stock, shelf life, and projected FEFO consumption (projections, not guarantees).',
    chartData,
    tableData,
    headers,
    estimatedExposureUnits,
    estimatedExposureValue: Number(estimatedExposureValue.toFixed(2)),
    disclaimer: 'Estimated — based on forecasts and assumptions, not guaranteed.'
  };
}

/**
 * 5. Stockout Incidents Report
 */
export async function getStockoutsReport({ from, to, medicineId }) {
  const filter = { stockoutObserved: true };
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
  }
  if (medicineId) {
    filter.medicineId = medicineId;
  }

  const stockouts = await DailyUsage.find(filter)
    .populate('medicineId', 'name medicineCode reorderLevel')
    .sort({ date: -1 });

  const tableData = stockouts.map((s) => ({
    date: s.date,
    medicineCode: s.medicineId?.medicineCode || 'N/A',
    medicineName: s.medicineId?.name || 'Unknown',
    incidentType: 'Observed Stockout',
    usableStock: 0,
    reorderLevel: s.medicineId?.reorderLevel ?? 0,
    details: 'Zero usable stock recorded during dispense operations.'
  }));

  const chartMap = {};
  tableData.forEach((r) => {
    chartMap[r.medicineName] = (chartMap[r.medicineName] || 0) + 1;
  });
  const chartData = Object.keys(chartMap).map((k) => ({ medicine: k, incidents: chartMap[k] }));

  const headers = [
    { key: 'date', label: 'Date' },
    { key: 'medicineCode', label: 'Medicine Code' },
    { key: 'medicineName', label: 'Medicine Name' },
    { key: 'incidentType', label: 'Incident Type' },
    { key: 'usableStock', label: 'Usable Stock' },
    { key: 'reorderLevel', label: 'Reorder Level' },
    { key: 'details', label: 'Details' }
  ];

  return {
    title: 'Stockout Incidents',
    explanation: 'Historical and projected stockout incidents identifying inventory gaps and zero-stock occurrences.',
    chartData,
    tableData,
    headers,
    totalIncidents: tableData.length
  };
}

/**
 * 6. Purchase History Report
 */
export async function getPurchasesReport({ from, to, supplierId }) {
  const filter = {};
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  if (supplierId) {
    filter.supplierId = supplierId;
  }

  const orders = await PurchaseOrder.find(filter)
    .populate('supplierId', 'name')
    .sort({ createdAt: -1 });

  const tableData = orders.map((o) => {
    const totalOrdered = o.items.reduce((s, it) => s + (it.quantityOrdered || 0), 0);
    const totalReceived = o.items.reduce((s, it) => s + (it.quantityReceived || 0), 0);

    return {
      orderNumber: o.orderNumber,
      supplierName: o.supplierId?.name || 'N/A',
      orderDate: o.createdAt ? new Date(o.createdAt).toISOString().split('T')[0] : '',
      expectedDeliveryDate: o.expectedDeliveryDate ? new Date(o.expectedDeliveryDate).toISOString().split('T')[0] : 'N/A',
      status: o.status,
      itemCount: o.items.length,
      totalOrderedQty: totalOrdered,
      totalReceivedQty: totalReceived,
      estimatedTotalCost: o.estimatedTotalCost !== null ? `$${o.estimatedTotalCost.toFixed(2)}` : 'Cost unavailable'
    };
  });

  const chartMap = {};
  orders.forEach((o) => {
    chartMap[o.status] = (chartMap[o.status] || 0) + 1;
  });
  const chartData = Object.keys(chartMap).map((st) => ({ status: st, count: chartMap[st] }));

  const headers = [
    { key: 'orderNumber', label: 'Order No.' },
    { key: 'supplierName', label: 'Supplier' },
    { key: 'orderDate', label: 'Order Date' },
    { key: 'expectedDeliveryDate', label: 'Expected Delivery' },
    { key: 'status', label: 'Status' },
    { key: 'itemCount', label: 'Line Items' },
    { key: 'totalOrderedQty', label: 'Ordered Qty' },
    { key: 'totalReceivedQty', label: 'Received Qty' },
    { key: 'estimatedTotalCost', label: 'Total Cost' }
  ];

  return {
    title: 'Purchase History',
    explanation: 'Purchase order fulfillment history, received stock volumes, and supplier delivery tracking.',
    chartData,
    tableData,
    headers,
    totalOrders: orders.length
  };
}

/**
 * 7. Stock Valuation Report
 */
export async function getValuationReport({ medicineId }) {
  const startOfToday = getStartOfToday();
  const filter = {
    status: 'active',
    currentQuantity: { $gt: 0 },
    expiryDate: { $gte: startOfToday }
  };
  if (medicineId) {
    filter.medicineId = medicineId;
  }

  const batches = await Batch.find(filter)
    .populate('medicineId', 'name medicineCode')
    .sort({ 'medicineId.name': 1 });

  let totalValuation = 0;
  let totalValuedUnits = 0;
  let unvaluedUnitsCount = 0;

  const tableData = batches.map((b) => {
    const unitCost = b.purchaseCostPerUnit ?? null;
    const isCostKnown = unitCost !== null && unitCost > 0;
    const valuation = isCostKnown ? Number((b.currentQuantity * unitCost).toFixed(2)) : null;

    if (isCostKnown) {
      totalValuation += valuation;
      totalValuedUnits += b.currentQuantity;
    } else {
      unvaluedUnitsCount += b.currentQuantity;
    }

    return {
      medicineCode: b.medicineId?.medicineCode || 'N/A',
      medicineName: b.medicineId?.name || 'Unknown',
      batchNumber: b.batchNumber,
      currentQuantity: b.currentQuantity,
      unitCost: isCostKnown ? `$${unitCost.toFixed(2)}` : 'Cost unavailable',
      totalValuation: valuation !== null ? `$${valuation.toFixed(2)}` : 'Cost unavailable',
      costStatus: isCostKnown ? 'Recorded' : 'Cost unavailable'
    };
  });

  const chartMap = {};
  tableData.forEach((r) => {
    if (r.costStatus === 'Recorded') {
      const val = parseFloat(r.totalValuation.replace('$', '')) || 0;
      chartMap[r.medicineName] = (chartMap[r.medicineName] || 0) + val;
    }
  });
  const chartData = Object.keys(chartMap)
    .slice(0, 10)
    .map((k) => ({ medicine: k, value: Number(chartMap[k].toFixed(2)) }));

  const headers = [
    { key: 'medicineCode', label: 'Medicine Code' },
    { key: 'medicineName', label: 'Medicine Name' },
    { key: 'batchNumber', label: 'Batch No.' },
    { key: 'currentQuantity', label: 'Quantity' },
    { key: 'unitCost', label: 'Unit Cost' },
    { key: 'totalValuation', label: 'Valuation' },
    { key: 'costStatus', label: 'Cost Status' }
  ];

  return {
    title: 'Stock Valuation',
    explanation: 'Current active inventory valuation based on recorded unit purchase costs (excluding batches with unknown costs).',
    chartData,
    tableData,
    headers,
    totalValuation: Number(totalValuation.toFixed(2)),
    totalValuedUnits,
    unvaluedUnitsCount,
    hasUnknownCostLines: unvaluedUnitsCount > 0
  };
}

/**
 * 8. Forecast Performance Report
 */
export async function getForecastPerformanceReport({ medicineId }) {
  const filter = {};
  if (medicineId) {
    filter.medicineId = medicineId;
  }

  const forecasts = await Forecast.find(filter)
    .populate('medicineId', 'name medicineCode')
    .sort({ generatedAt: -1 });

  const tableData = forecasts.map((f) => ({
    generatedAt: f.generatedAt ? new Date(f.generatedAt).toISOString().split('T')[0] : '',
    medicineCode: f.medicineId?.medicineCode || 'N/A',
    medicineName: f.medicineId?.name || 'Unknown',
    modelName: f.modelName,
    modelVersion: f.modelVersion,
    horizonDays: f.horizonDays,
    mae: f.evaluationMetrics?.mae ?? 'N/A',
    rmse: f.evaluationMetrics?.rmse ?? 'N/A',
    wape: f.evaluationMetrics?.wape !== null && f.evaluationMetrics?.wape !== undefined
      ? `${(f.evaluationMetrics.wape * 100).toFixed(1)}%`
      : 'N/A',
    baselineWape: f.evaluationMetrics?.baselineWape !== null && f.evaluationMetrics?.baselineWape !== undefined
      ? `${(f.evaluationMetrics.baselineWape * 100).toFixed(1)}%`
      : 'N/A',
    holdoutDays: f.evaluationMetrics?.holdoutDays ?? 'N/A',
    provisional: f.provisional ? 'Provisional' : 'Standard'
  }));

  const chartData = tableData.slice(0, 10).map((r) => ({
    medicine: r.medicineName,
    rfWape: parseFloat(r.wape) || 0,
    baselineWape: parseFloat(r.baselineWape) || 0
  }));

  const headers = [
    { key: 'generatedAt', label: 'Generated' },
    { key: 'medicineCode', label: 'Medicine Code' },
    { key: 'medicineName', label: 'Medicine Name' },
    { key: 'modelName', label: 'Model' },
    { key: 'modelVersion', label: 'Version' },
    { key: 'horizonDays', label: 'Horizon (Days)' },
    { key: 'mae', label: 'MAE' },
    { key: 'rmse', label: 'RMSE' },
    { key: 'wape', label: 'WAPE' },
    { key: 'baselineWape', label: 'Baseline WAPE' },
    { key: 'holdoutDays', label: 'Holdout' },
    { key: 'provisional', label: 'Status' }
  ];

  return {
    title: 'Forecast Performance',
    explanation: 'Backtest accuracy and comparative evaluation metrics (Random Forest vs Moving Average baseline) from saved forecast runs.',
    chartData,
    tableData,
    headers,
    totalForecasts: forecasts.length
  };
}

/**
 * 9. Reorder Recommendations Report
 */
export async function getReordersReport({ from, to, medicineId }) {
  const filter = {};
  if (from || to) {
    filter.generatedAt = {};
    if (from) filter.generatedAt.$gte = new Date(from);
    if (to) filter.generatedAt.$lte = new Date(to);
  }
  if (medicineId) {
    filter.medicineId = medicineId;
  }

  const recommendations = await ReorderRecommendation.find(filter)
    .populate('medicineId', 'name medicineCode')
    .populate('preferredSupplierId', 'name')
    .sort({ generatedAt: -1 });

  const tableData = recommendations.map((r) => ({
    generatedAt: r.generatedAt ? new Date(r.generatedAt).toISOString().split('T')[0] : '',
    medicineCode: r.medicineId?.medicineCode || 'N/A',
    medicineName: r.medicineId?.name || 'Unknown',
    suggestedQuantity: r.suggestedQuantity,
    adjustedQuantity: r.adjustedQuantity ?? 'None',
    status: r.status.toUpperCase(),
    supplierName: r.preferredSupplierId?.name || 'N/A',
    estimatedCost: r.estimatedCost !== null && r.estimatedCost !== undefined ? `$${r.estimatedCost.toFixed(2)}` : 'Cost unavailable',
    reason: r.reason
  }));

  const chartMap = {};
  recommendations.forEach((r) => {
    chartMap[r.status] = (chartMap[r.status] || 0) + 1;
  });
  const chartData = Object.keys(chartMap).map((st) => ({ status: st, count: chartMap[st] }));

  const headers = [
    { key: 'generatedAt', label: 'Date' },
    { key: 'medicineCode', label: 'Medicine Code' },
    { key: 'medicineName', label: 'Medicine Name' },
    { key: 'suggestedQuantity', label: 'Suggested Qty' },
    { key: 'adjustedQuantity', label: 'Adjusted Qty' },
    { key: 'status', label: 'Status' },
    { key: 'supplierName', label: 'Preferred Supplier' },
    { key: 'estimatedCost', label: 'Estimated Cost' },
    { key: 'reason', label: 'Reason' }
  ];

  return {
    title: 'Reorder Recommendations',
    explanation: 'Log of algorithmic reorder recommendations, suggested quantities, approval decisions, and linked purchase orders.',
    chartData,
    tableData,
    headers,
    totalRecommendations: recommendations.length
  };
}
