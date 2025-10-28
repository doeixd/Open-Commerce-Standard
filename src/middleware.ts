// OCP Core Middleware - Reference Implementation
// Open Commerce Protocol v1.0.0-rc.1

import { Hono } from 'hono';
import type {
  OcpConfig,
  CartStorage,
  OrderStorage,
  WebhookStorage,
  Cart,
  Order,
  WebhookSubscription
} from './types';
import { createErrorHandler, OCP_ERRORS } from './errors';
import { createDiscoveryRoutes } from './discovery';
import { createCartRoutes } from './cart';
import { createOrderRoutes } from './orders';
import { createWebhookRoutes } from './webhooks';
import { createCapabilityRegistry, CapabilityRegistry } from './capability-registry';
import { createMetadataMiddleware } from './metadata-middleware';

// Extend Hono context
declare module 'hono' {
  interface ContextVariableMap {
    ocp: {
      userId?: string;
      cartStorage: CartStorage;
      orderStorage: OrderStorage;
      webhookStorage?: WebhookStorage;
      config: OcpConfig;
      capabilityRegistry: CapabilityRegistry;
    };
    locale?: any;
  }
}

// Default in-memory storage implementations
class InMemoryCartStorage implements CartStorage {
  private carts = new Map<string, Cart>();
  private idCounter = 1;

