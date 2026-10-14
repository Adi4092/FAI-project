import { AuditLog } from '../models/AuditLog.js';
import { logger } from '../config/logger.js';

export async function logAudit({
  actorId = null,
  action,
  entityType,
  entityId,
  beforeState = null,
  afterState = null,
  reason = '',
  ip = '',
  session = null
}) {
  try {
    const doc = new AuditLog({
      actorId,
      action,
      entityType,
      entityId: String(entityId),
      beforeState,
      afterState,
      reason,
      ip
    });

    await doc.save({ session });
    return doc;
  } catch (error) {
    logger.error('Failed to write audit log:', error);
    // Don't crash main transaction on audit log write failure unless strictly required
  }
}
