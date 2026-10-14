import crypto from 'crypto';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

export function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function setCsrfCookie(res, token = generateCsrfToken()) {
  res.cookie('csrf_token', token, {
    httpOnly: false, // Must be readable by client JavaScript to send back in X-CSRF-Token header
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/'
  });
  return token;
}

export function csrfProtection(req, res, next) {
  // Safe methods do not require CSRF token
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF validation in test mode if explicitly disabled, or for initial auth endpoints
  if (env.isTest && req.headers['x-skip-csrf'] === 'true') {
    return next();
  }

  const bypassPaths = [
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/csrf'
  ];

  if (bypassPaths.includes(req.path)) {
    return next();
  }

  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(
      new ApiError(
        403,
        'CSRF_ERROR',
        'CSRF validation failed. Missing or mismatched double-submit token.'
      )
    );
  }

  next();
}
