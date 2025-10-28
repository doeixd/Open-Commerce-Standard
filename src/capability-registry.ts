// OCP Capability Registry - Reference Implementation
// Open Commerce Protocol v1.0.0-rc.1

import { Hono } from 'hono';
import type {
  Capability,
  OcpCapabilitiesConfig,
} from './types';
import { createCartCapability, processCartMetadata, validateCartMetadata } from './capabilities/cart';
import { createDirectOrderCapability, processDirectOrderMetadata, validateDirectOrderMetadata } from './capabilities/direct-order';
import { createProductVariantsCapability, processProductVariantsMetadata, validateProductVariantsMetadata } from './capabilities/product-variants';
import { createI18nCapability, processI18nMetadata, validateI18nMetadata } from './capabilities/i18n';
import { createResourceVersioningCapability, processResourceVersioningMetadata, validateResourceVersioningMetadata } from './capabilities/resource-versioning';
import { StoreInfoCapability } from './capabilities/store-info';
import { ProductSearchCapability } from './capabilities/product-search';
import { ProductRichInfoCapability } from './capabilities/product-rich-info';
import { AuthFlowsCapability } from './capabilities/auth-flows';
import { UserProfileCapability } from './capabilities/user-profile';

/**
 * Capability implementation interface
 */
export interface CapabilityImplementation {
  id: string;
  version: string;
  schemaUrl?: string;
  routes?: Hono;
  middleware?: (config: any) => any;
  validators?: Record<string, (data: any) => boolean>;
  metadataProcessors?: Record<string, (metadata: any) => any>;
}

/**
 * Registry for managing OCP capability implementations
 */
export class CapabilityRegistry {
  private implementations = new Map<string, CapabilityImplementation>();
  private config: OcpCapabilitiesConfig;

  constructor(config: OcpCapabilitiesConfig) {
    this.config = config;
  }

  /**
   * Register a capability implementation
   */
  register(implementation: CapabilityImplementation): void {
    this.implementations.set(implementation.id, implementation);
  }

  /**
   * Get a capability implementation by ID
   */
  get(id: string): CapabilityImplementation | undefined {
    return this.implementations.get(id);
  }

  /**
   * Check if a capability is enabled in the configuration
   */
  isEnabled(id: string): boolean {
    const capabilityKey = this.getCapabilityKey(id);
    if (!capabilityKey) return false;

    const config = (this.config as any)[capabilityKey];
    return config?.enabled === true;
  }

  /**
   * Get the configuration for a specific capability
   */
  getConfig<T>(id: string): T | undefined {
    const capabilityKey = this.getCapabilityKey(id);
    if (!capabilityKey) return undefined;

    const configValue = (this.config as Record<string, unknown>)[capabilityKey];
    if (configValue === undefined) return undefined;
    return configValue as T;
  }

  /**
   * Get all enabled capabilities as Capability objects
   */
  getEnabledCapabilities(): Capability[] {
    const capabilities: Capability[] = [];

    for (const [id, implementation] of this.implementations) {
      if (this.isEnabled(id)) {
        const config = this.getConfig(id);
        capabilities.push({
          id: `${id}@${implementation.version}`,
          schemaUrl: implementation.schemaUrl,
          status: 'stable',
          metadata: config || {},
        });
      }
    }

    return capabilities;
  }

  /**
   * Get routes for all enabled capabilities
   */
  getRoutes(): Hono {
    const router = new Hono();

    for (const [id, implementation] of this.implementations) {
      if (this.isEnabled(id) && implementation.routes) {
        router.route('/', implementation.routes);
      }
    }

    return router;
  }

  /**
   * Validate metadata against capability schemas
   */
  validateMetadata(capabilityId: string, metadata: any): boolean {
    const implementation = this.get(capabilityId);
    if (!implementation?.validators) return true;

    const validator = implementation.validators[capabilityId];
    if (!validator) return true;

    try {
      return validator(metadata);
    } catch {
      return false;
    }
  }

  /**
   * Process metadata through capability processors
   */
  processMetadata(capabilityId: string, metadata: any): any {
    const implementation = this.get(capabilityId);
    if (!implementation?.metadataProcessors) return metadata;

    const processor = implementation.metadataProcessors[capabilityId];
    if (!processor) return metadata;

    try {
      return processor(metadata);
    } catch {
      return metadata;
    }
  }

