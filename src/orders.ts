// OCP Order Management Endpoints Implementation

import { Hono } from 'hono';
import type { OrdersResponse, CreateOrderRequest, RatingRequest, ErrorDetail } from './types';
import { OCP_ERRORS, validateString } from './errors';

// Order routes
export function createOrderRoutes() {
  const orders = new Hono();

  // GET /orders - List user's orders
  orders.get('/orders', async (c) => {
    const { orderStorage, userId } = c.var.ocp;

    if (!userId) {
      throw OCP_ERRORS.UNAUTHORIZED;
    }

    const limit = parseInt(c.req.query('limit') || '20');
    const cursor = c.req.query('cursor');
    const status = c.req.query('status');

    const allOrders = await orderStorage.list(userId, status);
    const paginatedOrders = allOrders.slice(0, limit);

    const response: OrdersResponse = {
      orders: paginatedOrders,
      pagination: {
        limit,
        nextCursor: paginatedOrders.length === limit ? 'next_page_token' : null,
        previousCursor: cursor || null,
        totalCount: allOrders.length,
      },
    };

    return c.json(response, {
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  // POST /orders - Create order from cart
  orders.post('/orders', async (c) => {
    const { orderStorage, cartStorage, userId } = c.var.ocp;

    if (!userId) {
      throw OCP_ERRORS.UNAUTHORIZED;
    }

    const body: CreateOrderRequest = await c.req.json();

    // Validate request
    const errors: ErrorDetail[] = [];
    if ('cartId' in body && body.orderType === 'from_cart') {
      const cartIdError = validateString(body.cartId, 'cartId', { minLength: 1, maxLength: 100 });
      if (cartIdError) errors.push(cartIdError);
    } else if ('items' in body && body.orderType === 'direct') {
      if (!body.items || body.items.length === 0) {
        errors.push({
          type: 'validation' as const,
          field: 'items',
          reason: 'Items are required for direct orders'
        });
      }
    } else {
      errors.push({
        type: 'validation' as const,
        field: 'orderType',
        value: (body as any).orderType,
        reason: 'Must be either "from_cart" or "direct"'
      });
    }

    if (errors.length > 0) {
      throw OCP_ERRORS.VALIDATION_ERROR(errors);
    }

    let orderItems = [];
    let total = { amount: '0.00', currency: 'USD' };

    if (body.orderType === 'from_cart') {
      // Get cart and validate
      const cart = await cartStorage.get(body.cartId);
      if (!cart) {
        throw OCP_ERRORS.CART_NOT_FOUND;
      }

      if (cart.items.length === 0) {
        throw OCP_ERRORS.VALIDATION_ERROR([{
          type: 'validation',
          field: 'cartId',
          reason: 'Cart is empty'
        }]);
      }

      orderItems = cart.items;
      total = cart.total;

      // Mark cart as submitted (in real implementation)
      await cartStorage.delete(body.cartId);
    } else {
      // Direct order - validate items
      orderItems = body.items.map((item, index) => ({
        ...item,
        cartItemId: `item_${Date.now()}_${index}`,
        price: { amount: '10.00', currency: 'USD' }, // Mock price
      }));
      total = { amount: (orderItems.length * 10).toFixed(2), currency: 'USD' };
    }

    // Create order
    const newOrder = await orderStorage.create({
      status: 'pending',
      items: orderItems,
      total,
      fulfillmentType: body.fulfillmentType,
      deliveryAddress: body.deliveryAddress,
      metadata: body.metadata,
    });

    return c.json(newOrder, {
      status: 201,
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  // GET /orders/{orderId} - Get order by ID
  orders.get('/orders/:orderId', async (c) => {
    const { orderStorage, userId } = c.var.ocp;
    const orderId = c.req.param('orderId');

    if (!userId) {
      throw OCP_ERRORS.UNAUTHORIZED;
    }

    const orderIdError = validateString(orderId, 'orderId', { minLength: 1, maxLength: 100 });
    if (orderIdError) {
      throw OCP_ERRORS.VALIDATION_ERROR([orderIdError]);
    }

    const order = await orderStorage.get(orderId);
    if (!order) {
      throw OCP_ERRORS.ORDER_NOT_FOUND;
    }

    return c.json(order, {
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  // POST /orders/{orderId}/cancel - Cancel order
  orders.post('/orders/:orderId/cancel', async (c) => {
    const { orderStorage, userId } = c.var.ocp;
    const orderId = c.req.param('orderId');

    if (!userId) {
      throw OCP_ERRORS.UNAUTHORIZED;
    }

    const orderIdError = validateString(orderId, 'orderId', { minLength: 1, maxLength: 100 });
    if (orderIdError) {
      throw OCP_ERRORS.VALIDATION_ERROR([orderIdError]);
    }

    const body = await c.req.json().catch(() => ({}));
    const { reason } = body;

    // Get order
    const order = await orderStorage.get(orderId);
    if (!order) {
      throw OCP_ERRORS.ORDER_NOT_FOUND;
    }

    // Check if order can be cancelled
    if (order.status !== 'pending') {
      throw OCP_ERRORS.ORDER_CANNOT_CANCEL;
    }

    // Update order status
    const updatedOrder = await orderStorage.update(orderId, {
      status: 'cancelled',
      metadata: {
        ...order.metadata,
        cancellationReason: reason,
        cancelledAt: new Date().toISOString(),
      },
    });

    if (!updatedOrder) {
      throw OCP_ERRORS.INTERNAL_SERVER_ERROR;
    }

    return c.json(updatedOrder, {
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  // POST /orders/{orderId}/ratings - Submit ratings
  orders.post('/orders/:orderId/ratings', async (c) => {
    const { orderStorage, userId } = c.var.ocp;
    const orderId = c.req.param('orderId');

    if (!userId) {
      throw OCP_ERRORS.UNAUTHORIZED;
    }

    const orderIdError = validateString(orderId, 'orderId', { minLength: 1, maxLength: 100 });
    if (orderIdError) {
      throw OCP_ERRORS.VALIDATION_ERROR([orderIdError]);
    }

    const body: RatingRequest = await c.req.json();

    // Validate ratings
    const errors: ErrorDetail[] = [];
    if (body.food !== undefined && (body.food < 1 || body.food > 5)) {
      errors.push({
        type: 'validation' as const,
        field: 'food',
        value: body.food,
        reason: 'Rating must be between 1 and 5'
      });
    }

    if (body.delivery !== undefined && (body.delivery < 1 || body.delivery > 5)) {
      errors.push({
        type: 'validation' as const,
        field: 'delivery',
        value: body.delivery,
        reason: 'Rating must be between 1 and 5'
      });
    }

    if (body.restaurant !== undefined && (body.restaurant < 1 || body.restaurant > 5)) {
      errors.push({
        type: 'validation' as const,
        field: 'restaurant',
        value: body.restaurant,
        reason: 'Rating must be between 1 and 5'
      });
    }

    if (body.delivery !== undefined && (body.delivery < 1 || body.delivery > 5)) {
      errors.push({
        type: 'validation',
        field: 'delivery',
        value: body.delivery,
        reason: 'Rating must be between 1 and 5'
      });
    }

    if (body.restaurant !== undefined && (body.restaurant < 1 || body.restaurant > 5)) {
      errors.push({
        type: 'validation',
        field: 'restaurant',
        value: body.restaurant,
        reason: 'Rating must be between 1 and 5'
      });
    }

    if (errors.length > 0) {
      throw OCP_ERRORS.VALIDATION_ERROR(errors);
    }

    // Get order
    const order = await orderStorage.get(orderId);
    if (!order) {
      throw OCP_ERRORS.ORDER_NOT_FOUND;
    }

    // Check if order is completed (simplified check)
    if (order.status !== 'completed') {
      throw OCP_ERRORS.VALIDATION_ERROR([{
        type: 'business_logic',
        reason: 'Can only rate completed orders'
      }]);
    }

    // Update order with ratings
    const updatedOrder = await orderStorage.update(orderId, {
      metadata: {
        ...order.metadata,
        ratings: body,
        ratedAt: new Date().toISOString(),
      },
    });

    if (!updatedOrder) {
      throw OCP_ERRORS.INTERNAL_SERVER_ERROR;
    }

    return c.json(updatedOrder, 201, {
      'Content-Type': 'application/ocp+json; version=1.0',
    });
  });

  return orders;
}