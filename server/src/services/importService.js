import { v4 as uuidv4 } from 'uuid';
import { Medicine } from '../models/Medicine.js';
import { Batch } from '../models/Batch.js';
import { Supplier } from '../models/Supplier.js';
import { StockMovement } from '../models/StockMovement.js';
import { DailyUsage } from '../models/DailyUsage.js';
import { ApiError } from '../utils/ApiError.js';
import { logAudit } from './auditService.js';

// In-memory preview cache for staged sessions
const importSessions = new Map();

/**
 * Parses simple CSV string into headers and rows
 */
export function parseCsv(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    throw ApiError.badRequest('Empty or invalid CSV content.');
  }

  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw ApiError.badRequest('CSV must have at least a header row and one data row.');
  }

  // Parse header
  const headers = lines[0].split(',').map((h) => h.replace(/^["']|["']$/g, '').trim());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    // Regex to handle quoted CSV fields containing commas
    const pattern = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^",]*))/g;
    const values = [];
    let match;
    while ((match = pattern.exec(lines[i])) !== null) {
      if (match.index === pattern.lastIndex) {
        pattern.lastIndex++;
      }
      let val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
      values.push(val ? val.trim() : '');
    }

    if (values.length > headers.length) {
      values.length = headers.length;
    }
    while (values.length < headers.length) {
      values.push('');
    }

    const rowObj = {};
    headers.forEach((h, idx) => {
      rowObj[h] = values[idx] || '';
    });
    rows.push({ rowNumber: i + 1, raw: rowObj });
  }

  return { headers, rows };
}

/**
 * Validates ISO date format YYYY-MM-DD and calendar validity
 */
function isValidIsoDate(str) {
  if (!str || typeof str !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(str)) return false;
  const d = new Date(str + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

/**
 * Previews and validates the entire CSV before any database change
 */
export async function previewImport({ type, csvData, columnMapping = {} }) {
  const allowedTypes = ['medicines', 'batches', 'daily_usage'];
  if (!allowedTypes.includes(type)) {
    throw ApiError.badRequest(`Invalid import type '${type}'. Allowed: ${allowedTypes.join(', ')}`);
  }

  // Enforce max file size: 5MB
  if (csvData.length > 5 * 1024 * 1024) {
    throw ApiError.badRequest('File size exceeds 5MB limit.');
  }

  const { headers, rows } = parseCsv(csvData);

  // Check required columns by type
  const requiredColumns = {
    medicines: ['medicineCode', 'name', 'category', 'unit', 'reorderLevel'],
    batches: ['medicineCode', 'batchNumber', 'manufacturingDate', 'expiryDate', 'quantity'],
    daily_usage: ['medicineCode', 'date', 'unitsDispensed']
  };

  const expected = requiredColumns[type];
  const missingCols = expected.filter((col) => {
    const mapped = columnMapping[col] || col;
    return !headers.includes(mapped);
  });

  if (missingCols.length > 0) {
    throw ApiError.badRequest(`Missing required columns for ${type}: ${missingCols.join(', ')}`);
  }

  // Pre-load all medicine codes for validation
  const existingMedicines = await Medicine.find().select('medicineCode _id');
  const medicineCodeMap = new Map(existingMedicines.map((m) => [m.medicineCode.toUpperCase(), m._id]));

  const previewRows = [];
  const validDataRows = [];
  const seenKeys = new Set();

  for (const { rowNumber, raw } of rows) {
    // Apply column mapping
    const mapped = {};
    for (const [targetKey, sourceKey] of Object.entries(columnMapping)) {
      mapped[targetKey] = raw[sourceKey] ?? raw[targetKey] ?? '';
    }
    // Also copy direct matches
    for (const k of Object.keys(raw)) {
      if (!mapped[k]) mapped[k] = raw[k];
    }

    const errors = [];

    if (type === 'medicines') {
      const code = (mapped.medicineCode || '').trim().toUpperCase();
      if (!code) {
        errors.push('medicineCode is required');
      } else if (seenKeys.has(code)) {
        errors.push(`Duplicate medicineCode '${code}' within file`);
      } else if (medicineCodeMap.has(code)) {
        // Warning or error for duplicate in DB
        errors.push(`Medicine with code '${code}' already exists in database`);
      }
      seenKeys.add(code);

      if (!mapped.name?.trim()) errors.push('name is required');
      if (!mapped.category?.trim()) errors.push('category is required');
      if (!mapped.unit?.trim()) errors.push('unit is required');

      const reorderLevel = Number(mapped.reorderLevel);
      if (isNaN(reorderLevel) || reorderLevel < 0 || !Number.isInteger(reorderLevel)) {
        errors.push('reorderLevel must be a non-negative integer');
      }

      if (mapped.safetyStock !== undefined && mapped.safetyStock !== '') {
        const safety = Number(mapped.safetyStock);
        if (isNaN(safety) || safety < 0 || !Number.isInteger(safety)) {
          errors.push('safetyStock must be a non-negative integer');
        }
      }

      const isValid = errors.length === 0;
      const parsedData = {
        medicineCode: code,
        name: mapped.name?.trim(),
        category: mapped.category?.trim(),
        unit: mapped.unit?.trim(),
        description: mapped.description?.trim() || '',
        reorderLevel: isNaN(reorderLevel) ? 0 : reorderLevel,
        safetyStock: Number(mapped.safetyStock) || 0,
        isActive: mapped.isActive === 'false' ? false : true
      };

      previewRows.push({ rowNumber, data: parsedData, isValid, errors });
      if (isValid) validDataRows.push(parsedData);

    } else if (type === 'batches') {
      const code = (mapped.medicineCode || '').trim().toUpperCase();
      if (!code) {
        errors.push('medicineCode is required');
      } else if (!medicineCodeMap.has(code)) {
        errors.push(`Unknown medicine code '${code}' (does not exist in catalogue)`);
      }

      const batchNumber = (mapped.batchNumber || '').trim();
      if (!batchNumber) {
        errors.push('batchNumber is required');
      }

      if (!isValidIsoDate(mapped.manufacturingDate)) {
        errors.push(`Invalid manufacturingDate '${mapped.manufacturingDate}' (must be YYYY-MM-DD)`);
      }
      if (!isValidIsoDate(mapped.expiryDate)) {
        errors.push(`Invalid expiryDate '${mapped.expiryDate}' (must be YYYY-MM-DD)`);
      }
      if (isValidIsoDate(mapped.manufacturingDate) && isValidIsoDate(mapped.expiryDate)) {
        if (new Date(mapped.expiryDate) <= new Date(mapped.manufacturingDate)) {
          errors.push('expiryDate must be after manufacturingDate');
        }
      }

      const qty = Number(mapped.quantity);
      if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
        errors.push('quantity must be a positive integer (> 0)');
      }

      let cost = null;
      if (mapped.purchaseCostPerUnit !== undefined && mapped.purchaseCostPerUnit !== '') {
        cost = Number(mapped.purchaseCostPerUnit);
        if (isNaN(cost) || cost < 0) {
          errors.push('purchaseCostPerUnit must be a non-negative number');
        }
      }

      const dedupe = `${code}:${batchNumber}`;
      if (seenKeys.has(dedupe)) {
        errors.push(`Duplicate batchNumber '${batchNumber}' for medicine '${code}' in file`);
      }
      seenKeys.add(dedupe);

      const isValid = errors.length === 0;
      const parsedData = {
        medicineCode: code,
        medicineId: medicineCodeMap.get(code),
        supplierName: mapped.supplierName?.trim() || 'General Supplier',
        batchNumber,
        manufacturingDate: mapped.manufacturingDate,
        expiryDate: mapped.expiryDate,
        quantity: isNaN(qty) ? 0 : qty,
        purchaseCostPerUnit: isNaN(cost) ? null : cost,
        receivedAt: isValidIsoDate(mapped.receivedAt) ? mapped.receivedAt : new Date().toISOString().slice(0, 10)
      };

      previewRows.push({ rowNumber, data: parsedData, isValid, errors });
      if (isValid) validDataRows.push(parsedData);

    } else if (type === 'daily_usage') {
      const code = (mapped.medicineCode || '').trim().toUpperCase();
      if (!code) {
        errors.push('medicineCode is required');
      } else if (!medicineCodeMap.has(code)) {
        errors.push(`Unknown medicine code '${code}' (does not exist in catalogue)`);
      }

      if (!isValidIsoDate(mapped.date)) {
        errors.push(`Invalid date '${mapped.date}' (must be YYYY-MM-DD)`);
      }

      const dispensed = Number(mapped.unitsDispensed);
      if (isNaN(dispensed) || dispensed < 0 || !Number.isInteger(dispensed)) {
        errors.push('unitsDispensed must be a non-negative integer (>= 0)');
      }

      const dedupe = `${code}:${mapped.date}`;
      if (seenKeys.has(dedupe)) {
        errors.push(`Duplicate entry for medicine '${code}' on date '${mapped.date}' in file`);
      }
      seenKeys.add(dedupe);

      const isValid = errors.length === 0;
      const parsedData = {
        medicineCode: code,
        medicineId: medicineCodeMap.get(code),
        date: mapped.date,
        unitsDispensed: isNaN(dispensed) ? 0 : dispensed,
        stockoutObserved: mapped.stockoutObserved === 'true' || mapped.stockoutObserved === true
      };

      previewRows.push({ rowNumber, data: parsedData, isValid, errors });
      if (isValid) validDataRows.push(parsedData);
    }
  }

  const importId = uuidv4();
  importSessions.set(importId, {
    type,
    validRows: validDataRows,
    createdAt: Date.now()
  });

  return {
    importId,
    type,
    totalRows: rows.length,
    acceptedCount: validDataRows.length,
    rejectedCount: rows.length - validDataRows.length,
    hasCriticalErrors: validDataRows.length === 0,
    previewRows,
    validRows: validDataRows,
    summary: {
      accepted: validDataRows.length,
      rejected: rows.length - validDataRows.length
    }
  };
}

/**
 * Commits a validated CSV preview session
 */
export async function commitImport({ importId, type, validRows }, userId) {
  let itemsToCommit = validRows;
  let targetType = type;

  if (importId && importSessions.has(importId)) {
    const session = importSessions.get(importId);
    itemsToCommit = session.validRows;
    targetType = session.type;
    importSessions.delete(importId);
  }

  if (!itemsToCommit || itemsToCommit.length === 0) {
    throw ApiError.badRequest('No valid rows available to commit.');
  }

  let accepted = 0;
  let rejected = 0;
  let skipped = 0;

  if (targetType === 'medicines') {
    for (const item of itemsToCommit) {
      try {
        await Medicine.create({
          medicineCode: item.medicineCode,
          name: item.name,
          category: item.category,
          unit: item.unit,
          description: item.description,
          reorderLevel: item.reorderLevel,
          safetyStock: item.safetyStock,
          isActive: item.isActive
        });
        accepted++;
      } catch (err) {
        if (err.code === 11000) {
          skipped++;
        } else {
          rejected++;
        }
      }
    }
  } else if (targetType === 'batches') {
    // Cache suppliers
    const supplierCache = new Map();

    for (const item of itemsToCommit) {
      try {
        let supplierId = supplierCache.get(item.supplierName);
        if (!supplierId) {
          let supp = await Supplier.findOne({ name: item.supplierName });
          if (!supp) {
            supp = await Supplier.create({
              name: item.supplierName,
              contactPerson: 'Logistics Desk',
              email: `contact@${item.supplierName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
              phone: '+1 555-0100',
              address: 'Medical Supplies Distribution Hub',
              defaultLeadTimeDays: 7
            });
          }
          supplierId = supp._id;
          supplierCache.set(item.supplierName, supplierId);
        }

        // Create Batch
        const batch = await Batch.create({
          medicineId: item.medicineId,
          supplierId,
          batchNumber: item.batchNumber,
          manufacturingDate: new Date(item.manufacturingDate),
          expiryDate: new Date(item.expiryDate),
          initialQuantity: item.quantity,
          currentQuantity: item.quantity,
          purchaseCostPerUnit: item.purchaseCostPerUnit,
          receivedAt: new Date(item.receivedAt),
          status: 'active'
        });

        // Create Stock Movement to ensure ledger reconciles
        await StockMovement.create({
          batchId: batch._id,
          medicineId: item.medicineId,
          movementType: 'receipt',
          quantityChange: item.quantity,
          balanceBefore: 0,
          balanceAfter: item.quantity,
          referenceType: 'import',
          referenceId: batch._id,
          reason: `Bulk CSV Import: Batch ${item.batchNumber}`,
          performedBy: userId,
          timestamp: new Date()
        });

        accepted++;
      } catch (err) {
        rejected++;
      }
    }
  } else if (targetType === 'daily_usage') {
    for (const item of itemsToCommit) {
      try {
        await DailyUsage.findOneAndUpdate(
          { medicineId: item.medicineId, date: item.date },
          {
            $set: {
              unitsDispensed: item.unitsDispensed,
              stockoutObserved: item.stockoutObserved,
              dataSource: 'import'
            }
          },
          { upsert: true, new: true }
        );
        accepted++;
      } catch (err) {
        rejected++;
      }
    }
  }

  await logAudit({
    actorId: userId,
    action: 'CSV_IMPORT_COMMIT',
    entityType: 'ImportSession',
    entityId: userId,
    afterState: { type: targetType, accepted, rejected, skipped },
    reason: `Committed CSV import of type ${targetType}`
  });

  return {
    accepted,
    rejected,
    skipped,
    message: `Successfully imported ${accepted} ${targetType} records.`
  };
}
