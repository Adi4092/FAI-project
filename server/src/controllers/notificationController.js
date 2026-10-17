import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount
} from '../services/notificationService.js';
import { runAlertJob } from '../jobs/alertJob.js';
import { successResponse } from '../utils/apiResponse.js';

export async function list(req, res, next) {
  try {
    const { type, severity, isRead, page, limit } = req.query;
    const { items, meta } = await getNotifications({
      type,
      severity,
      isRead,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20
    });
    return successResponse(res, items, 200, meta);
  } catch (error) {
    next(error);
  }
}

export async function readOne(req, res, next) {
  try {
    const updated = await markAsRead(req.params.id, req.user?.id);
    return successResponse(res, updated);
  } catch (error) {
    next(error);
  }
}

export async function readAll(req, res, next) {
  try {
    await markAllAsRead(req.user?.id);
    return successResponse(res, { message: 'All notifications marked as read.' });
  } catch (error) {
    next(error);
  }
}

export async function unreadCount(req, res, next) {
  try {
    const count = await getUnreadCount(req.user?.id);
    return successResponse(res, { unreadCount: count });
  } catch (error) {
    next(error);
  }
}

export async function triggerAlertJob(req, res, next) {
  try {
    const result = await runAlertJob();
    return successResponse(res, {
      message: 'Alert evaluation completed.',
      result
    });
  } catch (error) {
    next(error);
  }
}