  async create(cartData: Omit<Cart, 'id' | 'createdAt' | 'updatedAt'>): Promise<Cart> {
    const id = `cart_${this.idCounter++}`;
    const now = new Date().toISOString();
    const cart: Cart = {
      ...cartData,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.carts.set(id, cart);
    return cart;
  }

  async get(id: string): Promise<Cart | null> {
    return this.carts.get(id) || null;
  }

  async update(id: string, updates: Partial<Cart>): Promise<Cart | null> {
    const cart = this.carts.get(id);
    if (!cart) return null;

    const updatedCart = {
      ...cart,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.carts.set(id, updatedCart);
    return updatedCart;
  }

  async delete(id: string): Promise<boolean> {
    return this.carts.delete(id);
  }

  async list(_userId?: string): Promise<Cart[]> {
    return Array.from(this.carts.values());
  }
}

class InMemoryOrderStorage implements OrderStorage {
  private orders = new Map<string, Order>();
  private idCounter = 1;

  async create(orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<Order> {
    const id = `order_${this.idCounter++}`;
    const now = new Date().toISOString();
    const order: Order = {
      ...orderData,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.orders.set(id, order);
    return order;
  }

  async get(id: string): Promise<Order | null> {
    return this.orders.get(id) || null;
  }

  async update(id: string, updates: Partial<Order>): Promise<Order | null> {
    const order = this.orders.get(id);
    if (!order) return null;

    const updatedOrder = {
      ...order,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }

  async delete(id: string): Promise<boolean> {
    return this.orders.delete(id);
  }

  async list(_userId?: string, status?: string): Promise<Order[]> {
    const orders = Array.from(this.orders.values());
    if (status) {
      return orders.filter(order => order.status === status);
    }
    return orders;
  }
}

class InMemoryWebhookStorage implements WebhookStorage {
  private subscriptions = new Map<string, WebhookSubscription>();
  private idCounter = 1;

  async create(subscriptionData: Omit<WebhookSubscription, 'id' | 'secret' | 'createdAt' | 'updatedAt'>): Promise<WebhookSubscription> {
    const id = `webhook_${this.idCounter++}`;
    const secret = `whsec_${Math.random().toString(36).substring(2)}`;
    const now = new Date().toISOString();

    const subscription: WebhookSubscription = {
      ...subscriptionData,
      id,
      secret,
      createdAt: now,
      updatedAt: now,
    };

    this.subscriptions.set(id, subscription);
    return subscription;
  }

  async get(id: string): Promise<WebhookSubscription | null> {
    return this.subscriptions.get(id) || null;
  }

  async list(userId?: string): Promise<WebhookSubscription[]> {
    const allSubscriptions = Array.from(this.subscriptions.values());
    if (userId) {
      return allSubscriptions.filter(sub => sub.userId === userId);
    }
    return allSubscriptions;
  }

  async delete(id: string): Promise<boolean> {
    return this.subscriptions.delete(id);
  }

  async update(id: string, updates: Partial<WebhookSubscription>): Promise<WebhookSubscription | null> {
    const subscription = this.subscriptions.get(id);
    if (!subscription) return null;

    const updatedSubscription = {
      ...subscription,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.subscriptions.set(id, updatedSubscription);
    return updatedSubscription;
  }
}

// Default configuration
const DEFAULT_CONFIG: Required<OcpConfig> = {
  baseUrl: 'https://api.example.com',
  version: '1.0',
  capabilities: [],
  stores: [],
  catalogs: [],
  rateLimitConfig: {
    limit: 100,
    window: 3600,
    unit: 'requests per hour',
  },
  enableWebhooks: true,
  enableOrders: true,
  enableCarts: true,
  capabilityConfig: {
    cart: {
      enabled: true,
      lifetimeSeconds: 3600, // 1 hour
      maxItems: 100,
      allowGuestCheckout: false,
    },
    directOrder: {
      enabled: false,
      maxItemsPerOrder: 10,
      allowGuestOrders: false,
      supportedFulfillmentTypes: ['pickup', 'delivery'],
    },
    productVariants: {
      enabled: false,
      maxVariantsPerProduct: 50,
      supportedVariantTypes: ['size', 'color', 'style'],
      allowOutOfStockSelection: false,
    },
    productSearch: {
      enabled: false,
      urlTemplate: '/search?q={query}',
      supportedSorts: ['name', 'price', 'rating'],
      searchableIdentifierTypes: ['SKU', 'UPC'],
      maxResultsPerPage: 50,
    },
    productRichInfo: {
      enabled: false,
      supportedImageFormats: ['webp', 'avif', 'jpg', 'png'],
      maxImagesPerProduct: 10,
      allowVariantSpecificImages: true,
    },
    authFlows: {
      enabled: false,
      supportedMethods: ['password'],
      tokenFormat: 'jwt',
      tokenLocation: 'header',
      sessionDuration: 3600,
      refreshTokenSupported: true,
    },
    userProfile: {
      enabled: false,
      allowGuestProfiles: false,
      maxSavedAddresses: 5,
      allowCustomPreferences: true,
    },
    deliveryTracking: {
      enabled: false,
      updateIntervalSeconds: 30,
      enableLiveLocation: true,
      enableDriverInfo: true,
    },
    shipmentTracking: {
      enabled: false,
      supportedCarriers: ['fedex', 'ups', 'usps'],
      enableTrackingUrls: true,
    },
    detailedStatus: {
      enabled: false,
      supportedLocales: ['en'],
    },
    tipping: {
      enabled: false,
      suggestedPercentages: [10, 15, 20],
      allowCustomAmount: true,
    },
    storeInfo: {
      enabled: false,
      includeHours: true,
      includeContactInfo: true,
      includePolicies: true,
      includeLocation: true,
      includeRatings: true,
    },
    restaurantProfile: {
      enabled: false,
      includeCuisine: true,
      includeHours: true,
      includeRatings: true,
      includePriceRange: true,
    },
    promotions: {
      enabled: false,
      allowPublicDiscovery: true,
      supportedTypes: ['coupon', 'discount'],
    },
    payment: {
      enabled: false,
      supportedSchemes: ['fiat_intent'],
    },
    i18n: {
      enabled: false,
      defaultLocale: 'en',
      supportedLocales: [{
        code: 'en',
        numberFormat: {
          decimalSeparator: '.',
          groupingSeparator: ',',
        },
        currencyFormat: {
          symbol: '$',
          position: 'before',
        },
        dateFormat: {
          shortDate: 'MM/dd/yyyy',
          timeFormat: 'h:mm a',
        },
      }],
    },
    resourceVersioning: {
      enabled: false,
      maxVersionsPerChain: 10,
      retentionPolicy: {
        keepLatest: 5,
      },
    },

    scheduling: {
      enabled: false,
      allowAdvanceBooking: true,
      maxAdvanceDays: 30,
      timeSlotIntervalMinutes: 15,
    },
    kitchenStatus: {
      enabled: false,
      updateIntervalSeconds: 60,
      includePrepTimes: true,
      supportedStatuses: ['received', 'preparing', 'ready', 'completed'],
    },
  },
};

/**
 * Creates and configures the OCP (Open Commerce Protocol) middleware for Hono.
 *
 * This middleware provides a complete implementation of the OCP v1.0.0-rc.1 specification,
 * including discovery endpoints, cart management, order processing, and webhook support.
 *
 * @param config - Partial OCP configuration. Missing values will use defaults.
 * @returns A configured Hono app with all OCP routes mounted.
 *
 * @example
 * ```typescript
 * import { createOcpMiddleware } from 'open-commerce-protocol';
 *
 * const ocpApp = createOcpMiddleware({
 *   stores: [{ id: 'store1', name: 'My Store', location: {...}, catalogIds: ['cat1'] }],
 *   catalogs: [{ id: 'cat1', name: 'Products', version: '1.0', items: [...] }],
 *   enableCarts: true,
 *   enableOrders: true,
 *   enableWebhooks: true
 * });
 * ```
 */
export function createOcpMiddleware(config: Partial<OcpConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Initialize storage
  const cartStorage = new InMemoryCartStorage();
  const orderStorage = new InMemoryOrderStorage();
  const webhookStorage = finalConfig.enableWebhooks ? new InMemoryWebhookStorage() : undefined;

  // Initialize capability registry
  const capabilityRegistry = createCapabilityRegistry(finalConfig.capabilityConfig!);

// Create Hono app
const app = new Hono();

// Request logging middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const url = c.req.url;

  console.log(`[${new Date().toISOString()}] ${method} ${url} - Start`);

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  console.log(`[${new Date().toISOString()}] ${method} ${url} - ${status} (${duration}ms)`);
});

// Add OCP context to all requests
app.use('*', async (c, next) => {
  c.set('ocp', {
    userId: c.req.header('X-User-ID'), // In real implementation, this would come from auth middleware
    cartStorage,
    orderStorage,
    webhookStorage,
    config: finalConfig,
    capabilityRegistry,
  });
  await next();
});

// Metadata processing middleware
app.use('*', createMetadataMiddleware());

  // Error handling
  app.onError(createErrorHandler());

// Rate limiting middleware
app.use('*', async (c, next) => {
  // Simple in-memory rate limiting (in production, use Redis or similar)
  // Mock rate limiting - check if we've exceeded limit
  const currentRequests = 5; // In real implementation, get from storage
  const limit = finalConfig.rateLimitConfig.limit;
  const remaining = Math.max(0, limit - currentRequests);

  c.header('X-RateLimit-Limit', limit.toString());
  c.header('X-RateLimit-Remaining', remaining.toString());
  c.header('X-RateLimit-Reset', Math.floor(Date.now() / 1000 + finalConfig.rateLimitConfig.window).toString());

  // If rate limit exceeded, return 429
  if (remaining === 0) {
    c.header('Retry-After', finalConfig.rateLimitConfig.window.toString());
    throw OCP_ERRORS.RATE_LIMIT_EXCEEDED;
  }

  await next();
});

  // Mount route groups
  app.route('/', createDiscoveryRoutes());

  // Mount core routes - use capability routes if capabilities are enabled
  if (finalConfig.enableCarts && !capabilityRegistry.isEnabled('dev.ocp.cart')) {
    app.route('/', createCartRoutes());
  }
  if (finalConfig.enableOrders && !capabilityRegistry.isEnabled('dev.ocp.order.direct')) {
    app.route('/', createOrderRoutes());
  }
  if (finalConfig.enableWebhooks) {
    app.route('/', createWebhookRoutes());
  }

  // Mount capability-specific routes (these take precedence)
  app.route('/', capabilityRegistry.getRoutes());

  return app;
}

// Export the middleware for use
export default createOcpMiddleware;