  /**
   * Map capability ID to configuration key
   */
  private getCapabilityKey(capabilityId: string): string | null {
    const mappings: Record<string, string> = {
      'dev.ocp.cart': 'cart',
      'dev.ocp.order.direct': 'directOrder',
      'dev.ocp.product.variants': 'productVariants',
      'dev.ocp.product.search': 'productSearch',
      'dev.ocp.product.rich_info': 'productRichInfo',
      'dev.ocp.auth.flows': 'authFlows',
      'dev.ocp.order.delivery_tracking': 'deliveryTracking',
      'dev.ocp.order.shipment_tracking': 'shipmentTracking',
      'dev.ocp.order.detailed_status': 'detailedStatus',
      'dev.ocp.order.tipping': 'tipping',
      'dev.ocp.store.info': 'storeInfo',
      'dev.ocp.restaurant.profile': 'restaurantProfile',
      'dev.ocp.promotions.discoverable': 'promotions',
      'dev.ocp.payment.x402_fiat': 'payment',
      'dev.ocp.i18n': 'i18n',
      'dev.ocp.resource.versioning': 'resourceVersioning',
      'dev.ocp.user.profile': 'userProfile',
      'dev.ocp.service.scheduling': 'scheduling',
      'dev.ocp.order.kitchen_status': 'kitchenStatus',
    };

    return mappings[capabilityId] || null;
  }
}

/**
 * Create and configure the capability registry
 */
export function createCapabilityRegistry(config: OcpCapabilitiesConfig): CapabilityRegistry {
  const registry = new CapabilityRegistry(config);

  // Register core capability implementations
  registry.register({
    id: 'dev.ocp.cart',
    version: '1.0',
    schemaUrl: 'https://schemas.ocp.dev/cart/v1.json',
    routes: createCartCapability(config.cart!),
    validators: {
      'dev.ocp.cart@1.0': validateCartMetadata,
    },
    metadataProcessors: {
      'dev.ocp.cart@1.0': processCartMetadata,
    },
  });

  registry.register({
    id: 'dev.ocp.order.direct',
    version: '1.0',
    schemaUrl: 'https://schemas.ocp.dev/order/direct/v1.json',
    routes: createDirectOrderCapability(config.directOrder!),
    validators: {
      'dev.ocp.order.direct@1.0': validateDirectOrderMetadata,
    },
    metadataProcessors: {
      'dev.ocp.order.direct@1.0': processDirectOrderMetadata,
    },
  });

  registry.register({
    id: 'dev.ocp.product.variants',
    version: '1.0',
    schemaUrl: 'https://schemas.ocp.dev/product/variants/v1.json',
    routes: createProductVariantsCapability(config.productVariants!),
    validators: {
      'dev.ocp.product.variants@1.0': validateProductVariantsMetadata,
    },
    metadataProcessors: {
      'dev.ocp.product.variants@1.0': processProductVariantsMetadata,
    },
  });

  registry.register({
    id: 'dev.ocp.product.search',
    version: '1.0',
    schemaUrl: 'https://schemas.ocp.dev/product/search/v1.json',
    routes: createProductSearchCapability(config.productSearch!),
  });

  registry.register({
    id: 'dev.ocp.product.rich_info',
    version: '1.0',
    schemaUrl: 'https://schemas.ocp.dev/product/rich_info/v1.json',
    routes: createProductRichInfoCapability(config.productRichInfo!),
  });

  registry.register({
    id: 'dev.ocp.auth.flows',
    version: '1.0',
    schemaUrl: 'https://schemas.ocp.dev/auth/flows/v1.json',
    routes: createAuthFlowsCapability(config.authFlows!),
  });

  registry.register({
    id: 'dev.ocp.order.delivery_tracking',
    version: '1.0',
    schemaUrl: 'https://schemas.ocp.dev/order/delivery_tracking/v1.json',
  });

  registry.register({
    id: 'dev.ocp.order.shipment_tracking',
    version: '1.0',
    schemaUrl: 'https://schemas.ocp.dev/order/shipment_tracking/v1.json',
  });

  registry.register({
    id: 'dev.ocp.order.detailed_status',
    version: '1.0',
    schemaUrl: 'https://schemas.ocp.dev/order/detailed_status/v1.json',
  });

  registry.register({
    id: 'dev.ocp.order.tipping',
    version: '1.0',
    schemaUrl: 'https://schemas.ocp.dev/order/tipping/v1.json',
  });

  registry.register({
    id: 'dev.ocp.store.info',
    version: '1.0',
    schemaUrl: 'https://schemas.ocp.dev/store/info/v1.json',
    routes: createStoreInfoCapability(config.storeInfo!),
  });

  registry.register({
    id: 'dev.ocp.restaurant.profile',
    version: '1.0',
    schemaUrl: 'https://schemas.ocp.dev/restaurant/profile/v1.json',
  });

  registry.register({
    id: 'dev.ocp.promotions.discoverable',
    version: '1.0',
    schemaUrl: 'https://schemas.ocp.dev/promotions/discoverable/v1.json',
  });

  registry.register({
    id: 'dev.ocp.payment.x402_fiat',
    version: '1.0',
    schemaUrl: 'https://schemas.ocp.dev/payment/x402_fiat/v1.json',
  });

  registry.register({
    id: 'dev.ocp.i18n',
    version: '1.0',
    schemaUrl: 'https://schemas.ocp.dev/i18n/v1.json',
    routes: createI18nCapability(config.i18n!),
    validators: {
      'dev.ocp.i18n@1.0': validateI18nMetadata,
    },
    metadataProcessors: {
      'dev.ocp.i18n@1.0': processI18nMetadata,
    },
  });

  registry.register({
    id: 'dev.ocp.resource.versioning',
    version: '1.0',
    schemaUrl: 'https://schemas.ocp.dev/resource/versioning/v1.json',
    routes: createResourceVersioningCapability(config.resourceVersioning!),
    validators: {
      'dev.ocp.resource.versioning@1.0': validateResourceVersioningMetadata,
    },
    metadataProcessors: {
      'dev.ocp.resource.versioning@1.0': processResourceVersioningMetadata,
    },
  });

  registry.register({
    id: 'dev.ocp.user.profile',
    version: '1.0',
    schemaUrl: 'https://schemas.ocp.dev/user/profile/v1.json',
    routes: createUserProfileCapability(config.userProfile!),
  });

  registry.register({
    id: 'dev.ocp.service.scheduling',
    version: '1.0',
    schemaUrl: 'https://schemas.ocp.dev/service/scheduling/v1.json',
  });

  registry.register({
    id: 'dev.ocp.order.kitchen_status',
    version: '1.0',
    schemaUrl: 'https://schemas.ocp.dev/restaurant/kitchen_status/v1.json',
  });

  return registry;
}

