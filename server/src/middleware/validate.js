import { ApiError } from '../utils/ApiError.js';

export function validate(schema) {
  return async (req, res, next) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      if (error.errors) {
        const details = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message
        }));
        return next(
          new ApiError(
            400,
            'VALIDATION_ERROR',
            'Validation failed for one or more fields.',
            details
          )
        );
      }
      next(error);
    }
  };
}
