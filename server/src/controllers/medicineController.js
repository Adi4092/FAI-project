import { Medicine } from '../models/Medicine.js';
import { Batch } from '../models/Batch.js';
import { MedicineSupplier } from '../models/MedicineSupplier.js';
import { ApiError } from '../utils/ApiError.js';
import { successResponse } from '../utils/apiResponse.js';
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination.js';
import { getStartOfToday } from '../utils/dates.js';
import { logAudit } from '../services/auditService.js';

export async function getMedicines(req, res, next) {
  try {
    const { page, limit, skip, sort } = getPaginationParams(req.query);
    const filter = {};

    // Search query
    if (req.query.q) {
      const q = req.query.q.trim();
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { medicineCode: { $regex: q, $options: 'i' } }
      ];
    }

    // Category filter
    if (req.query.category && req.query.category !== 'all') {
      filter.category = req.query.category;
    }

    // Status filter
    if (req.query.status === 'inactive') {
      filter.isActive = false;
    } else if (req.query.status === 'all') {
      // no isActive filter
    } else {
      filter.isActive = true; // default active
    }

    const total = await Medicine.countDocuments(filter);
    const medicines = await Medicine.find(filter).sort(sort).skip(skip).limit(limit);

    const startOfToday = getStartOfToday();

    // Enrich each medicine with usableStock, expiredStock, and totalBatches
    const enriched = await Promise.all(
      medicines.map(async (med) => {
        const batches = await Batch.find({ medicineId: med._id });
        const usableStock = batches
          .filter((b) => b.status === 'active' && b.currentQuantity > 0 && b.expiryDate >= startOfToday)
          .reduce((sum, b) => sum + b.currentQuantity, 0);

        const expiredStock = batches
          .filter((b) => b.status === 'expired' || (b.expiryDate < startOfToday && b.currentQuantity > 0))
          .reduce((sum, b) => sum + b.currentQuantity, 0);

        const doc = med.toJSON();
        doc.usableStock = usableStock;
        doc.expiredStock = expiredStock;
        doc.totalBatches = batches.length;
        return doc;
      })
    );

    let finalData = enriched;
    if (req.query.lowStock === 'true') {
      finalData = enriched.filter((m) => m.usableStock <= m.reorderLevel);
    }

    return successResponse(res, finalData, 200, buildPaginationMeta(total, page, limit));
  } catch (error) {
    next(error);
  }
}

export async function createMedicine(req, res, next) {
  try {
    const { medicineCode, name, category, unit, description, reorderLevel, safetyStock, isActive } = req.body;

    const existing = await Medicine.findOne({ medicineCode: medicineCode.trim().toUpperCase() });
    if (existing) {
      throw ApiError.conflict(`Medicine code '${medicineCode}' is already registered.`, 'DUPLICATE_RESOURCE');
    }

    const medicine = await Medicine.create({
      medicineCode: medicineCode.trim().toUpperCase(),
      name: name.trim(),
      category: category.trim(),
      unit: unit.trim(),
      description: description || '',
      reorderLevel,
      safetyStock: safetyStock || 0,
      isActive: isActive !== undefined ? isActive : true
    });

    await logAudit({
      actorId: req.user.id,
      action: 'MEDICINE_CREATE',
      entityType: 'Medicine',
      entityId: medicine._id,
      afterState: medicine.toJSON(),
      reason: 'Created new medicine record',
      ip: req.ip
    });

    return successResponse(res, medicine.toJSON(), 201);
  } catch (error) {
    next(error);
  }
}

export async function getMedicineById(req, res, next) {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      throw ApiError.notFound('Medicine not found.');
    }

    const startOfToday = getStartOfToday();
    const batches = await Batch.find({ medicineId: medicine._id });

    const usableStock = batches
      .filter((b) => b.status === 'active' && b.currentQuantity > 0 && b.expiryDate >= startOfToday)
      .reduce((sum, b) => sum + b.currentQuantity, 0);

    const expiredStock = batches
      .filter((b) => b.status === 'expired' || (b.expiryDate < startOfToday && b.currentQuantity > 0))
      .reduce((sum, b) => sum + b.currentQuantity, 0);

    const preferredLink = await MedicineSupplier.findOne({
      medicineId: medicine._id,
      isPreferred: true
    }).populate('supplierId');

    const result = medicine.toJSON();
    result.usableStock = usableStock;
    result.expiredStock = expiredStock;
    result.totalBatches = batches.length;
    result.preferredSupplier = preferredLink ? preferredLink.supplierId : null;

    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

export async function updateMedicine(req, res, next) {
  try {
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      throw ApiError.notFound('Medicine not found.');
    }

    const beforeState = medicine.toJSON();
    const fields = ['name', 'category', 'unit', 'description', 'reorderLevel', 'safetyStock'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        medicine[field] = req.body[field];
      }
    });

    await medicine.save();

    await logAudit({
      actorId: req.user.id,
      action: 'MEDICINE_UPDATE',
      entityType: 'Medicine',
      entityId: medicine._id,
      beforeState,
      afterState: medicine.toJSON(),
      reason: 'Updated medicine details',
      ip: req.ip
    });

    return successResponse(res, medicine.toJSON());
  } catch (error) {
    next(error);
  }
}

export async function updateMedicineStatus(req, res, next) {
  try {
    const { isActive } = req.body;
    const medicine = await Medicine.findById(req.params.id);
    if (!medicine) {
      throw ApiError.notFound('Medicine not found.');
    }

    medicine.isActive = isActive;
    await medicine.save();

    await logAudit({
      actorId: req.user.id,
      action: isActive ? 'MEDICINE_ACTIVATE' : 'MEDICINE_DEACTIVATE',
      entityType: 'Medicine',
      entityId: medicine._id,
      afterState: { isActive },
      reason: `Set medicine isActive=${isActive}`,
      ip: req.ip
    });

    return successResponse(res, medicine.toJSON());
  } catch (error) {
    next(error);
  }
}

export async function getMedicineBatches(req, res, next) {
  try {
    const batches = await Batch.find({ medicineId: req.params.id })
      .populate('supplierId', 'name contactPerson email phone')
      .sort({ expiryDate: 1 });
    return successResponse(res, batches.map((b) => b.toJSON()));
  } catch (error) {
    next(error);
  }
}

export async function getMedicineSuppliers(req, res, next) {
  try {
    const links = await MedicineSupplier.find({ medicineId: req.params.id })
      .populate('supplierId')
      .sort({ isPreferred: -1 });
    return successResponse(res, links.map((l) => l.toJSON()));
  } catch (error) {
    next(error);
  }
}

export async function updateMedicineSuppliers(req, res, next) {
  try {
    const { suppliers } = req.body;
    const medicineId = req.params.id;

    const medicine = await Medicine.findById(medicineId);
    if (!medicine) {
      throw ApiError.notFound('Medicine not found.');
    }

    // Replace all supplier mappings for this medicine
    await MedicineSupplier.deleteMany({ medicineId });

    const created = await Promise.all(
      suppliers.map(async (s) => {
        return MedicineSupplier.create({
          medicineId,
          supplierId: s.supplierId,
          leadTimeDays: s.leadTimeDays,
          minOrderQty: s.minOrderQty,
          unitCost: s.unitCost,
          isPreferred: s.isPreferred
        });
      })
    );

    return successResponse(res, created.map((c) => c.toJSON()));
  } catch (error) {
    next(error);
  }
}
