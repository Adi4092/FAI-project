import { Batch } from '../models/Batch.js';
import { ApiError } from '../utils/ApiError.js';
import { getStartOfToday } from '../utils/dates.js';

export async function allocateFEFO(medicineId, requestedQuantity, allowPartial = false) {
  if (requestedQuantity <= 0) {
    throw ApiError.badRequest('Requested quantity must be greater than zero.');
  }

  const startOfToday = getStartOfToday();

  // Load usable batches sorted by expiryDate ASC, then receivedAt ASC
  const usableBatches = await Batch.find({
    medicineId,
    status: 'active',
    currentQuantity: { $gt: 0 },
    expiryDate: { $gte: startOfToday }
  }).sort({ expiryDate: 1, receivedAt: 1 });

  let remaining = requestedQuantity;
  const allocations = [];

  for (const batch of usableBatches) {
    if (remaining <= 0) break;

    const take = Math.min(batch.currentQuantity, remaining);
    allocations.push({
      batchId: batch._id.toString(),
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      currentQuantity: batch.currentQuantity,
      allocatedQuantity: take,
      balanceAfter: batch.currentQuantity - take
    });

    remaining -= take;
  }

  const totalAllocated = requestedQuantity - remaining;

  if (remaining > 0 && !allowPartial) {
    throw new ApiError(
      409,
      'INSUFFICIENT_STOCK',
      `Insufficient usable stock. Requested: ${requestedQuantity}, Available: ${totalAllocated}`
    );
  }

  return {
    sufficientStock: remaining === 0,
    requestedQuantity,
    totalAllocated,
    allocations
  };
}
