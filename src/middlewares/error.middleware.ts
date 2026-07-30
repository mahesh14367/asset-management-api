import { Request, Response, NextFunction } from 'express';
import { Error as MongooseError } from 'mongoose';
import ApiError, { FormattedFieldError } from '../utils/ApiError';
import { logger } from '../config/logger';
import { config } from '../config';

// ---- Individual error translators ----
// Each one converts a "foreign" error shape (Joi, Mongoose, JWT)
// into our own consistent ApiError.

const handleJoiError = (err: any): ApiError => {
  const errors: FormattedFieldError[] = err.details.map((d: any) => ({
    field: d.path.join('.'),
    message: d.message.replace(/"/g, ''),
  }));
  return ApiError.badRequest('Validation failed', errors);
};

const handleMongooseValidationError = (err: MongooseError.ValidationError): ApiError => {
  const errors: FormattedFieldError[] = Object.values(err.errors).map((val) => ({
    field: val.path,
    message: val.message,
  }));
  return ApiError.badRequest('Validation failed', errors);
};

const handleMongooseCastError = (err: MongooseError.CastError): ApiError => {
  return ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
};

const handleDuplicateKeyError = (err: any): ApiError => {
  const field = Object.keys(err.keyValue)[0] as string;
  const value = err.keyValue[field];
  return ApiError.conflict(`${field} '${value}' already exists`);
};

const handleJWTError = (): ApiError => ApiError.unauthorized('Invalid token. Please log in again.');
const handleJWTExpiredError = (): ApiError =>
  ApiError.unauthorized('Your session has expired. Please log in again.');

// ---- The actual middleware ----
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const globalErrorHandler = (err: any, req: Request, res: Response, _next: NextFunction): void => {
  let error: ApiError;

  if (err.isJoi) {
    error = handleJoiError(err);
  } else if (err.name === 'ValidationError' && err.errors) {
    error = handleMongooseValidationError(err);
  } else if (err.name === 'CastError') {
    error = handleMongooseCastError(err);
  } else if (err.code === 11000) {
    error = handleDuplicateKeyError(err);
  } else if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  } else if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  } else if (err instanceof ApiError) {
    error = err;
  } else {
    // Unknown / programmer error — never leak internals to the client
    error = new ApiError(
      err.statusCode ?? 500,
      err.statusCode ? err.message : 'Something went wrong on our end',
      undefined,
      false,
      err.stack
    );
  }

  // Log with the right severity
  if (error.isOperational) {
    logger.warn(`${req.method} ${req.originalUrl} - ${error.message}`);
  } else {
    logger.error(`${req.method} ${req.originalUrl} - ${error.message}`, { stack: error.stack });
  }

  res.status(error.statusCode).json({
    success: false,
    statusCode: error.statusCode,
    message: error.message,
    ...(error.errors ? { errors: error.errors } : {}),
    ...(config.nodeEnv === 'development' ? { stack: error.stack } : {}),
  });
};