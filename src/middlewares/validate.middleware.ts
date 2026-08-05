import { Request, Response, NextFunction } from 'express';
import { ObjectSchema } from 'joi';

type RequestPart = 'body' | 'params' | 'query';

export const validate =
  (schema: ObjectSchema, part: RequestPart = 'body') =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[part], {
      abortEarly: false, // collect ALL validation errors, not just the first
      stripUnknown: true, // silently drop fields not defined in the schema
    });

    if (error) {
      return next(error); // caught by globalErrorHandler's `err.isJoi` branch
    }

    // Express v5 made req.query a read-only getter — direct assignment throws.
    if (part === 'query') {
      Object.defineProperty(req, 'query', { value, writable: true, configurable: true, enumerable: true });
    } else {
      req[part] = value;
    }
    next();
  };