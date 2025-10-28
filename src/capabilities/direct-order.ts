// OCP Direct Order Capability Implementation
// dev.ocp.order.direct@1.0

import { Hono } from 'hono';
import type { DirectOrderCapabilityConfig, CreateDirectOrderRequest, CatalogItem, ValidationIssue } from '../types';
import { OCP_ERRORS } from '../errors';

/**
 * Create direct order capability routes
 */
export function createDirectOrderCapability(config: DirectOrderCapabilityConfig) {
  const directOrderCapability = new Hono();

  // POST /orders - Create direct order (bypassing cart)
  directOrderCapability.post('/orders', async (c) => {
    const { orderStorage, config: ocpConfig, userId } = c.var.ocp;

    // Check if direct orders are enabled
    if (!config.enabled) {
      return c.json({ error: 'Direct orders not supported' }, { status: 404 });
    }

    // Allow guest orders if enabled
    if (!userId && !config.allowGuestOrders) {
      throw OCP_ERRORS.UNAUTHORIZED;
    }

    const body: CreateDirectOrderRequest = await c.req.json();

    // Validate request
    const errors: ValidationIssue[] = [];
    if (body.orderType !== 'direct') {
      errors.push({
        type: 'validation',
        field: 'orderType',
        reason: 'Must be "direct" for direct orders',
      });
    }

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      errors.push({
        type: 'validation',
        field: 'items',
        reason: 'Items array is required and cannot be empty',
      });
    } else {
      // Check max items per order
      if (config.maxItemsPerOrder && body.items.length > config.maxItemsPerOrder) {
        errors.push({
          type: 'validation',
          field: 'items',
          reason: `Cannot order more than ${config.maxItemsPerOrder} items`,
        });
      }

      // Validate each item
      for (let i = 0; i < body.items.length; i++) {
        const item = body.items[i];
        if (!item.itemId) {
          errors.push({
            type: 'validation',
            field: `items[${i}].itemId`,
            reason: 'itemId is required',
          });
        }
        if (!item.quantity || item.quantity < 1) {
          errors.push({
            type: 'validation',
            field: `items[${i}].quantity`,
            reason: 'quantity must be at least 1',
          });
        }
      }
    }

    // Validate fulfillment type
    if (body.fulfillmentType && !config.supportedFulfillmentTypes?.includes(body.fulfillmentType)) {
      errors.push({
        type: 'validation',
        field: 'fulfillmentType',
        reason: `Unsupported fulfillment type. Supported: ${config.supportedFulfillmentTypes?.join(', ')}`,
      });
    }

    if (errors.length > 0) {
      throw OCP_ERRORS.VALIDATION_ERROR(errors);
    }

    // Validate and enrich items
    const enrichedItems = [];
    let totalAmount = 0;

    for (const item of body.items) {
      // Find item in catalogs
      let catalogItem: CatalogItem | undefined;
      if (ocpConfig.catalogs) {
        for (const catalog of ocpConfig.catalogs) {
          catalogItem = catalog.items.find(ci => ci.id === item.itemId);
          if (catalogItem) break;
        }
      }

      if (!catalogItem) {
        throw OCP_ERRORS.VALIDATION_ERROR([{
          type: 'validation',
          field: 'itemId',
          value: item.itemId,
          reason: 'Item not found in any catalog',
        }]);
      }

      // Check availability
      if (!catalogItem.available) {
        throw OCP_ERRORS.INSUFFICIENT_STOCK(item.itemId);
      }

      // Calculate item total
      const itemPrice = parseFloat(catalogItem.price.amount);
      const itemTotal = itemPrice * item.quantity;
      totalAmount += itemTotal;

      // Create cart item
      const cartItemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      enrichedItems.push({
        ...item,
        cartItemId,
        price: catalogItem.price,
      });
    }

    // Create order
    const orderData = {
      status: 'confirmed' as const,
      items: enrichedItems,
      total: {
        amount: totalAmount.toFixed(2),
        currency: 'USD', // TODO: Get from config or first item
      },
      fulfillmentType: body.fulfillmentType,
      deliveryAddress: body.deliveryAddress,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        'dev.ocp.order.direct@1.0': {
          _version: '1.0',
          orderType: 'direct',
          guestOrder: !userId && config.allowGuestOrders,
          itemCount: enrichedItems.length,
        },
        ...body.metadata,
      },
    };

    const order = await orderStorage.create(orderData);

    return c.json(order, {
      status: 201,
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  return directOrderCapability;
}

/**
 * Direct order capability metadata processor
 */
export function processDirectOrderMetadata(metadata: any): any {
  // Process direct order-specific metadata
  if (metadata.orderType && metadata.orderType !== 'direct') {
    throw new Error('Invalid order type for direct orders');
  }

  return metadata;
}

/**
 * Direct order capability metadata validator
 */
export function validateDirectOrderMetadata(metadata: any): boolean {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }

  // Validate version
  if (metadata._version !== '1.0') {
    return false;
  }

  // Validate order type
  if (metadata.orderType && metadata.orderType !== 'direct') {
    return false;
  }

  return true;
}