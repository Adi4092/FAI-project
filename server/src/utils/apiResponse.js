/**
 * Standard API response envelope helpers matching docs/api-contract.md
 */

export function successResponse(res, data, status = 200, meta = null) {
  const payload = {
    success: true,
    data,
    meta,
    error: null
  };
  return res.status(status).json(payload);
}

export function errorResponse(res, code, message, status = 400, details = []) {
  const payload = {
    success: false,
    data: null,
    error: {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {})
    }
  };
  return res.status(status).json(payload);
}
