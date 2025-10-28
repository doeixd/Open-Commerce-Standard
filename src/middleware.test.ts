// Basic tests for OCP middleware

import { describe, it, expect } from 'vitest';
import { createOcpMiddleware } from './middleware';

describe('OCP Middleware', () => {
  const config = {
    baseUrl: 'http://localhost:3000',
    stores: [{
      id: 'test_store',
      name: 'Test Store',
      location: {
        address: '123 Test St',
        latitude: 0,
        longitude: 0,
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
  };

  it('should create middleware instance', () => {
    const middleware = createOcpMiddleware(config);
    expect(middleware).toBeDefined();
    expect(typeof middleware).toBe('object');
    expect(middleware.fetch).toBeDefined();
  });

  it('should handle discovery endpoint', async () => {
    const middleware = createOcpMiddleware(config);
    const request = new Request('http://localhost:3000/.well-known/ocp');
    const response = await middleware.fetch(request);

    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.OCP).toBeDefined();
    expect(data.OCP.capabilities).toBe(`${config.baseUrl}/capabilities`);
  });

  it('should handle capabilities endpoint', async () => {
    const middleware = createOcpMiddleware(config);
    const request = new Request('http://localhost:3000/capabilities');
    const response = await middleware.fetch(request);

    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.capabilities).toBeDefined();
    expect(Array.isArray(data.capabilities)).toBe(true);
  });

  it('should handle stores endpoint', async () => {
    const middleware = createOcpMiddleware(config);
    const request = new Request('http://localhost:3000/stores');
    const response = await middleware.fetch(request);

    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.stores).toBeDefined();
    expect(Array.isArray(data.stores)).toBe(true);
    expect(data.stores.length).toBe(1);
    expect(data.stores[0].id).toBe('test_store');
  });

  it('should handle catalogs endpoint', async () => {
    const middleware = createOcpMiddleware(config);
    const request = new Request('http://localhost:3000/catalogs');
    const response = await middleware.fetch(request);

    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.catalogs).toBeDefined();
    expect(Array.isArray(data.catalogs)).toBe(true);
    expect(data.catalogs.length).toBe(1);
    expect(data.catalogs[0].id).toBe('test_catalog');
  });

  it('should handle catalog by ID endpoint', async () => {
    const middleware = createOcpMiddleware(config);
    const request = new Request('http://localhost:3000/catalogs/test_catalog');
    const response = await middleware.fetch(request);

    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.id).toBe('test_catalog');
    expect(data.items).toBeDefined();
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.items.length).toBe(1);
  });

  it('should return 404 for non-existent catalog', async () => {
    const middleware = createOcpMiddleware(config);
    const request = new Request('http://localhost:3000/catalogs/non-existent');
    const response = await middleware.fetch(request);

    expect(response.status).toBe(404);
    const data = await response.json() as any;
    expect(data.type).toContain('catalog-not-found');
  });
});