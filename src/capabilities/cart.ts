// OCP Cart Capability Implementation
// dev.ocp.cart@1.0

import { Hono } from 'hono';
import type { CartCapabilityConfig, Cart, CartPolicy, ValidationIssue } from '../types';
import { OCP_ERRORS } from '../errors';

/**
 * Create cart capability routes and middleware
 */
export function createCartCapability(config: CartCapabilityConfig) {
  const cartCapability = new Hono();

  // Middleware to enforce cart policies
  cartCapability.use('/carts/*', async (c, next) => {
    const { cartStorage, userId } = c.var.ocp;
    const cartId = c.req.param('cartId');

    if (cartId) {
      const cart = await cartStorage.get(cartId);
      if (cart) {
        // Check cart expiration
        if (config.lifetimeSeconds) {
          const now = new Date();
          const cartAge = (now.getTime() - new Date(cart.createdAt).getTime()) / 1000;
          if (cartAge > config.lifetimeSeconds) {
            throw OCP_ERRORS.CART_EXPIRED;
          }
        }

        // Check cart policies
        if (config.policies) {
          for (const policy of config.policies) {
            const violation = checkCartPolicy(cart, policy);
            if (violation) {
              throw OCP_ERRORS.VALIDATION_ERROR([{
                type: 'business_logic',
                reason: violation,
              }]);
            }
          }
        }

        // Check guest access
        if (!userId && !config.allowGuestCheckout) {
          throw OCP_ERRORS.UNAUTHORIZED;
        }
      }
    }

    await next();
  });

  // Enhanced cart creation with guest checkout support
  cartCapability.post('/carts', async (c) => {
    const { cartStorage, config: ocpConfig, userId } = c.var.ocp;

    // Allow guest carts if enabled
    if (!userId && !config.allowGuestCheckout) {
      throw OCP_ERRORS.UNAUTHORIZED;
    }

    const body = await c.req.json();

    // Validate request
    const errors: ValidationIssue[] = [];
    if (!body.storeId) {
      errors.push({
        type: 'validation',
        field: 'storeId',
        reason: 'storeId is required',
      });
    }

    if (errors.length > 0) {
      throw OCP_ERRORS.VALIDATION_ERROR(errors);
    }

    // Check if store exists
    const store = ocpConfig.stores?.find(s => s.id === body.storeId);
    if (!store) {
      throw OCP_ERRORS.STORE_NOT_FOUND;
    }

    // Create cart with enhanced metadata
    const cartData = {
      items: [],
      subtotal: { amount: '0.00', currency: 'USD' },
      tax: { amount: '0.00', currency: 'USD' },
      total: { amount: '0.00', currency: 'USD' },
      metadata: {
        'dev.ocp.cart@1.0': {
          _version: '1.0',
          policies: config.policies || [],
          lifetimeSeconds: config.lifetimeSeconds,
          maxItems: config.maxItems,
          allowGuestCheckout: config.allowGuestCheckout,
          guestCheckout: !userId && config.allowGuestCheckout,
        },
      },
    };

    const newCart = await cartStorage.create(cartData);

    return c.json(newCart, {
      status: 201,
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  // Enhanced cart retrieval with policy information
  cartCapability.get('/carts/:cartId', async (c) => {
    const { cartStorage, userId } = c.var.ocp;
    const cartId = c.req.param('cartId');

    if (!userId && !config.allowGuestCheckout) {
      throw OCP_ERRORS.UNAUTHORIZED;
    }

    const cart = await cartStorage.get(cartId);
    if (!cart) {
      throw OCP_ERRORS.CART_NOT_FOUND;
    }

    // Add policy information to response
    const enhancedCart = {
      ...cart,
      metadata: {
        ...cart.metadata,
        'dev.ocp.cart@1.0': {
          _version: '1.0',
          policies: config.policies || [],
          lifetimeSeconds: config.lifetimeSeconds,
          maxItems: config.maxItems,
          allowGuestCheckout: config.allowGuestCheckout,
          // Calculate remaining time
          expiresAt: config.lifetimeSeconds
            ? new Date(new Date(cart.createdAt).getTime() + (config.lifetimeSeconds * 1000)).toISOString()
            : null,
        },
      },
    };

    return c.json(enhancedCart, {
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  // Enhanced item addition with policy checks
  cartCapability.post('/carts/:cartId/items', async (c) => {
    const { cartStorage, userId } = c.var.ocp;
    const cartId = c.req.param('cartId');

    // Guest checkout check is handled in middleware
    if (!userId && !config.allowGuestCheckout) {
      throw OCP_ERRORS.UNAUTHORIZED;
    }

    const body = await c.req.json();

    // Get cart
    const cart = await cartStorage.get(cartId);
    if (!cart) {
      throw OCP_ERRORS.CART_NOT_FOUND;
    }

    // Check max items policy
    if (config.maxItems && cart.items.length >= config.maxItems) {
      throw OCP_ERRORS.VALIDATION_ERROR([{
        type: 'business_logic',
        reason: `Cart cannot contain more than ${config.maxItems} items`,
      }]);
    }

    // Check max value policy
    if (config.maxValue) {
      const currentTotal = parseFloat(cart.total.amount);
      const itemPrice = parseFloat(body.price?.amount || '0');
      const newQuantity = body.quantity || 1;
      const newTotal = currentTotal + (itemPrice * newQuantity);

      if (newTotal > parseFloat(config.maxValue.amount)) {
        throw OCP_ERRORS.VALIDATION_ERROR([{
          type: 'business_logic',
          reason: `Cart total cannot exceed ${config.maxValue.amount} ${config.maxValue.currency}`,
        }]);
      }
    }

    // Continue with existing item addition logic...
    // (This would be integrated with the existing cart.ts logic)

    return c.json({ message: 'Item added to cart' }, {
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  return cartCapability;
}

/**
 * Check if a cart violates a policy
 */
function checkCartPolicy(cart: Cart, policy: CartPolicy): string | null {
  switch (policy.type) {
    case 'expiration':
      if (policy.value && typeof policy.value === 'number') {
        const now = new Date();
        const cartAge = (now.getTime() - new Date(cart.createdAt).getTime()) / 1000;
        if (cartAge > policy.value) {
          return policy.message || 'Cart has expired';
        }
      }
      break;

    case 'max_items':
      if (policy.value && typeof policy.value === 'number') {
        if (cart.items.length >= policy.value) {
          return policy.message || `Cart cannot contain more than ${policy.value} items`;
        }
      }
      break;

    case 'max_value':
      if (policy.value && typeof policy.value === 'object' && 'amount' in policy.value) {
        const maxAmount = parseFloat(policy.value.amount);
        const cartTotal = parseFloat(cart.total.amount);
        if (cartTotal > maxAmount) {
          return policy.message || `Cart total cannot exceed ${policy.value.amount} ${policy.value.currency}`;
        }
      }
      break;

    case 'store_restrictions':
      // Implement store-specific restrictions if needed
      break;
  }

  return null;
}

/**
 * Cart capability metadata processor
 */
export function processCartMetadata(metadata: any): any {
  // Process cart-specific metadata
  if (metadata.policies) {
    // Validate and normalize policies
    metadata.policies = metadata.policies.map((policy: any) => ({
      type: policy.type,
      value: policy.value,
      message: policy.message,
    }));
  }

  return metadata;
}

/**
 * Cart capability metadata validator
 */
export function validateCartMetadata(metadata: any): boolean {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }

  // Validate version
  if (metadata._version !== '1.0') {
    return false;
  }

  // Validate policies if present
  if (metadata.policies) {
    if (!Array.isArray(metadata.policies)) {
      return false;
    }

    for (const policy of metadata.policies) {
      if (!policy.type || typeof policy.type !== 'string') {
        return false;
      }
    }
  }

  return true;
}