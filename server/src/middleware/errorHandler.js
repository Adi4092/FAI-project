import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export function errorHandler(err, req, res, next) {
  logger.error(`Error processing ${req.method} ${req.originalUrl}:`, err);

  // If already an ApiError
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      data: null,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && err.details.length > 0 ? { details: err.details } : {})
      }
    });
  }

  // Handle Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue || {});
    const field = fields[0] || 'field';
    return res.status(409).json({
      success: false,
      data: null,
      error: {
        code: 'DUPLICATE_RESOURCE',
        message: `Duplicate entry for ${field}: '${err.keyValue[field]}'`,
        details: [{ field, message: `${field} must be unique.` }]
      }
    });
  }

  // Handle Mongoose validation error
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message
    }));
    return res.status(400).json({
      success: false,
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Database schema validation failed.',
        details
      }
    });
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Invalid format for field: ${err.path}`,
        details: [{ field: err.path, message: `Invalid identifier format.` }]
      }
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      data: null,
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: 'Invalid session token.'
      }
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      data: null,
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Session token has expired.'
      }
    });
  }

  // Fallback 500 error (clean, no stack leak)
  return res.status(500).json({
    success: false,
    data: null,
    error: {
      code: 'INTERNAL_ERROR',
      message: env.isProduction ? 'An unexpected server error occurred.' : (err.message || 'Internal server error')
    }
  });
}
