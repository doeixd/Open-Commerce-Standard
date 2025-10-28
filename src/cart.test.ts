// Comprehensive Cart Management Tests
// Tests for robustness and OCP compliance

import { describe, it, expect, beforeEach } from 'vitest';
import { createOcpMiddleware } from './middleware';

describe('Cart Management', () => {
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
      }, {
        id: 'item_2',
        name: 'Unavailable Item',
        price: { amount: '15.00', currency: 'USD' },
        available: false,
        fulfillmentType: 'pickup' as const,
      }],
    }],
  };

  let middleware: any;

  beforeEach(() => {
    middleware = createOcpMiddleware(config);
  });

  describe('POST /carts - Create Cart', () => {
    it('should create a cart successfully', async () => {
      const request = new Request('http://localhost:3000/carts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          storeId: 'test_store',
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(201);

      const data = await response.json() as any;
      expect(data.id).toBeDefined();
      expect(data.items).toEqual([]);
      expect(data.subtotal.amount).toBe('0.00');
      expect(data.total.amount).toBe('0.00');
      expect(response.headers.get('Content-Type')).toBe('application/ocp+json; version=1.0');
    });

    it('should fail without authentication', async () => {
      const request = new Request('http://localhost:3000/carts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeId: 'test_store',
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(401);

      const data = await response.json() as any;
      expect(data.type).toContain('unauthorized');
    });

    it('should fail with invalid store ID', async () => {
      const request = new Request('http://localhost:3000/carts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          storeId: 'invalid_store',
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(404);

      const data = await response.json() as any;
      expect(data.type).toContain('store-not-found');
    });

    it('should fail with missing storeId', async () => {
      const request = new Request('http://localhost:3000/carts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({}),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(400);

      const data = await response.json() as any;
      expect(data.type).toContain('bad-request');
      expect(data.errors).toBeDefined();
    });

    it('should fail with malformed JSON', async () => {
      const request = new Request('http://localhost:3000/carts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: '{invalid json',
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(400);
    });
  });

  describe('POST /carts/{cartId}/items - Add Item to Cart', () => {
    let cartId: string;

    beforeEach(async () => {
      // Create a cart first
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
      const data = await createResponse.json() as any;
      cartId = data.id;
    });

    it('should add item to cart successfully', async () => {
      const request = new Request(`http://localhost:3000/carts/${cartId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          itemId: 'item_1',
          quantity: 2,
          notes: 'Extra spicy please',
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json() as any;
      expect(data.items).toHaveLength(1);
      expect(data.items[0].itemId).toBe('item_1');
      expect(data.items[0].quantity).toBe(2);
      expect(data.items[0].notes).toBe('Extra spicy please');
      expect(data.items[0].price.amount).toBe('10.00');
    });

    it('should fail with invalid cart ID', async () => {
      const request = new Request('http://localhost:3000/carts/invalid-cart/items', {
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

      const response = await middleware.fetch(request);
      expect(response.status).toBe(404);

      const data = await response.json() as any;
      expect(data.type).toContain('cart-not-found');
    });

    it('should fail with invalid item ID', async () => {
      const request = new Request(`http://localhost:3000/carts/${cartId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          itemId: 'invalid_item',
          quantity: 1,
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(400);

      const data = await response.json() as any;
      expect(data.type).toContain('bad-request');
      expect(data.errors[0].reason).toContain('Item not found');
    });

    it('should fail with unavailable item', async () => {
      const request = new Request(`http://localhost:3000/carts/${cartId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          itemId: 'item_2', // unavailable item
          quantity: 1,
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(409);

      const data = await response.json() as any;
      expect(data.type).toContain('insufficient-stock');
    });

    it('should fail with invalid quantity', async () => {
      const request = new Request(`http://localhost:3000/carts/${cartId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          itemId: 'item_1',
          quantity: 0, // invalid quantity
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(400);

      const data = await response.json() as any;
      expect(data.errors).toBeDefined();
    });

    it('should fail without authentication', async () => {
      const request = new Request(`http://localhost:3000/carts/${cartId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemId: 'item_1',
          quantity: 1,
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /carts/{cartId}/items/{itemId} - Update Cart Item', () => {
    let cartId: string;
    let itemId: string;

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

      // Add item
      const addRequest = new Request(`http://localhost:3000/carts/${cartId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          itemId: 'item_1',
          quantity: 1,
          notes: 'Original notes',
        }),
      });

      const addResponse = await middleware.fetch(addRequest);
      const addData = await addResponse.json() as any;
      itemId = addData.items[0].cartItemId;
    });

    it('should update item quantity successfully', async () => {
      const request = new Request(`http://localhost:3000/carts/${cartId}/items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          quantity: 3,
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json() as any;
      expect(data.items[0].quantity).toBe(3);
      expect(data.items[0].notes).toBe('Original notes'); // unchanged
    });

    it('should update item notes to null (remove notes)', async () => {
      const request = new Request(`http://localhost:3000/carts/${cartId}/items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          notes: null,
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json() as any;
      expect(data.items[0].notes).toBeUndefined();
    });

    it('should fail with invalid cart ID', async () => {
      const request = new Request('http://localhost:3000/carts/invalid-cart/items/invalid-item', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          quantity: 2,
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(404);
    });

    it('should fail with invalid item ID in cart', async () => {
      const request = new Request(`http://localhost:3000/carts/${cartId}/items/invalid-item-id`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          quantity: 2,
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(400);

      const data = await response.json() as any;
      expect(data.errors[0].reason).toContain('Item not found in cart');
    });
  });

  describe('DELETE /carts/{cartId}/items/{itemId} - Remove Item from Cart', () => {
    let cartId: string;
    let itemId: string;

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

      // Add item
      const addRequest = new Request(`http://localhost:3000/carts/${cartId}/items`, {
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

      const addResponse = await middleware.fetch(addRequest);
      const addData = await addResponse.json() as any;
      itemId = addData.items[0].cartItemId;
    });

    it('should remove item from cart successfully', async () => {
      const request = new Request(`http://localhost:3000/carts/${cartId}/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'X-User-ID': 'user_123',
        },
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json() as any;
      expect(data.items).toHaveLength(0);
    });

    it('should fail with invalid cart ID', async () => {
      const request = new Request('http://localhost:3000/carts/invalid-cart/items/invalid-item', {
        method: 'DELETE',
        headers: {
          'X-User-ID': 'user_123',
        },
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(404);
    });
  });

  describe('GET /carts/{cartId} - Get Cart', () => {
    let cartId: string;

    beforeEach(async () => {
      // Create a cart
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
      const data = await createResponse.json() as any;
      cartId = data.id;
    });

    it('should get cart successfully', async () => {
      const request = new Request(`http://localhost:3000/carts/${cartId}`, {
        headers: {
          'X-User-ID': 'user_123',
        },
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json() as any;
      expect(data.id).toBe(cartId);
      expect(data.items).toEqual([]);
      expect(response.headers.get('Content-Type')).toBe('application/ocp+json; version=1.0');
    });

    it('should fail with invalid cart ID', async () => {
      const request = new Request('http://localhost:3000/carts/invalid-cart', {
        headers: {
          'X-User-ID': 'user_123',
        },
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(404);

      const data = await response.json() as any;
      expect(data.type).toContain('cart-not-found');
    });

    it('should fail without authentication', async () => {
      const request = new Request(`http://localhost:3000/carts/${cartId}`);

      const response = await middleware.fetch(request);
      expect(response.status).toBe(401);
    });
  });
});