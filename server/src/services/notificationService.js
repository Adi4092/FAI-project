import { Notification } from '../models/Notification.js';
import { logger } from '../config/logger.js';

export async function createNotification({
  type,
  severity = 'info',
  title,
  message,
  relatedEntityType = null,
  relatedEntityId = null,
  dedupeKey = null
}) {
  try {
    if (dedupeKey) {
      // Check if an unresolved notification already exists
      const existing = await Notification.findOne({ dedupeKey, resolvedAt: null });
      if (existing) {
        return existing;
      }
    }

    const doc = await Notification.create({
      type,
      severity,
      title,
      message,
      relatedEntityType,
      relatedEntityId,
      dedupeKey
    });

    return doc;
  } catch (err) {
    // Duplicate key caught by partial index
    if (err.code === 11000) {
      logger.info(`[notificationService] Deduplicated notification for key: ${dedupeKey}`);
      return await Notification.findOne({ dedupeKey, resolvedAt: null });
    }
    logger.error('[notificationService] Failed to create notification:', err);
    throw err;
  }
}

export async function resolveNotification(dedupeKey) {
  if (!dedupeKey) return null;
  return await Notification.updateMany(
    { dedupeKey, resolvedAt: null },
    { $set: { resolvedAt: new Date() } }
  );
}

export async function getNotifications({ type, severity, isRead, page = 1, limit = 20 }) {
  const query = {};
  if (type) query.type = type;
  if (severity) query.severity = severity;
  if (isRead !== undefined && isRead !== null && isRead !== '') {
    query.isRead = isRead === 'true' || isRead === true;
  }

  const skip = (Math.max(1, page) - 1) * limit;
  const [items, total] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(query)
  ]);

  return {
    items,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
}

export async function markAsRead(notificationId, userId = null) {
  const update = { isRead: true };
  if (userId) {
    update.$addToSet = { readBy: userId };
  }
  return await Notification.findByIdAndUpdate(notificationId, update, { new: true });
}

export async function markAllAsRead(userId = null) {
  const update = { isRead: true };
  if (userId) {
    update.$addToSet = { readBy: userId };
  }
  return await Notification.updateMany({ isRead: false }, update);
}

export async function getUnreadCount() {
  return await Notification.countDocuments({ isRead: false, resolvedAt: null });
}
