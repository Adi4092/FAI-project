import { z } from 'zod';

export const createSupplierSchema = {
  body: z.object({
    name: z.string().min(1, 'Supplier name is required.').trim(),
    contactPerson: z.string().optional().default(''),
    email: z.string().email('Invalid email address.').optional().or(z.literal('')),
    phone: z.string().optional().default(''),
    address: z.string().optional().default(''),
    defaultLeadTimeDays: z.number().int().min(0, 'Lead time must be a non-negative integer.').default(7),
    isActive: z.boolean().optional().default(true)
  })
};

export const updateSupplierSchema = {
  body: z.object({
    name: z.string().min(1).trim().optional(),
    contactPerson: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    address: z.string().optional(),
    defaultLeadTimeDays: z.number().int().min(0).optional()
  })
};

export const updateSupplierStatusSchema = {
  body: z.object({
    isActive: z.boolean({ required_error: 'isActive flag is required.' })
  })
};
