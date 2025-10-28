// Example usage of the OCP Core Middleware with Hono

import { Hono } from 'hono';
import { createOcpMiddleware } from '../src/index';

// Create main Hono app
const app = new Hono();

// Sample configuration for the OCP middleware
const ocpConfig = {
  baseUrl: 'http://localhost:3000',
  stores: [
    {
      id: 'store_123',
      name: 'Sample Restaurant',
      location: {
        address: '123 Main St, Anytown, USA',
        latitude: 40.7128,
        longitude: -74.0060,
      },
      catalogIds: ['catalog_456'],
    },
  ],
  catalogs: [
    {
      id: 'catalog_456',
      name: 'Main Menu',
      version: '1.0',
      items: [
        {
          id: 'item_1',
          name: 'Margherita Pizza',
          description: 'Classic pizza with tomato sauce, mozzarella, and basil',
          price: { amount: '12.99', currency: 'USD' },
          available: true,
          fulfillmentType: 'pickup',
        },
        {
          id: 'item_2',
          name: 'Caesar Salad',
          description: 'Crisp romaine lettuce with Caesar dressing',
          price: { amount: '8.99', currency: 'USD' },
          available: true,
          fulfillmentType: 'pickup',
        },
      ],
    },
  ],
  capabilities: [
    {
      id: 'dev.ocp.cart@1.0',
      schemaUrl: 'https://schemas.ocp.dev/cart/v1.json',
      status: 'stable',
    },
  ],
};

// Create OCP middleware instance
const ocpMiddleware = createOcpMiddleware(ocpConfig);

// Mount OCP routes under /api/v1
app.route('/api/v1', ocpMiddleware);

// Add authentication middleware (example)
app.use('/api/v1/*', async (c, next) => {
  // Simple auth check - in production, validate JWT tokens
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({
      type: 'https://schemas.ocp.dev/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Valid authorization token required',
      timestamp: new Date().toISOString(),
    }, 401);
  }

  // Set user ID for OCP context
  c.set('ocp', {
    ...c.var.ocp,
    userId: 'user_123', // Extract from token in production
  });

  await next();
});

// Add any additional routes your app needs
app.get('/', (c) => {
  return c.text('OCP Server is running! Visit /api/v1/.well-known/ocp for discovery.');
});

// Start server
export default {
  port: 3000,
  fetch: app.fetch,
};

// For development
if (import.meta.main) {
  console.log(`
╔════════════════════════════════════════════════════════╗
║   🚀 OCP Hono Server Example                           ║
╟────────────────────────────────────────────────────────╢
║   Discovery:     http://localhost:3000/api/v1/.well-known/ocp ║
║   Capabilities:  http://localhost:3000/api/v1/capabilities    ║
║   Catalog:       http://localhost:3000/api/v1/catalogs/catalog_456 ║
╟────────────────────────────────────────────────────────╢
║   Example requests:                                     ║
║   curl http://localhost:3000/api/v1/.well-known/ocp     ║
║   curl http://localhost:3000/api/v1/capabilities        ║
╚════════════════════════════════════════════════════════╝
  `);
}