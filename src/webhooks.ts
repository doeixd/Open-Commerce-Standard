// OCP Webhook Management Endpoints Implementation

import { Hono } from 'hono';
import type { WebhookSubscriptionsResponse, CreateWebhookSubscriptionRequest, ErrorDetail } from './types';
import { OCP_ERRORS, validateRequired, validateString } from './errors';

// Webhook routes
export function createWebhookRoutes() {
  const webhooks = new Hono();

  // GET /webhooks - List webhook subscriptions
  webhooks.get('/webhooks', async (c) => {
    const { webhookStorage, userId } = c.var.ocp;

    if (!userId) {
      throw OCP_ERRORS.UNAUTHORIZED;
    }

    if (!webhookStorage) {
      throw OCP_ERRORS.SERVICE_UNAVAILABLE;
    }

    const limit = parseInt(c.req.query('limit') || '20');
    const cursor = c.req.query('cursor');

    const allSubscriptions = await webhookStorage.list(userId);
    const paginatedSubscriptions = allSubscriptions.slice(0, limit);

    const response: WebhookSubscriptionsResponse = {
      subscriptions: paginatedSubscriptions,
      pagination: {
        limit,
        nextCursor: paginatedSubscriptions.length === limit ? 'next_page_token' : null,
        previousCursor: cursor || null,
        totalCount: allSubscriptions.length,
      },
    };

    return c.text(JSON.stringify(response), 200, {
      'Content-Type': 'application/ocp+json; version=1.0',
    });
  });

  // POST /webhooks - Create webhook subscription
  webhooks.post('/webhooks', async (c) => {
    const { webhookStorage, userId } = c.var.ocp;

    if (!userId) {
      throw OCP_ERRORS.UNAUTHORIZED;
    }

    if (!webhookStorage) {
      throw OCP_ERRORS.SERVICE_UNAVAILABLE;
    }

    const body: CreateWebhookSubscriptionRequest = await c.req.json();

    // Validate request
    const errors: ErrorDetail[] = [];
    const urlError = validateRequired(body.url, 'url');
    if (urlError) errors.push(urlError);

    if (!body.events || body.events.length === 0) {
      errors.push({
        type: 'validation' as const,
        field: 'events',
        reason: 'At least one event type is required'
      });
    }

    // Validate URL format (basic check)
    try {
      new URL(body.url);
    } catch {
      errors.push({
        type: 'validation',
        field: 'url',
        value: body.url,
        reason: 'Must be a valid HTTPS URL'
      });
    }

    if (errors.length > 0) {
      throw OCP_ERRORS.VALIDATION_ERROR(errors);
    }

    // Validate events (simplified - in real implementation, check against supported events)
    const supportedEvents = ['order.created', 'order.updated', 'order.cancelled', 'cart.created', 'cart.updated'];
    const invalidEvents = body.events.filter(event => !supportedEvents.includes(event));

    if (invalidEvents.length > 0) {
      throw OCP_ERRORS.VALIDATION_ERROR([{
        type: 'validation' as const,
        field: 'events',
        value: invalidEvents,
        reason: `Unsupported event types: ${invalidEvents.join(', ')}`
      }]);
    }

    // Create subscription
    const subscription = await webhookStorage.create({
      userId,
      url: body.url,
      events: body.events,
      description: body.description,
      active: true,
      metadata: body.metadata,
    });

    return c.text(JSON.stringify(subscription), 201, {
      'Content-Type': 'application/ocp+json; version=1.0',
    });
  });

  // GET /webhooks/{id} - Get webhook subscription by ID
  webhooks.get('/webhooks/:id', async (c) => {
    const { webhookStorage, userId } = c.var.ocp;
    const id = c.req.param('id');

    if (!userId) {
      throw OCP_ERRORS.UNAUTHORIZED;
    }

    if (!webhookStorage) {
      throw OCP_ERRORS.SERVICE_UNAVAILABLE;
    }

    const idError = validateString(id, 'id', { minLength: 1, maxLength: 100 });
    if (idError) {
      throw OCP_ERRORS.VALIDATION_ERROR([idError]);
    }

    const subscription = await webhookStorage.get(id);
    if (!subscription) {
      throw OCP_ERRORS.NOT_FOUND;
    }

    // Remove secret from response for security
    const { secret, ...publicSubscription } = subscription;

    return c.text(JSON.stringify(publicSubscription), 200, {
      'Content-Type': 'application/ocp+json; version=1.0',
    });
  });

  // DELETE /webhooks/{id} - Delete webhook subscription
  webhooks.delete('/webhooks/:id', async (c) => {
    const { webhookStorage, userId } = c.var.ocp;
    const id = c.req.param('id');

    if (!userId) {
      throw OCP_ERRORS.UNAUTHORIZED;
    }

    if (!webhookStorage) {
      throw OCP_ERRORS.SERVICE_UNAVAILABLE;
    }

    const idError = validateString(id, 'id', { minLength: 1, maxLength: 100 });
    if (idError) {
      throw OCP_ERRORS.VALIDATION_ERROR([idError]);
    }

    const deleted = await webhookStorage.delete(id);
    if (!deleted) {
      throw OCP_ERRORS.NOT_FOUND;
    }

    return new Response(null, { status: 204 });
  });

  return webhooks;
}