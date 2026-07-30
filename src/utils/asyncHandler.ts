import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async Express handler so rejected promises are
 * automatically forwarded to the global error handler via next(err).
 * Eliminates the need for try/catch in every controller.
 */
const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export default asyncHandler;