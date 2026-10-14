import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { generateCsrfToken, setCsrfCookie } from '../middleware/csrf.js';
import { logAudit } from './auditService.js';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL }
  );
}

export function generateRefreshTokenString() {
  return crypto.randomBytes(40).toString('hex');
}

export async function createRefreshTokenRecord(userId, userAgent = '', ip = '') {
  const tokenString = generateRefreshTokenString();
  const tokenHash = hashToken(tokenString);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    userId,
    tokenHash,
    expiresAt,
    userAgent,
    ip
  });

  return tokenString;
}

export function attachAuthCookies(res, accessToken, refreshToken) {
  const accessExpiry = 15 * 60 * 1000; // 15 mins
  const refreshExpiry = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    maxAge: accessExpiry,
    path: '/'
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    maxAge: refreshExpiry,
    path: '/'
  });

  const csrfToken = setCsrfCookie(res);
  return csrfToken;
}

export function clearAuthCookies(res) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
  res.clearCookie('csrf_token', { path: '/' });
}

export async function loginUser(email, password, userAgent = '', ip = '') {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+passwordHash');
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw ApiError.unauthorized('Invalid email or password.');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('This user account has been deactivated.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = generateAccessToken(user);
  const refreshToken = await createRefreshTokenRecord(user._id, userAgent, ip);

  await logAudit({
    actorId: user._id,
    action: 'USER_LOGIN',
    entityType: 'User',
    entityId: user._id,
    ip
  });

  return {
    user: user.toJSON(),
    accessToken,
    refreshToken
  };
}

export async function rotateRefreshToken(oldTokenString, userAgent = '', ip = '') {
  if (!oldTokenString) {
    throw ApiError.unauthorized('Refresh token is required.');
  }

  const oldHash = hashToken(oldTokenString);
  const tokenDoc = await RefreshToken.findOne({ tokenHash: oldHash });

  if (!tokenDoc) {
    throw ApiError.unauthorized('Invalid refresh token.');
  }

  if (tokenDoc.revokedAt) {
    // Reuse detected! Invalidate all refresh tokens for this user for security
    await RefreshToken.updateMany({ userId: tokenDoc.userId }, { revokedAt: new Date() });
    throw ApiError.unauthorized('Refresh token was revoked or reused.');
  }

  if (new Date() > tokenDoc.expiresAt) {
    throw new ApiError(401, 'TOKEN_EXPIRED', 'Refresh token has expired.');
  }

  const user = await User.findById(tokenDoc.userId);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('User inactive or deleted.');
  }

  // Revoke the old token
  tokenDoc.revokedAt = new Date();
  await tokenDoc.save();

  // Create new refresh token and access token
  const newRefreshToken = await createRefreshTokenRecord(user._id, userAgent, ip);
  const newAccessToken = generateAccessToken(user);

  return {
    user: user.toJSON(),
    accessToken: newAccessToken,
    refreshToken: newRefreshToken
  };
}

export async function logoutUser(refreshTokenString) {
  if (refreshTokenString) {
    const oldHash = hashToken(refreshTokenString);
    await RefreshToken.updateOne({ tokenHash: oldHash }, { revokedAt: new Date() });
  }
}
