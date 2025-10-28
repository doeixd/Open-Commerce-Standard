// OCP Error Handling - RFC 9457 Problem Details Implementation

import type { Error, ErrorDetail } from './types';

export class OcpError extends Error {
  public readonly type: string;
  public readonly title: string;
  public readonly status: number;
  public readonly detail?: string;
  public readonly instance?: string;
  public readonly timestamp: string;
  public readonly localizationKey?: string;
  public readonly nextActions?: any[];
  public readonly errors?: ErrorDetail[];

  constructor(
    type: string,
    title: string,
    status: number,
    options: {
      detail?: string;
      instance?: string;
      localizationKey?: string;
      nextActions?: any[];
      errors?: ErrorDetail[];
    } = {}
  ) {
    super(title);
    this.name = 'OcpError';
    this.type = type;
    this.title = title;
    this.status = status;
    this.detail = options.detail;
    this.instance = options.instance;
    this.timestamp = new Date().toISOString();
    this.localizationKey = options.localizationKey;
    this.nextActions = options.nextActions;
    this.errors = options.errors;
  }

  toJSON(): Error {
    return {
      type: this.type,
      title: this.title,
      status: this.status,
      detail: this.detail,
      instance: this.instance,
      timestamp: this.timestamp,
      localizationKey: this.localizationKey,
      nextActions: this.nextActions,
      errors: this.errors,
    };
  }
}

// Predefined OCP Errors - Based on OCP Error Catalog
export const OCP_ERRORS = {
  // General Errors
  BAD_REQUEST: new OcpError(
    'https://schemas.ocp.dev/errors/bad-request',
    'Bad Request',
    400,
    {
      detail: 'The request was malformed or contains invalid data',
      localizationKey: 'error.bad_request'
    }
  ),

  UNAUTHORIZED: new OcpError(
    'https://schemas.ocp.dev/errors/unauthorized',
    'Unauthorized',
    401,
    {
      detail: 'Authentication credentials are required or invalid',
      localizationKey: 'error.unauthorized'
    }
  ),

  FORBIDDEN: new OcpError(
    'https://schemas.ocp.dev/errors/forbidden',
    'Forbidden',
    403,
    {
      detail: 'The authenticated user does not have permission to perform this action',
      localizationKey: 'error.forbidden'
    }
  ),

  NOT_FOUND: new OcpError(
    'https://schemas.ocp.dev/errors/not-found',
    'Not Found',
    404,
    {
      detail: 'The requested resource does not exist',
      localizationKey: 'error.not_found'
    }
  ),

  SERVER_ERROR: new OcpError(
    'https://schemas.ocp.dev/errors/server-error',
    'Internal Server Error',
    500,
    {
      detail: 'An unexpected error occurred on the server',
      localizationKey: 'error.server_error'
    }
  ),

  // Cart Errors
  CART_NOT_FOUND: new OcpError(
    'https://schemas.ocp.dev/errors/cart-not-found',
    'Cart Not Found',
    404,
    {
      detail: 'The requested cartId does not exist or has already been converted to an order',
      localizationKey: 'error.cart.not_found',
      nextActions: [{
        id: 'create_new_cart',
        href: '/carts',
        method: 'POST',
        title: 'Create New Cart'
      }]
    }
  ),

  ORDER_NOT_FOUND: new OcpError(
    'https://schemas.ocp.dev/errors/order-not-found',
    'Order Not Found',
    404,
    {
      detail: 'Order does not exist',
      localizationKey: 'error.order.not_found'
    }
  ),

  STORE_NOT_FOUND: new OcpError(
    'https://schemas.ocp.dev/errors/store-not-found',
    'Store Not Found',
    404,
    {
      detail: 'Store does not exist',
      localizationKey: 'error.store.not_found'
    }
  ),

  CATALOG_NOT_FOUND: new OcpError(
    'https://schemas.ocp.dev/errors/catalog-not-found',
    'Catalog Not Found',
    404,
    {
      detail: 'Catalog does not exist',
      localizationKey: 'error.catalog.not_found'
    }
  ),

  CART_EXPIRED: new OcpError(
    'https://schemas.ocp.dev/errors/cart-expired',
    'Cart Expired',
    410,
    {
      detail: 'The cart existed but was deleted due to inactivity per the server\'s lifetimeSeconds policy',
      localizationKey: 'error.cart.expired',
      nextActions: [{
        id: 'create_new_cart',
        href: '/carts',
        method: 'POST',
        title: 'Create New Cart'
      }]
    }
  ),

  ORDER_CANNOT_CANCEL: new OcpError(
    'https://schemas.ocp.dev/errors/order-cannot-cancel',
    'Order Cannot Be Cancelled',
    403,
    {
      detail: 'Order is not in a cancellable state',
      localizationKey: 'error.order.cannot_cancel'
    }
  ),

  // Validation Errors
  VALIDATION_ERROR: (errors: ErrorDetail[]) => new OcpError(
    'https://schemas.ocp.dev/errors/bad-request',
    'Bad Request',
    400,
    {
      detail: 'One or more fields failed validation',
      localizationKey: 'error.bad_request',
      errors
    }
  ),

  // Business Logic Errors
  INSUFFICIENT_STOCK: (itemId: string) => new OcpError(
    'https://schemas.ocp.dev/errors/insufficient-stock',
    'Insufficient Stock',
    409,
    {
      detail: `Item ${itemId} has insufficient stock`,
      localizationKey: 'error.insufficient_stock',
      errors: [{
        type: 'business_logic',
        resourceId: itemId,
        reason: 'The requested item has 0 stock remaining'
      }]
    }
  ),

  INVALID_PROMOTION: new OcpError(
    'https://schemas.ocp.dev/errors/invalid-promotion',
    'Invalid Promotion',
    400,
    {
      detail: 'The provided promotion code is invalid or expired',
      localizationKey: 'error.invalid_promotion'
    }
  ),

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: new OcpError(
    'https://schemas.ocp.dev/errors/rate-limit-exceeded',
    'Rate Limit Exceeded',
    429,
    {
      detail: 'Rate limit exceeded. Please try again later.',
      localizationKey: 'error.rate_limit.exceeded'
    }
  ),

  // Server Errors
  INTERNAL_SERVER_ERROR: new OcpError(
    'https://schemas.ocp.dev/errors/internal-server-error',
    'Internal Server Error',
    500,
    {
      detail: 'An unexpected error occurred',
      localizationKey: 'error.internal_server'
    }
  ),

  SERVICE_UNAVAILABLE: new OcpError(
    'https://schemas.ocp.dev/errors/service-unavailable',
    'Service Unavailable',
    503,
    {
      detail: 'Service is temporarily unavailable',
      localizationKey: 'error.service_unavailable'
    }
  ),

  // Conflict Errors
  CONFLICT: new OcpError(
    'https://schemas.ocp.dev/errors/conflict',
    'Conflict',
    409,
    {
      detail: 'The request conflicts with the current state of the resource',
      localizationKey: 'error.conflict'
    }
  )
};

