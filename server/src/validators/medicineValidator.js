import { z } from 'zod';

export const createMedicineSchema = {
  body: z.object({
    medicineCode: z.string().min(1, 'Medicine code is required.').trim().toUpperCase(),
    name: z.string().min(1, 'Medicine name is required.').trim(),
    category: z.string().min(1, 'Category is required.').trim(),
    unit: z.string().min(1, 'Unit is required.').trim(),
    description: z.string().optional().default(''),
    reorderLevel: z.number().int().min(0, 'Reorder level must be a non-negative integer.'),
    safetyStock: z.number().int().min(0, 'Safety stock must be a non-negative integer.').optional().default(0),
    isActive: z.boolean().optional().default(true)
  })
};

export const updateMedicineSchema = {
  body: z.object({
    name: z.string().min(1, 'Medicine name cannot be empty.').trim().optional(),
    category: z.string().min(1, 'Category cannot be empty.').trim().optional(),
    unit: z.string().min(1, 'Unit cannot be empty.').trim().optional(),
    description: z.string().optional(),
    reorderLevel: z.number().int().min(0, 'Reorder level must be a non-negative integer.').optional(),
    safetyStock: z.number().int().min(0, 'Safety stock must be a non-negative integer.').optional()
  })
};

export const updateMedicineStatusSchema = {
  body: z.object({
    isActive: z.boolean({ required_error: 'isActive flag is required.' })
  })
};

export const updateMedicineSuppliersSchema = {
  body: z.object({
    suppliers: z.array(
      z.object({
        supplierId: z.string().min(1, 'Supplier ID is required.'),
        leadTimeDays: z.number().int().min(0, 'Lead time must be non-negative.').default(7),
        minOrderQty: z.number().int().min(1, 'MOQ must be at least 1.').default(1),
        unitCost: z.number().min(0, 'Unit cost must be non-negative.').default(0),
        isPreferred: z.boolean().default(false)
      })
    )
  })
};
