import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/User.js';

export async function authenticate(req, res, next) {
  try {
    let token = null;

    // Check cookie first
    if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw ApiError.unauthorized('Authentication token missing.');
    }

    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);

    // Verify user is still active in database
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      throw ApiError.unauthorized('User associated with this token no longer exists.');
    }

    if (!user.isActive) {
      throw ApiError.forbidden('This user account has been deactivated.');
    }

    req.user = {
      id: user._id.toString(),
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'TOKEN_EXPIRED', 'Session token has expired.'));
    }
    if (error.name === 'JsonWebTokenError') {
      return next(new ApiError(401, 'AUTHENTICATION_FAILED', 'Invalid session token.'));
    }
    next(error);
  }
}
