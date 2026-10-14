import { z } from 'zod';

export const receiveStockSchema = {
  body: z.object({
    medicineId: z.string().min(1, 'Medicine ID is required.'),
    batchNumber: z.string().min(1, 'Batch number is required.').trim().toUpperCase(),
    supplierId: z.string().min(1, 'Supplier ID is required.'),
    manufacturingDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid manufacturing date format.'
    }),
    expiryDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid expiry date format.'
    }),
    quantity: z.number().int().min(1, 'Quantity received must be at least 1.'),
    purchaseCostPerUnit: z.number().min(0, 'Purchase cost must be non-negative.').default(0),
    purchaseOrderId: z.string().nullable().optional()
  })
};

export const dispenseStockSchema = {
  body: z.object({
    medicineId: z.string().min(1, 'Medicine ID is required.'),
    quantity: z.number().int().min(1, 'Quantity to dispense must be at least 1.'),
    note: z.string().optional().default(''),
    allocations: z
      .array(
        z.object({
          batchId: z.string().min(1, 'Batch ID is required.'),
          quantity: z.number().int().min(1, 'Allocation quantity must be at least 1.')
        })
      )
      .optional()
  })
};

export const returnStockSchema = {
  body: z.object({
    batchId: z.string().min(1, 'Batch ID is required.'),
    quantity: z.number().int().min(1, 'Return quantity must be at least 1.'),
    reason: z.string().min(1, 'A reason is mandatory when returning stock.').trim(),
    referenceDispenseMovementId: z.string().nullable().optional()
  })
};

export const adjustStockSchema = {
  body: z.object({
    batchId: z.string().min(1, 'Batch ID is required.'),
    quantityChange: z.number().int().refine((val) => val !== 0, {
      message: 'Quantity change must be a non-zero integer.'
    }),
    reason: z.string().min(1, 'A reason is mandatory for inventory adjustments.').trim()
  })
};

export const writeOffStockSchema = {
  body: z.object({
    batchId: z.string().min(1, 'Batch ID is required.'),
    reason: z.string().min(1, 'A reason is mandatory for writing off stock.').trim()
  })
};

export const correctMovementSchema = {
  body: z.object({
    reason: z.string().min(1, 'A reason is mandatory for correcting a movement.').trim()
  })
};

export const fefoPreviewSchema = {
  query: z.object({
    medicineId: z.string().min(1, 'Medicine ID is required.'),
    quantity: z.string().regex(/^\d+$/, 'Quantity must be a positive integer.').transform(Number)
  })
};
