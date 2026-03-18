/**
 * Custom error classes for BatchData API integration
 */

export class BatchDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BatchDataError";
  }
}

export class BatchDataAPIError extends BatchDataError {
  statusCode: number;
  responseBody: string;

  constructor(message: string, statusCode: number, responseBody: string) {
    super(message);
    this.name = "BatchDataAPIError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export class BatchDataTimeoutError extends BatchDataError {
  constructor(message: string) {
    super(message);
    this.name = "BatchDataTimeoutError";
  }
}

export class BatchDataRateLimitError extends BatchDataError {
  constructor(message: string) {
    super(message);
    this.name = "BatchDataRateLimitError";
  }
}

export class BatchDataValidationError extends BatchDataError {
  constructor(message: string) {
    super(message);
    this.name = "BatchDataValidationError";
  }
}