// Error response middleware
export function createErrorHandler() {
  return async (error: any, c: any) => {
    console.error('OCP Error:', error);

    let ocpError: OcpError;

    if (error instanceof OcpError) {
      ocpError = error;
    } else if (error.name === 'ValidationError') {
      // Handle validation errors from schema validation
      const validationErrors: ErrorDetail[] = error.details?.map((detail: any) => ({
        type: 'validation' as const,
        field: detail.path?.join('.'),
        value: detail.value,
        reason: detail.message
      })) || [];

      ocpError = OCP_ERRORS.VALIDATION_ERROR(validationErrors);
    } else if (error instanceof SyntaxError && error.message.includes('JSON')) {
      // Handle JSON parsing errors as bad request
      ocpError = OCP_ERRORS.BAD_REQUEST;
    } else {
      // Generic server error
      ocpError = OCP_ERRORS.INTERNAL_SERVER_ERROR;
    }

    return c.json(ocpError.toJSON(), ocpError.status);
  };
}

// Validation helpers
// Input validation utilities with sanitization
export function sanitizeString(value: any): string | null {
  if (typeof value !== 'string') return null;
  // Basic sanitization - trim whitespace and limit length
  const sanitized = value.trim();
  return sanitized.length > 0 && sanitized.length <= 1000 ? sanitized : null;
}

export function validateRequired(value: any, field: string): ErrorDetail | null {
  if (value === null || value === undefined || value === '') {
    return {
      type: 'validation',
      field,
      reason: 'This field is required'
    };
  }
  return null;
}

export function validateString(value: any, field: string, options: { minLength?: number; maxLength?: number } = {}): ErrorDetail | null {
  const sanitized = sanitizeString(value);
  if (sanitized === null) {
    return {
      type: 'validation',
      field,
      value,
      reason: 'Must be a valid string'
    };
  }

  if (options.minLength && sanitized.length < options.minLength) {
    return {
      type: 'validation',
      field,
      value,
      reason: `Must be at least ${options.minLength} characters long`
    };
  }

  if (options.maxLength && sanitized.length > options.maxLength) {
    return {
      type: 'validation',
      field,
      value,
      reason: `Must be no more than ${options.maxLength} characters long`
    };
  }

  return null;
}

export function validateUUID(value: string, field: string): ErrorDetail | null {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    return {
      type: 'validation',
      field,
      value,
      reason: 'Must be a valid UUID'
    };
  }
  return null;
}

export function validateEnum(value: any, allowedValues: any[], field: string): ErrorDetail | null {
  if (!allowedValues.includes(value)) {
    return {
      type: 'validation',
      field,
      value,
      reason: `Must be one of: ${allowedValues.join(', ')}`
    };
  }
  return null;
}

export function validateMin(value: number, min: number, field: string): ErrorDetail | null {
  if (typeof value !== 'number' || isNaN(value) || value < min) {
    return {
      type: 'validation',
      field,
      value,
      reason: `Must be a number at least ${min}`
    };
  }
  return null;
}

export function validateMax(value: number, max: number, field: string): ErrorDetail | null {
  if (typeof value !== 'number' || isNaN(value) || value > max) {
    return {
      type: 'validation',
      field,
      value,
      reason: `Must be a number no more than ${max}`
    };
  }
  return null;
}

export function validateEmail(value: any, field: string): ErrorDetail | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const sanitized = sanitizeString(value);
  if (!sanitized || !emailRegex.test(sanitized)) {
    return {
      type: 'validation',
      field,
      value,
      reason: 'Must be a valid email address'
    };
  }
  return null;
}