/**
 * Factory functions for new capabilities
 */
export function createStoreInfoCapability(config: any) {
  const capability = new StoreInfoCapability(config);
  const routes = new Hono();

  routes.get('/stores/:storeId/info', async (c) => {
    const storeId = c.req.param('storeId');
    const { config: ocpConfig } = c.var.ocp;

    const storeInfo = await capability.getStoreInfo(storeId, ocpConfig.stores || []);
    if (!storeInfo) {
      return c.json({ error: 'Store not found' }, 404);
    }

    return c.json(storeInfo);
  });

  return routes;
}

export function createProductSearchCapability(config: any) {
  const capability = new ProductSearchCapability(config);
  const routes = new Hono();

  routes.get('/products/search', async (c) => {
    const query = c.req.query('q') || '';
    const sortBy = c.req.query('sort');
    const { config: ocpConfig } = c.var.ocp;

    const results = await capability.searchProducts(query, sortBy, ocpConfig.catalogs || []);
    return c.json({ results });
  });

  routes.get('/capabilities/dev.ocp.product.search@1.0', async (c) => {
    return c.json(capability.getSearchConfig());
  });

  return routes;
}

export function createProductRichInfoCapability(config: any) {
  const capability = new ProductRichInfoCapability(config);
  const routes = new Hono();

  routes.get('/products/:productId/rich-info', async (c) => {
    const productId = c.req.param('productId');
    const { config: ocpConfig } = c.var.ocp;

    const richInfo = await capability.getProductRichInfo(productId, ocpConfig.catalogs || []);
    if (!richInfo) {
      return c.json({ error: 'Product not found' }, 404);
    }

    return c.json(richInfo);
  });

  routes.put('/products/:productId/rich-info', async (c) => {
    const productId = c.req.param('productId');
    const updates = await c.req.json();
    const { config: ocpConfig } = c.var.ocp;

    const result = await capability.updateProductRichInfo(productId, updates, ocpConfig.catalogs || []);
    if (!result) {
      return c.json({ error: 'Product not found' }, 404);
    }

    return c.json(result.richInfo);
  });

  return routes;
}

export function createAuthFlowsCapability(config: any) {
  const capability = new AuthFlowsCapability(config);
  const routes = new Hono();

  routes.get('/capabilities/dev.ocp.auth.flows@1.0', async (c) => {
    return c.json(capability.getAuthConfig());
  });

  routes.get('/auth/providers', async (c) => {
    return c.json({
      providers: capability.getOAuth2Providers()
    });
  });

  return routes;
}

export function createUserProfileCapability(config: any) {
  const capability = new UserProfileCapability(config);
  const routes = new Hono();

  routes.get('/users/:userId/profile', async (c) => {
    const userId = c.req.param('userId');

    const profile = await capability.getUserProfile(userId);
    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    return c.json(profile);
  });

  routes.put('/users/:userId/profile', async (c) => {
    const userId = c.req.param('userId');
    const updates = await c.req.json();

    const profile = await capability.updateUserProfile(userId, updates);
    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    return c.json(profile);
  });

  routes.post('/users/:userId/profile/addresses', async (c) => {
    const userId = c.req.param('userId');
    const address = await c.req.json();

    const profile = await capability.addSavedAddress(userId, address);
    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    return c.json(profile);
  });

  routes.delete('/users/:userId/profile/addresses/:index', async (c) => {
    const userId = c.req.param('userId');
    const index = parseInt(c.req.param('index'));

    const profile = await capability.removeSavedAddress(userId, index);
    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }

    return c.json(profile);
  });

  return routes;
}