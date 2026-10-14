import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { successResponse } from '../utils/apiResponse.js';
import { env } from '../config/env.js';
import { logAudit } from '../services/auditService.js';
import { getPaginationParams, buildPaginationMeta } from '../utils/pagination.js';

export async function getUsers(req, res, next) {
  try {
    const { page, limit, skip } = getPaginationParams(req.query);
    const filter = {};

    if (req.query.role) {
      filter.role = req.query.role;
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit);

    return successResponse(
      res,
      users.map((u) => u.toJSON()),
      200,
      buildPaginationMeta(total, page, limit)
    );
  } catch (error) {
    next(error);
  }
}

export async function createUser(req, res, next) {
  try {
    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      throw ApiError.conflict('A user with this email address already exists.');
    }

    const salt = await bcrypt.genSalt(env.BCRYPT_COST);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role: role || 'staff',
      isActive: true
    });

    await logAudit({
      actorId: req.user.id,
      action: 'USER_CREATE',
      entityType: 'User',
      entityId: user._id,
      afterState: user.toJSON(),
      reason: 'Admin created user',
      ip: req.ip
    });

    return successResponse(res, user.toJSON(), 201);
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw ApiError.notFound('User not found.');
    }

    if (req.body.name) user.name = req.body.name.trim();
    await user.save();

    return successResponse(res, user.toJSON());
  } catch (error) {
    next(error);
  }
}

export async function updateUserRole(req, res, next) {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      throw ApiError.notFound('User not found.');
    }

    // Guard: Prevent demoting the last active admin
    if (user.role === 'admin' && role !== 'admin') {
      const activeAdminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (activeAdminCount <= 1) {
        throw ApiError.badRequest('Cannot demote the last active system administrator.');
      }
    }

    const beforeRole = user.role;
    user.role = role;
    await user.save();

    await logAudit({
      actorId: req.user.id,
      action: 'USER_ROLE_CHANGE',
      entityType: 'User',
      entityId: user._id,
      beforeState: { role: beforeRole },
      afterState: { role },
      reason: `Changed role from ${beforeRole} to ${role}`,
      ip: req.ip
    });

    return successResponse(res, user.toJSON());
  } catch (error) {
    next(error);
  }
}

export async function updateUserStatus(req, res, next) {
  try {
    const { isActive } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      throw ApiError.notFound('User not found.');
    }

    // Guard: Prevent deactivating the last active admin
    if (user.role === 'admin' && isActive === false) {
      const activeAdminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (activeAdminCount <= 1) {
        throw ApiError.badRequest('Cannot deactivate the last active system administrator.');
      }
    }

    user.isActive = isActive;
    await user.save();

    await logAudit({
      actorId: req.user.id,
      action: isActive ? 'USER_ACTIVATE' : 'USER_DEACTIVATE',
      entityType: 'User',
      entityId: user._id,
      afterState: { isActive },
      reason: `Set user isActive=${isActive}`,
      ip: req.ip
    });

    return successResponse(res, user.toJSON());
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      throw ApiError.badRequest('New password must be at least 6 characters.');
    }

    const user = await User.findById(req.params.id).select('+passwordHash');
    if (!user) {
      throw ApiError.notFound('User not found.');
    }

    const salt = await bcrypt.genSalt(env.BCRYPT_COST);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();

    await logAudit({
      actorId: req.user.id,
      action: 'USER_PASSWORD_RESET',
      entityType: 'User',
      entityId: user._id,
      reason: 'Admin triggered password reset',
      ip: req.ip
    });

    return successResponse(res, { message: 'Password reset successfully.' });
  } catch (error) {
    next(error);
  }
}
