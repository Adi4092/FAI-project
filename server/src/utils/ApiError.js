export class ApiError extends Error {
  constructor(statusCode, code, message, details = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, code = 'VALIDATION_ERROR', details = []) {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(message = 'Authentication required.', code = 'AUTHENTICATION_FAILED') {
    return new ApiError(401, code, message);
  }

  static forbidden(message = 'Access forbidden.', code = 'FORBIDDEN') {
    return new ApiError(403, code, message);
  }

  static notFound(message = 'Resource not found.', code = 'NOT_FOUND') {
    return new ApiError(404, code, message);
  }

  static conflict(message, code = 'DUPLICATE_RESOURCE') {
    return new ApiError(409, code, message);
  }

  static unprocessable(message, code = 'VALIDATION_ERROR', details = []) {
    return new ApiError(422, code, message, details);
  }

  static tooManyRequests(message = 'Too many requests.', code = 'RATE_LIMIT_EXCEEDED') {
    return new ApiError(429, code, message);
  }

  static internal(message = 'Internal server error.', code = 'INTERNAL_ERROR') {
    return new ApiError(500, code, message);
  }

  static serviceUnavailable(message = 'Service unavailable.', code = 'AI_SERVICE_UNAVAILABLE') {
    return new ApiError(503, code, message);
  }
}
