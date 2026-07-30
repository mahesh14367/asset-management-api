export interface FormattedFieldError {
  field?: string;
  message: string;
}

class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors?: FormattedFieldError[];

  constructor(
    statusCode: number,
    message: string,
    errors?: FormattedFieldError[],
    isOperational = true,
    stack = ''
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (errors !== undefined) {
      this.errors = errors;
    }

    // Preserve the "name" for cleaner logs/instanceof checks
    this.name = this.constructor.name;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // Convenience static factories — use these in your services/controllers
  static badRequest(message: string, errors?: FormattedFieldError[]): ApiError {
    return new ApiError(400, message, errors);
  }
  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(401, message);
  }
  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(403, message);
  }
  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(404, message);
  }
  static conflict(message: string): ApiError {
    return new ApiError(409, message);
  }
  static internal(message = 'Internal server error'): ApiError {
    return new ApiError(500, message, undefined, false);
  }
}

export default ApiError;