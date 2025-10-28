// Comprehensive Webhook Management Tests
// Tests for robustness and OCP compliance

import { describe, it, expect, beforeEach } from 'vitest';
import { createOcpMiddleware } from './middleware';

describe('Webhook Management', () => {
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
        price: { amount: '10.00', currency: 'USD' },
        available: true,
        fulfillmentType: 'pickup' as const,
      }],
    }],
    enableWebhooks: true,
  };

  let middleware: any;

  beforeEach(() => {
    middleware = createOcpMiddleware(config);
  });

  describe('POST /webhooks - Create Webhook Subscription', () => {
    it('should create webhook subscription successfully', async () => {
      const request = new Request('http://localhost:3000/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          events: ['order.created', 'order.updated'],
          description: 'Test webhook',
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(201);

      const data = await response.json() as any;
      expect(data.id).toBeDefined();
      expect(data.url).toBe('https://example.com/webhook');
      expect(data.events).toEqual(['order.created', 'order.updated']);
      expect(data.description).toBe('Test webhook');
      expect(data.secret).toBeDefined();
      expect(data.createdAt).toBeDefined();
      expect(response.headers.get('Content-Type')).toBe('application/ocp+json; version=1.0');
    });

    it('should fail without authentication', async () => {
      const request = new Request('http://localhost:3000/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          events: ['order.created'],
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(401);
    });

    it('should fail with invalid URL', async () => {
      const request = new Request('http://localhost:3000/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          url: 'not-a-valid-url',
          events: ['order.created'],
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(400);

      const data = await response.json() as any;
      expect(data.type).toContain('bad-request');
      expect(data.errors).toBeDefined();
    });

    it('should fail with missing URL', async () => {
      const request = new Request('http://localhost:3000/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          events: ['order.created'],
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(400);

      const data = await response.json() as any;
      expect(data.type).toContain('bad-request');
      expect(data.errors[0].field).toBe('url');
    });

    it('should fail with empty events array', async () => {
      const request = new Request('http://localhost:3000/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          events: [],
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(400);

      const data = await response.json() as any;
      expect(data.type).toContain('bad-request');
      expect(data.errors[0].field).toBe('events');
    });

    it('should fail with unsupported events', async () => {
      const request = new Request('http://localhost:3000/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          events: ['order.created', 'unsupported.event'],
        }),
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(400);

      const data = await response.json() as any;
      expect(data.type).toContain('bad-request');
      expect(data.errors[0].reason).toContain('Unsupported event types');
    });

    it('should fail when webhooks are disabled', async () => {
      const disabledConfig = { ...config, enableWebhooks: false };
      const disabledMiddleware = createOcpMiddleware(disabledConfig);

      const request = new Request('http://localhost:3000/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          events: ['order.created'],
        }),
      });

      const response = await disabledMiddleware.fetch(request);
      expect(response.status).toBe(404);
    });

    it('should fail with malformed JSON', async () => {
      const request = new Request('http://localhost:3000/webhooks', {
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

  describe('GET /webhooks - List Webhook Subscriptions', () => {
    beforeEach(async () => {
      // Create a webhook subscription
      const createRequest = new Request('http://localhost:3000/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          events: ['order.created'],
        }),
      });

      await middleware.fetch(createRequest);
    });

    it('should list webhook subscriptions successfully', async () => {
      const request = new Request('http://localhost:3000/webhooks', {
        headers: {
          'X-User-ID': 'user_123',
        },
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json() as any;
      expect(data.subscriptions).toBeDefined();
      expect(Array.isArray(data.subscriptions)).toBe(true);
      expect(data.subscriptions.length).toBeGreaterThan(0);
      expect(data.subscriptions[0].url).toBe('https://example.com/webhook');
      expect(data.subscriptions[0].events).toEqual(['order.created']);
      expect(response.headers.get('Content-Type')).toBe('application/ocp+json; version=1.0');
    });

    it('should return empty list when no webhooks exist for user', async () => {
      const request = new Request('http://localhost:3000/webhooks', {
        headers: {
          'X-User-ID': 'different_user',
        },
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json() as any;
      expect(data.subscriptions).toEqual([]);
    });

    it('should fail without authentication', async () => {
      const request = new Request('http://localhost:3000/webhooks');

      const response = await middleware.fetch(request);
      expect(response.status).toBe(401);
    });
  });

  describe('GET /webhooks/{webhookId} - Get Webhook Subscription', () => {
    let webhookId: string;

    beforeEach(async () => {
      // Create a webhook subscription
      const createRequest = new Request('http://localhost:3000/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          events: ['order.created'],
        }),
      });

      const createResponse = await middleware.fetch(createRequest);
      const data = await createResponse.json() as any;
      webhookId = data.id;
    });

    it('should get webhook subscription successfully', async () => {
      const request = new Request(`http://localhost:3000/webhooks/${webhookId}`, {
        headers: {
          'X-User-ID': 'user_123',
        },
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(200);

      const data = await response.json() as any;
      expect(data.id).toBe(webhookId);
      expect(data.url).toBe('https://example.com/webhook');
      expect(data.events).toEqual(['order.created']);
      expect(data.secret).toBeUndefined(); // Secret should not be returned for security
      expect(response.headers.get('Content-Type')).toBe('application/ocp+json; version=1.0');
    });

    it('should fail with invalid webhook ID', async () => {
      const request = new Request('http://localhost:3000/webhooks/invalid-webhook', {
        headers: {
          'X-User-ID': 'user_123',
        },
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(404);

      const data = await response.json() as any;
      expect(data.type).toContain('not-found');
    });

    it('should fail without authentication', async () => {
      const request = new Request(`http://localhost:3000/webhooks/${webhookId}`);

      const response = await middleware.fetch(request);
      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /webhooks/{webhookId} - Delete Webhook Subscription', () => {
    let webhookId: string;

    beforeEach(async () => {
      // Create a webhook subscription
      const createRequest = new Request('http://localhost:3000/webhooks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': 'user_123',
        },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          events: ['order.created'],
        }),
      });

      const createResponse = await middleware.fetch(createRequest);
      const data = await createResponse.json() as any;
      webhookId = data.id;
    });

    it('should delete webhook subscription successfully', async () => {
      const request = new Request(`http://localhost:3000/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: {
          'X-User-ID': 'user_123',
        },
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(204);

      // Verify it's deleted by trying to get it
      const getRequest = new Request(`http://localhost:3000/webhooks/${webhookId}`, {
        headers: {
          'X-User-ID': 'user_123',
        },
      });

      const getResponse = await middleware.fetch(getRequest);
      expect(getResponse.status).toBe(404);
    });

    it('should fail with invalid webhook ID', async () => {
      const request = new Request('http://localhost:3000/webhooks/invalid-webhook', {
        method: 'DELETE',
        headers: {
          'X-User-ID': 'user_123',
        },
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(404);
    });

    it('should fail without authentication', async () => {
      const request = new Request(`http://localhost:3000/webhooks/${webhookId}`, {
        method: 'DELETE',
      });

      const response = await middleware.fetch(request);
      expect(response.status).toBe(401);
    });
  });
});