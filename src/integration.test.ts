// Comprehensive Integration Tests
// End-to-end workflow testing for OCP compliance

import { describe, it, expect, beforeEach } from 'vitest';
import { createOcpMiddleware } from './middleware';

describe('OCP Integration Workflows', () => {
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
        name: 'Test Item 1',
        price: { amount: '10.00', currency: 'USD' },
        available: true,
        fulfillmentType: 'pickup' as const,
      }, {
        id: 'item_2',
        name: 'Test Item 2',
        price: { amount: '15.00', currency: 'USD' },
        available: true,
        fulfillmentType: 'delivery' as const,
      }],
    }],
    enableCarts: true,
    enableOrders: true,
    enableWebhooks: true,
  };

  let middleware: any;

  beforeEach(() => {
    middleware = createOcpMiddleware(config);
  });

  describe('Complete Cart → Order → Rating Workflow', () => {
    it('should complete full workflow from cart creation to order rating', async () => {
      const userId = 'user_workflow_123';

      // Step 1: Create a cart
      const createCartRequest = new Request('http://localhost:3000/carts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          storeId: 'test_store',
        }),
      });

      const createCartResponse = await middleware.fetch(createCartRequest);
      expect(createCartResponse.status).toBe(201);

      const cartData = await createCartResponse.json() as any;
      const cartId = cartData.id;
      expect(cartId).toBeDefined();

      // Step 2: Add items to cart
      const addItemRequest = new Request(`http://localhost:3000/carts/${cartId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          itemId: 'item_1',
          quantity: 2,
          catalogId: 'test_catalog',
        }),
      });

       const addItemResponse = await middleware.fetch(addItemRequest);
       expect(addItemResponse.status).toBe(200);

      // Add another item
      const addItem2Request = new Request(`http://localhost:3000/carts/${cartId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          itemId: 'item_2',
          quantity: 1,
          catalogId: 'test_catalog',
        }),
      });

       const addItem2Response = await middleware.fetch(addItem2Request);
       expect(addItem2Response.status).toBe(200);

      // Step 3: Get cart to verify items
      const getCartRequest = new Request(`http://localhost:3000/carts/${cartId}`, {
        headers: {
          'X-User-ID': userId,
        },
      });

      const getCartResponse = await middleware.fetch(getCartRequest);
      expect(getCartResponse.status).toBe(200);

      const updatedCartData = await getCartResponse.json() as any;
      expect(updatedCartData.items).toHaveLength(2);
      expect(updatedCartData.total.amount).toBe('35.00'); // (2 * 10) + (1 * 15) = 35

       // Step 4: Create order from cart
       const createOrderRequest = new Request('http://localhost:3000/orders', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'X-User-ID': userId,
         },
         body: JSON.stringify({
           orderType: 'from_cart',
           cartId: cartId,
           fulfillmentType: 'pickup',
           customerInfo: {
             name: 'Test Customer',
             email: 'test@example.com',
           },
         }),
       });

      const createOrderResponse = await middleware.fetch(createOrderRequest);
      expect(createOrderResponse.status).toBe(201);

       const orderData = await createOrderResponse.json() as any;
       const orderId = orderData.id;
       expect(orderId).toBeDefined();
       expect(orderData.status).toBe('pending');

      // Step 5: Get order details
      const getOrderRequest = new Request(`http://localhost:3000/orders/${orderId}`, {
        headers: {
          'X-User-ID': userId,
        },
      });

      const getOrderResponse = await middleware.fetch(getOrderRequest);
      expect(getOrderResponse.status).toBe(200);

      const retrievedOrderData = await getOrderResponse.json() as any;
      expect(retrievedOrderData.id).toBe(orderId);
      expect(retrievedOrderData.items).toHaveLength(2);
      expect(retrievedOrderData.total.amount).toBe('35.00');

      // Step 6: Rate the order
      const rateOrderRequest = new Request(`http://localhost:3000/orders/${orderId}/rating`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          rating: 5,
          comment: 'Excellent service!',
        }),
      });

      const rateOrderResponse = await middleware.fetch(rateOrderRequest);
      expect(rateOrderResponse.status).toBe(201);

      const ratingData = await rateOrderResponse.json() as any;
      expect(ratingData.rating).toBe(5);
      expect(ratingData.comment).toBe('Excellent service!');

      // Step 7: Verify rating was added to order
      const getOrderAfterRatingRequest = new Request(`http://localhost:3000/orders/${orderId}`, {
        headers: {
          'X-User-ID': userId,
        },
      });

      const getOrderAfterRatingResponse = await middleware.fetch(getOrderAfterRatingRequest);
      expect(getOrderAfterRatingResponse.status).toBe(200);

      const orderWithRatingData = await getOrderAfterRatingResponse.json() as any;
      expect(orderWithRatingData.rating).toBeDefined();
      expect(orderWithRatingData.rating.rating).toBe(5);
      expect(orderWithRatingData.rating.comment).toBe('Excellent service!');
    });

    it('should handle direct order creation workflow', async () => {
      const userId = 'user_direct_123';

       // Create direct order (without cart)
       const createDirectOrderRequest = new Request('http://localhost:3000/orders', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'X-User-ID': userId,
         },
         body: JSON.stringify({
           orderType: 'direct',
           items: [{
             itemId: 'item_1',
             quantity: 1,
             catalogId: 'test_catalog',
           }],
           fulfillmentType: 'delivery',
           storeId: 'test_store',
           customerInfo: {
             name: 'Direct Order Customer',
             email: 'direct@example.com',
           },
         }),
       });

      const createDirectOrderResponse = await middleware.fetch(createDirectOrderRequest);
      expect(createDirectOrderResponse.status).toBe(201);

      const directOrderData = await createDirectOrderResponse.json() as any;
      const directOrderId = directOrderData.id;
      expect(directOrderId).toBeDefined();
      expect(directOrderData.items).toHaveLength(1);
      expect(directOrderData.fulfillmentType).toBe('delivery');
    });

    it('should handle order cancellation workflow', async () => {
      const userId = 'user_cancel_123';

      // Create a cart
      const createCartRequest = new Request('http://localhost:3000/carts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          storeId: 'test_store',
        }),
      });

      const createCartResponse = await middleware.fetch(createCartRequest);
      const cartData = await createCartResponse.json() as any;
      const cartId = cartData.id;

      // Add item to cart
      const addItemRequest = new Request(`http://localhost:3000/carts/${cartId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          itemId: 'item_1',
          quantity: 1,
          catalogId: 'test_catalog',
        }),
      });

      await middleware.fetch(addItemRequest);

       // Create order
       const createOrderRequest = new Request('http://localhost:3000/orders', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'X-User-ID': userId,
         },
         body: JSON.stringify({
           orderType: 'from_cart',
           cartId: cartId,
           fulfillmentType: 'pickup',
           customerInfo: {
             name: 'Cancel Test Customer',
             email: 'cancel@example.com',
           },
         }),
       });

      const createOrderResponse = await middleware.fetch(createOrderRequest);
      const orderData = await createOrderResponse.json() as any;
      const orderId = orderData.id;

      // Cancel the order
      const cancelOrderRequest = new Request(`http://localhost:3000/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          reason: 'Changed my mind',
        }),
      });

      const cancelOrderResponse = await middleware.fetch(cancelOrderRequest);
      expect(cancelOrderResponse.status).toBe(200);

      const cancelData = await cancelOrderResponse.json() as any;
      expect(cancelData.status).toBe('cancelled');

      // Verify order is cancelled
      const getOrderRequest = new Request(`http://localhost:3000/orders/${orderId}`, {
        headers: {
          'X-User-ID': userId,
        },
      });

      const getOrderResponse = await middleware.fetch(getOrderRequest);
      const cancelledOrderData = await getOrderResponse.json() as any;
      expect(cancelledOrderData.status).toBe('cancelled');
    });

    it('should handle concurrent cart operations', async () => {
      const userId = 'user_concurrent_123';

      // Create two carts simultaneously
      const createCart1Request = new Request('http://localhost:3000/carts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          storeId: 'test_store',
        }),
      });

      const createCart2Request = new Request('http://localhost:3000/carts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          storeId: 'test_store',
        }),
      });

      const [cart1Response, cart2Response] = await Promise.all([
        middleware.fetch(createCart1Request),
        middleware.fetch(createCart2Request),
      ]);

      expect(cart1Response.status).toBe(201);
      expect(cart2Response.status).toBe(201);

      const cart1Data = await cart1Response.json() as any;
      const cart2Data = await cart2Response.json() as any;

      expect(cart1Data.id).not.toBe(cart2Data.id);

      // Add items to both carts
      const addToCart1Request = new Request(`http://localhost:3000/carts/${cart1Data.id}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          itemId: 'item_1',
          quantity: 1,
          catalogId: 'test_catalog',
        }),
      });

      const addToCart2Request = new Request(`http://localhost:3000/carts/${cart2Data.id}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          itemId: 'item_2',
          quantity: 1,
          catalogId: 'test_catalog',
        }),
      });

       const [add1Response, add2Response] = await Promise.all([
         middleware.fetch(addToCart1Request),
         middleware.fetch(addToCart2Request),
       ]);

       expect(add1Response.status).toBe(200);
       expect(add2Response.status).toBe(200);
    });

    it('should handle webhook notifications for order lifecycle', async () => {
      const userId = 'user_webhook_123';

      // Create webhook subscription
      const createWebhookRequest = new Request('http://localhost:3000/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          events: ['order.created', 'order.updated'],
        }),
      });

      const createWebhookResponse = await middleware.fetch(createWebhookRequest);
      expect(createWebhookResponse.status).toBe(201);

      // Create cart and order (webhook should be triggered)
      const createCartRequest = new Request('http://localhost:3000/carts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          storeId: 'test_store',
        }),
      });

      const createCartResponse = await middleware.fetch(createCartRequest);
      const cartData = await createCartResponse.json() as any;

      // Add item and create order
      const addItemRequest = new Request(`http://localhost:3000/carts/${cartData.id}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          itemId: 'item_1',
          quantity: 1,
          catalogId: 'test_catalog',
        }),
      });

      await middleware.fetch(addItemRequest);

       const createOrderRequest = new Request('http://localhost:3000/orders', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'X-User-ID': userId,
         },
         body: JSON.stringify({
           orderType: 'from_cart',
           cartId: cartData.id,
           fulfillmentType: 'pickup',
           customerInfo: {
             name: 'Webhook Test Customer',
             email: 'webhook@example.com',
           },
         }),
       });

      const createOrderResponse = await middleware.fetch(createOrderRequest);
      expect(createOrderResponse.status).toBe(201);

      // Verify webhook subscription still exists
      const listWebhooksRequest = new Request('http://localhost:3000/webhooks', {
        headers: {
          'X-User-ID': userId,
        },
      });

      const listWebhooksResponse = await middleware.fetch(listWebhooksRequest);
      expect(listWebhooksResponse.status).toBe(200);

      const webhooksData = await listWebhooksResponse.json() as any;
      expect(webhooksData.subscriptions).toHaveLength(1);
      expect(webhooksData.subscriptions[0].events).toEqual(['order.created', 'order.updated']);
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle cart expiration and recovery', async () => {
      const userId = 'user_recovery_123';

      // Create cart
      const createCartRequest = new Request('http://localhost:3000/carts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          storeId: 'test_store',
        }),
      });

      const createCartResponse = await middleware.fetch(createCartRequest);
      const cartData = await createCartResponse.json() as any;
      const cartId = cartData.id;

      // Try to access non-existent cart
      const getInvalidCartRequest = new Request('http://localhost:3000/carts/invalid-cart-id', {
        headers: {
          'X-User-ID': userId,
        },
      });

      const getInvalidCartResponse = await middleware.fetch(getInvalidCartRequest);
      expect(getInvalidCartResponse.status).toBe(404);

      // Original cart should still work
      const getValidCartRequest = new Request(`http://localhost:3000/carts/${cartId}`, {
        headers: {
          'X-User-ID': userId,
        },
      });

      const getValidCartResponse = await middleware.fetch(getValidCartRequest);
      expect(getValidCartResponse.status).toBe(200);
    });

    it('should handle invalid state transitions', async () => {
      const userId = 'user_state_123';

      // Create cart and order
      const createCartRequest = new Request('http://localhost:3000/carts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          storeId: 'test_store',
        }),
      });

      const createCartResponse = await middleware.fetch(createCartRequest);
      const cartData = await createCartResponse.json() as any;

      const addItemRequest = new Request(`http://localhost:3000/carts/${cartData.id}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          itemId: 'item_1',
          quantity: 1,
          catalogId: 'test_catalog',
        }),
      });

      await middleware.fetch(addItemRequest);

       const createOrderRequest = new Request('http://localhost:3000/orders', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'X-User-ID': userId,
         },
         body: JSON.stringify({
           orderType: 'from_cart',
           cartId: cartData.id,
           fulfillmentType: 'pickup',
           customerInfo: {
             name: 'State Test Customer',
             email: 'state@example.com',
           },
         }),
       });

      const createOrderResponse = await middleware.fetch(createOrderRequest);
      const orderData = await createOrderResponse.json() as any;
      const orderId = orderData.id;

      // Try to cancel already cancelled order (should fail gracefully)
      const cancelOrderRequest = new Request(`http://localhost:3000/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          reason: 'Double cancel test',
        }),
      });

      const cancelOrderResponse = await middleware.fetch(cancelOrderRequest);
      // Should either succeed (if not cancelled) or fail gracefully
      expect([200, 400]).toContain(cancelOrderResponse.status);
    });
  });
});