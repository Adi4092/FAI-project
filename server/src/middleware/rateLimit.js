import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isTest ? 10000 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later.'));
  }
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.isTest ? 1000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const email = req.body?.email ? req.body.email.toLowerCase().trim() : '';
    return `${ip}_${email}`;
  },
  handler: (req, res, next) => {
    next(
      new ApiError(
        429,
        'RATE_LIMIT_EXCEEDED',
        'Too many login attempts. Please try again in 15 minutes.'
      )
    );
  }
});
