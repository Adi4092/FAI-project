import { z } from 'zod';

export const createBatchSchema = {
  body: z.object({
    medicineId: z.string().min(1, 'Medicine ID is required.'),
    supplierId: z.string().min(1, 'Supplier ID is required.'),
    batchNumber: z.string().min(1, 'Batch number is required.').trim().toUpperCase(),
    manufacturingDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid manufacturing date format.'
    }),
    expiryDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid expiry date format.'
    }),
    initialQuantity: z.number().int().min(1, 'Initial quantity must be at least 1.'),
    purchaseCostPerUnit: z.number().min(0, 'Purchase cost per unit must be non-negative.').default(0),
    receivedAt: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid received date.' })
      .optional(),
    purchaseOrderId: z.string().nullable().optional()
  })
};

export const updateBatchSchema = {
  body: z.object({
    supplierId: z.string().min(1).optional(),
    manufacturingDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid manufacturing date format.' })
      .optional(),
    expiryDate: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid expiry date format.' })
      .optional(),
    purchaseCostPerUnit: z.number().min(0).optional()
  })
};
