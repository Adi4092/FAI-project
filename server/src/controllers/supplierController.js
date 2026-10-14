import { Supplier } from '../models/Supplier.js';
import { Batch } from '../models/Batch.js';
import { ApiError } from '../utils/ApiError.js';
import { successResponse } from '../utils/apiResponse.js';
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination.js';
import { logAudit } from '../services/auditService.js';

export async function getSuppliers(req, res, next) {
  try {
    const { page, limit, skip, sort } = getPaginationParams(req.query);
    const filter = {};

    if (req.query.q) {
      filter.$or = [
        { name: { $regex: req.query.q.trim(), $options: 'i' } },
        { contactPerson: { $regex: req.query.q.trim(), $options: 'i' } }
      ];
    }

    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    const total = await Supplier.countDocuments(filter);
    const suppliers = await Supplier.find(filter).sort(sort).skip(skip).limit(limit);

    return successResponse(
      res,
      suppliers.map((s) => s.toJSON()),
      200,
      buildPaginationMeta(total, page, limit)
    );
  } catch (error) {
    next(error);
  }
}

export async function createSupplier(req, res, next) {
  try {
    const { name, contactPerson, email, phone, address, defaultLeadTimeDays, isActive } = req.body;

    const existing = await Supplier.findOne({ name: name.trim() });
    if (existing) {
      throw ApiError.conflict(`Supplier '${name}' already exists.`, 'DUPLICATE_RESOURCE');
    }

    const supplier = await Supplier.create({
      name: name.trim(),
      contactPerson,
      email,
      phone,
      address,
      defaultLeadTimeDays: defaultLeadTimeDays || 7,
      isActive: isActive !== undefined ? isActive : true
    });

    await logAudit({
      actorId: req.user.id,
      action: 'SUPPLIER_CREATE',
      entityType: 'Supplier',
      entityId: supplier._id,
      afterState: supplier.toJSON(),
      reason: 'Created new supplier record',
      ip: req.ip
    });

    return successResponse(res, supplier.toJSON(), 201);
  } catch (error) {
    next(error);
  }
}

export async function getSupplierById(req, res, next) {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      throw ApiError.notFound('Supplier not found.');
    }

    return successResponse(res, supplier.toJSON());
  } catch (error) {
    next(error);
  }
}

export async function updateSupplier(req, res, next) {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      throw ApiError.notFound('Supplier not found.');
    }

    const beforeState = supplier.toJSON();
    const fields = ['name', 'contactPerson', 'email', 'phone', 'address', 'defaultLeadTimeDays'];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        supplier[f] = req.body[f];
      }
    });

    await supplier.save();

    await logAudit({
      actorId: req.user.id,
      action: 'SUPPLIER_UPDATE',
      entityType: 'Supplier',
      entityId: supplier._id,
      beforeState,
      afterState: supplier.toJSON(),
      reason: 'Updated supplier details',
      ip: req.ip
    });

    return successResponse(res, supplier.toJSON());
  } catch (error) {
    next(error);
  }
}

export async function updateSupplierStatus(req, res, next) {
  try {
    const { isActive } = req.body;
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      throw ApiError.notFound('Supplier not found.');
    }

    supplier.isActive = isActive;
    await supplier.save();

    await logAudit({
      actorId: req.user.id,
      action: isActive ? 'SUPPLIER_ACTIVATE' : 'SUPPLIER_DEACTIVATE',
      entityType: 'Supplier',
      entityId: supplier._id,
      afterState: { isActive },
      reason: `Set supplier isActive=${isActive}`,
      ip: req.ip
    });

    return successResponse(res, supplier.toJSON());
  } catch (error) {
    next(error);
  }
}

export async function getSupplierBatches(req, res, next) {
  try {
    const batches = await Batch.find({ supplierId: req.params.id })
      .populate('medicineId', 'name medicineCode unit')
      .sort({ expiryDate: 1 });
    return successResponse(res, batches.map((b) => b.toJSON()));
  } catch (error) {
    next(error);
  }
}

export async function getSupplierPurchaseOrders(req, res, next) {
  try {
    // Return empty array for Phase 3 (PurchaseOrder lifecycle is full Phase 7)
    return successResponse(res, []);
  } catch (error) {
    next(error);
  }
}
