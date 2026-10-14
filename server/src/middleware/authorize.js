import { ApiError } from '../utils/ApiError.js';

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          'FORBIDDEN',
          `Access restricted: role '${req.user.role}' is not authorized for this resource.`
        )
      );
    }

    next();
  };
}
