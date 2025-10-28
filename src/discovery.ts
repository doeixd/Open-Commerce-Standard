// OCP Discovery Endpoints Implementation

import { Hono } from 'hono';
import type { OcpDiscoveryResponse, CapabilitiesResponse, StoresResponse, CatalogsResponse, ProductVariantsCapabilityConfig } from './types';
import { OCP_ERRORS } from './errors';
import { enrichCatalogWithVariants } from './capabilities/product-variants';

// Discovery routes
export function createDiscoveryRoutes() {
  const discovery = new Hono();

  // /.well-known/ocp - OCP Discovery Endpoint (RFC 8615)
  discovery.get('/.well-known/ocp', async (c) => {
    const { config } = c.var.ocp;

    if (!config.baseUrl) {
      throw new Error('baseUrl is required in OCP config for discovery endpoint');
    }

    const response: OcpDiscoveryResponse = {
      OCP: {
        capabilities: `${config.baseUrl}/capabilities`,
        version: config.version || '1.0.0',
        context: 'https://schemas.ocp.dev/context.jsonld',
        payment: config.capabilities?.some(cap => cap.id.includes('payment'))
          ? `${config.baseUrl}/payment`
          : undefined,
      },
    };

    return c.json(response, {
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  // /capabilities - Server Capabilities
  discovery.get('/capabilities', async (c) => {
    const { config, capabilityRegistry } = c.var.ocp;

    // Combine static capabilities with dynamically enabled ones
    const staticCapabilities = config.capabilities || [];
    const dynamicCapabilities = capabilityRegistry.getEnabledCapabilities();

    const response: CapabilitiesResponse = {
      capabilities: [...staticCapabilities, ...dynamicCapabilities],
    };

    return c.json(response, {
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  // /stores - List available stores
  discovery.get('/stores', async (c) => {
    const { config } = c.var.ocp;

    const limit = parseInt(c.req.query('limit') || '20');
    const cursor = c.req.query('cursor');

    // Simple pagination simulation
    const stores = (config.stores || []).slice(0, limit);

    const response: StoresResponse = {
      stores,
      pagination: {
        limit,
        nextCursor: stores.length === limit ? 'next_page_token' : null,
        previousCursor: cursor || null,
        totalCount: (config.stores || []).length,
      },
    };

    return c.json(response, {
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  // /catalogs - List available catalogs
  discovery.get('/catalogs', async (c) => {
    const { config } = c.var.ocp;

    const limit = parseInt(c.req.query('limit') || '20');
    const cursor = c.req.query('cursor');
    const storeId = c.req.query('storeId');

    let catalogs = config.catalogs || [];
    if (storeId) {
      // Filter catalogs by store
      catalogs = catalogs.filter(catalog =>
        (config.stores || []).find(store => store.id === storeId)?.catalogIds.includes(catalog.id)
      );
    }

    const paginatedCatalogs = catalogs.slice(0, limit);

    const response: CatalogsResponse = {
      catalogs: paginatedCatalogs.map(({ items, ...summary }) => summary),
      pagination: {
        limit,
        nextCursor: paginatedCatalogs.length === limit ? 'next_page_token' : null,
        previousCursor: cursor || null,
        totalCount: catalogs.length,
      },
    };

    return c.json(response, {
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  // /catalogs/{catalogId} - Get full catalog
  discovery.get('/catalogs/:catalogId', async (c) => {
    const { config, capabilityRegistry } = c.var.ocp;
    const catalogId = c.req.param('catalogId');

    // Catalog IDs can be any string, no validation needed

    const catalog = (config.catalogs || []).find(cat => cat.id === catalogId);
    if (!catalog) {
      throw OCP_ERRORS.CATALOG_NOT_FOUND;
    }

    // Enrich catalog with capability-specific data
    let enrichedCatalog = { ...catalog };

    // Add product variants if capability is enabled
    if (capabilityRegistry.isEnabled('dev.ocp.product.variants')) {
      const variantsConfig = capabilityRegistry.getConfig<ProductVariantsCapabilityConfig>('dev.ocp.product.variants');
      if (variantsConfig) {
        enrichedCatalog = enrichCatalogWithVariants(enrichedCatalog, variantsConfig, (c as any).var.locale);
      }
    }

    return c.json(enrichedCatalog, {
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  return discovery;
}