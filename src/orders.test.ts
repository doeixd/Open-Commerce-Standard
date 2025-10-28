// Comprehensive Order Management Tests
// Tests for robustness and OCP compliance

import { describe, it, expect, beforeEach } from 'vitest';
import { createOcpMiddleware } from './middleware';

describe('Order Management', () => {
  const config = {
    baseUrl: 'http://localhost:3000',
    stores: [{
      id: 'test_store',
      name: 'Test Store',
      location: {
        address: '123 Test St',
        latitude: 40.7128,
        longitude: -74.0060,
      },
      catalogIds: ['test_catalog'],
    }],
    catalogs: [{
      id: 'test_catalog',
      name: 'Test Catalog',
      version: '1.0',
      items: [{
        id: 'item_1',
        name: 'Test Item',
        description: 'A test item',
        price: { amount: '10.00', currency: 'USD' },
        available: true,
        fulfillmentType: 'pickup' as const,
        metadata: { category: 'test' },
      }],
    }],
  };

  let middleware: any;

  beforeEach(() => {
    middleware = createOcpMiddleware(config);
  });

  describe('GET /orders - List Orders', () => {
    it('should return empty orders list when no orders exist', async () => {
      const request = new Request('http://localhost:3000/orders', {
        headers: {
          'X-User-ID': 'user_123',
        },
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json() as any;
      expect(data.orders).toEqual([]);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.limit).toBe(20);
      expect(response.headers.get('Content-Type')).toBe('application/ocp+json; version=1.0');
    });

    it('should fail without authentication', async () => {
      const request = new Request('http://localhost:3000/orders');

      const response = await middleware.fetch(request);
      expect(response.status).toBe(401);
    });

    it('should filter orders by status', async () => {
      const request = new Request('http://localhost:3000/orders?status=confirmed', {
        headers: {
          'X-User-ID': 'user_123',
        },
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json() as any;
      expect(data.orders).toEqual([]);
    });
  });

  describe('POST /orders - Create Order from Cart', () => {
    let cartId: string;

    beforeEach(async () => {
      // Create cart and add item
      const createRequest = new Request('http://localhost:3000/carts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          storeId: 'test_store',
        }),
      });

      const createResponse = await middleware.fetch(createRequest);
      const cartData = await createResponse.json() as any;
      cartId = cartData.id;

      // Add item to cart
      const addRequest = new Request(`http://localhost:3000/carts/${cartId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          itemId: 'item_1',
          quantity: 2,
        }),
      });

      await middleware.fetch(addRequest);
    });

    it('should create order from cart successfully', async () => {
      const request = new Request('http://localhost:3000/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          orderType: 'from_cart',
          cartId: cartId,
          deliveryAddress: {
            address: '123 Main St',
            latitude: 40.7128,
            longitude: -74.0060,
          },
          notes: 'Please handle with care',
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(201);

      const data = await response.json() as any;
      expect(data.id).toBeDefined();
      expect(data.status).toBe('pending');
      expect(data.items).toHaveLength(1);
      expect(data.items[0].quantity).toBe(2);
      expect(data.deliveryAddress.address).toBe('123 Main St');
      expect(data.notes).toBe('Please handle with care');
      expect(response.headers.get('Content-Type')).toBe('application/ocp+json; version=1.0');
    });

    it('should create direct order successfully', async () => {
      const request = new Request('http://localhost:3000/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          orderType: 'direct',
          items: [{
            itemId: 'item_1',
            quantity: 1,
            notes: 'Direct order item',
          }],
          deliveryAddress: {
            address: '456 Oak St',
            latitude: 40.7128,
            longitude: -74.0060,
          },
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(201);

      const data = await response.json() as any;
      expect(data.id).toBeDefined();
      expect(data.status).toBe('pending');
      expect(data.items).toHaveLength(1);
      expect(data.items[0].notes).toBe('Direct order item');
    });

    it('should fail with invalid cart ID', async () => {
      const request = new Request('http://localhost:3000/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          orderType: 'from_cart',
          cartId: 'invalid_cart',
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(400);

      const data = await response.json() as any;
      expect(data.type).toContain('bad-request');
    });

    it('should fail with empty direct order items', async () => {
      const request = new Request('http://localhost:3000/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          orderType: 'direct',
          items: [],
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(400);

      const data = await response.json() as any;
      expect(data.type).toContain('bad-request');
    });

    it('should fail with invalid order type', async () => {
      const request = new Request('http://localhost:3000/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          orderType: 'invalid_type',
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(400);

      const data = await response.json() as any;
      expect(data.type).toContain('bad-request');
    });

    it('should fail without authentication', async () => {
      const request = new Request('http://localhost:3000/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderType: 'from_cart',
          cartId: cartId,
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /orders/{orderId} - Get Order', () => {
    let orderId: string;

    beforeEach(async () => {
      // Create cart and order
      const createCartRequest = new Request('http://localhost:3000/carts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          storeId: 'test_store',
        }),
      });

      const cartResponse = await middleware.fetch(createCartRequest);
      const cartData = await cartResponse.json() as any;

      // Add item
      const addRequest = new Request(`http://localhost:3000/carts/${cartData.id}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          itemId: 'item_1',
          quantity: 1,
        }),
      });

      await middleware.fetch(addRequest);

      // Create order
      const createOrderRequest = new Request('http://localhost:3000/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          orderType: 'from_cart',
          cartId: cartData.id,
        }),
      });

      const orderResponse = await middleware.fetch(createOrderRequest);
      const orderData = await orderResponse.json() as any;
      orderId = orderData.id;
    });

    it('should get order successfully', async () => {
      const request = new Request(`http://localhost:3000/orders/${orderId}`, {
        headers: {
          'X-User-ID': 'user_123',
        },
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json() as any;
      expect(data.id).toBe(orderId);
      expect(data.status).toBe('pending');
      expect(data.items).toHaveLength(1);
      expect(response.headers.get('Content-Type')).toBe('application/ocp+json; version=1.0');
    });

    it('should fail with invalid order ID', async () => {
      const request = new Request('http://localhost:3000/orders/invalid-order', {
        headers: {
          'X-User-ID': 'user_123',
        },
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(404);

      const data = await response.json() as any;
      expect(data.type).toContain('order-not-found');
    });

    it('should fail without authentication', async () => {
      const request = new Request(`http://localhost:3000/orders/${orderId}`);

      const response = await middleware.fetch(request);
      expect(response.status).toBe(401);
    });
  });

  describe('POST /orders/{orderId}/cancel - Cancel Order', () => {
    let orderId: string;

    beforeEach(async () => {
      // Create cart and order
      const createCartRequest = new Request('http://localhost:3000/carts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          storeId: 'test_store',
        }),
      });

      const cartResponse = await middleware.fetch(createCartRequest);
      const cartData = await cartResponse.json() as any;

      // Add item
      const addRequest = new Request(`http://localhost:3000/carts/${cartData.id}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          itemId: 'item_1',
          quantity: 1,
        }),
      });

      await middleware.fetch(addRequest);

      // Create order
      const createOrderRequest = new Request('http://localhost:3000/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          orderType: 'from_cart',
          cartId: cartData.id,
        }),
      });

      const orderResponse = await middleware.fetch(createOrderRequest);
      const orderData = await orderResponse.json() as any;
      orderId = orderData.id;
    });

    it('should cancel order successfully', async () => {
      const request = new Request(`http://localhost:3000/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          reason: 'Changed my mind',
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json() as any;
      expect(data.status).toBe('cancelled');
      expect(data.metadata.cancellationReason).toBe('Changed my mind');
      expect(data.metadata.cancelledAt).toBeDefined();
    });

    it('should fail to cancel non-pending order', async () => {
      // First cancel the order
      const cancelRequest = new Request(`http://localhost:3000/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          reason: 'Test cancel',
        }),
      });

      await middleware.fetch(cancelRequest);

      // Try to cancel again
      const secondCancelRequest = new Request(`http://localhost:3000/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          reason: 'Try again',
        }),
      });

      const response = await middleware.fetch(secondCancelRequest);
      expect(response.status).toBe(403);

      const data = await response.json() as any;
      expect(data.type).toContain('order-cannot-cancel');
    });

    it('should fail with invalid order ID', async () => {
      const request = new Request('http://localhost:3000/orders/invalid-order/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          reason: 'Test',
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(404);
    });
  });

  describe('POST /orders/{orderId}/ratings - Submit Ratings', () => {
    let orderId: string;

    beforeEach(async () => {
      // Create cart and order
      const createCartRequest = new Request('http://localhost:3000/carts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          storeId: 'test_store',
        }),
      });

      const cartResponse = await middleware.fetch(createCartRequest);
      const cartData = await cartResponse.json() as any;

      // Add item
      const addRequest = new Request(`http://localhost:3000/carts/${cartData.id}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          itemId: 'item_1',
          quantity: 1,
        }),
      });

      await middleware.fetch(addRequest);

      // Create order
      const createOrderRequest = new Request('http://localhost:3000/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          orderType: 'from_cart',
          cartId: cartData.id,
        }),
      });

      const orderResponse = await middleware.fetch(createOrderRequest);
      const orderData = await orderResponse.json() as any;
      orderId = orderData.id;
    });

    it('should submit ratings successfully', async () => {
      const request = new Request(`http://localhost:3000/orders/${orderId}/ratings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          food: 5,
          delivery: 4,
          restaurant: 5,
          comment: 'Great experience!',
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json() as any;
      expect(data).toBeDefined();
      // Rating submission typically returns success confirmation
    });

    it('should fail with invalid rating values', async () => {
      const request = new Request(`http://localhost:3000/orders/${orderId}/ratings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          food: 6, // Invalid: should be 1-5
          delivery: 4,
          restaurant: 5,
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(400);

      const data = await response.json() as any;
      expect(data.type).toContain('bad-request');
      expect(data.errors).toBeDefined();
    });

    it('should fail with invalid order ID', async () => {
      const request = new Request('http://localhost:3000/orders/invalid-order/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          food: 5,
          delivery: 4,
          restaurant: 5,
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(404);
    });

    it('should fail without authentication', async () => {
      const request = new Request(`http://localhost:3000/orders/${orderId}/ratings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          food: 5,
          delivery: 4,
          restaurant: 5,
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(401);
    });
  });
});