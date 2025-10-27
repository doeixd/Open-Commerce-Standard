/**
 * Simple OCP Server - Bare Minimum Example
 *
 * A minimal OCP-compliant server that demonstrates:
 * 1. Discovery (.well-known/ocp)
 * 2. Capabilities endpoint
 * 3. Product catalog
 * 4. Direct order placement
 *
 * Requirements: npm install express
 *
 * Run: node simple-server.js
 */

const express = require('express');
const crypto = require('crypto');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  next();
});

// In-memory data store (replace with database in production)
const store = {
  products: [
    {
      id: 'coffee_mug',
      name: 'OCP Coffee Mug',
      price: { amount: '15.00', currency: 'USD' },
      fulfillmentType: 'physical',
      available: true,
      description: 'Ceramic mug with OCP logo',
    },
    {
      id: 'digital_guide',
      name: 'OCP Implementation Guide',
      price: { amount: '9.99', currency: 'USD' },
      fulfillmentType: 'digital',
      available: true,
      description: 'PDF guide to implementing OCP',
    },
  ],
  orders: [],
  carts: [],
};

// --- Discovery Endpoints ---

// 1. RFC 8615 Well-Known Discovery (Level 4)
app.get('/.well-known/ocp', (req, res) => {
  res
    .header('Cache-Control', 'max-age=86400')
    .header('Access-Control-Allow-Origin', '*')
    .json({
      OCP: {
        capabilities: `http://localhost:${PORT}/capabilities`,
        version: '1.0',
        context: 'https://schemas.OCP.dev/context.jsonld',
      },
    });
});

// 2. Capabilities Endpoint (Required)
app.get('/capabilities', (req, res) => {
  res.json({
    capabilities: [
      {
        id: 'dev.ocp.cart@1.0',
        schemaUrl: 'https://schemas.OCP.dev/cart/v1.json',
        metadata: {
          lifetimeSeconds: 3600,
          maxItems: 50,
        },
      },
      {
        id: 'dev.ocp.order.direct@1.0',
        schemaUrl: 'https://schemas.OCP.dev/order/direct/v1.json',
      },
      {
        id: 'dev.ocp.discovery@1.0',
        schemaUrl: 'https://schemas.OCP.dev/capabilities/discovery/v1.json',
        metadata: {
          _version: '1.0',
          wellKnownUrl: `http://localhost:${PORT}/.well-known/ocp`,
          htmlMetaEnabled: false,
          jsonLdEnabled: false,
          httpHeadersEnabled: true,
        },
      },
      {
        id: 'dev.ocp.payment.web_payments@1.0',
        schemaUrl: 'https://schemas.OCP.dev/payment/web_payments/v1.json',
        metadata: {
          _version: '1.0',
          supportedMethods: ['basic-card', 'https://google.com/pay'],
          merchantName: 'OCP Demo Store',
          supportedNetworks: ['visa', 'mastercard', 'amex'],
          requireShippingAddress: false,
          requireBillingAddress: false,
        },
      },
      {
        id: 'dev.ocp.payment.spc@1.0',
        schemaUrl: 'https://schemas.OCP.dev/payment/spc/v1.json',
        metadata: {
          _version: '1.0',
          supportedRps: ['bank.example.com'],
          registrationUrl: 'https://bank.example.com/register-spc',
          registrationFlow: 'iframe',
          timeout: 300000,
          requiresEnrollment: true,
          fallbackMethods: ['otp', 'web_payments'],
        },
      },
      {
        id: 'dev.ocp.hypermedia.schema_aware_actions@1.0',
        schemaUrl: 'https://schemas.OCP.dev/hypermedia/schema_aware_actions/v1.json',
        metadata: {
          _version: '1.0',
          enabled: true,
          schemaFormat: 'json-schema',
          inlineSchemas: true,
          includeExamples: true,
        },
      },
      {
        id: 'dev.ocp.resource.versioning@1.0',
        schemaUrl: 'https://schemas.OCP.dev/resource/versioning/v1.json',
      },
    ],
  });
});

// --- Product Catalog ---

// 3. List Catalogs
app.get('/catalogs', (req, res) => {
  res.json({
    catalogs: [
      {
        id: 'main',
        name: 'Main Catalog',
        description: 'All available products',
      },
    ],
    pagination: {
      limit: 20,
      nextCursor: null,
      previousCursor: null,
      totalCount: 1,
    },
  });
});

// 4. Get Catalog with Products
app.get('/catalogs/:id', (req, res) => {
  if (req.params.id !== 'main') {
    return res.status(404)
      .header('Content-Type', 'application/problem+json')
      .json({
        type: 'https://schemas.OCP.dev/errors/catalog-not-found',
        title: 'Catalog Not Found',
        status: 404,
        detail: 'Catalog not found',
        instance: `http://localhost:${PORT}/catalogs/${req.params.id}`,
        timestamp: new Date().toISOString()
      });
  }

  res.json({
    id: 'main',
    name: 'Main Catalog',
    storeId: 'demo_store',
    items: store.products,
  });
});

// --- Cart Management (Level 1) ---

// 5. Create Cart
app.post('/carts', requireAuth, (req, res) => {
  // Check max concurrent carts
  if (store.carts.length >= 5) { // Example limit
    return res.status(400)
      .header('Content-Type', 'application/problem+json')
      .json({
        type: 'https://schemas.OCP.dev/errors/max-concurrent-carts-exceeded',
        title: 'Max Concurrent Carts Exceeded',
        status: 400,
        detail: 'Maximum number of concurrent carts exceeded',
        instance: `http://localhost:${PORT}/carts`,
        timestamp: new Date().toISOString(),
        localizationKey: 'error.cart.max_concurrent_exceeded'
      });
  }

  const cart = {
    id: `cart_${Date.now()}`,
    storeId: req.body.storeId || 'demo_store',
    items: [],
    total: { amount: '0.00', currency: 'USD' },
    createdAt: new Date().toISOString(),
  };

  store.carts.push(cart);
  res.status(201).json(cart);
});

// 6. Get Cart
app.get('/carts/:id', requireAuth, (req, res) => {
  const cart = store.carts.find(c => c.id === req.params.id);

  if (!cart) {
    return res.status(404)
      .header('Content-Type', 'application/problem+json')
      .json({
        type: 'https://schemas.OCP.dev/errors/cart-not-found',
        title: 'Cart Not Found',
        status: 404,
        detail: 'Cart not found or expired',
        instance: `http://localhost:${PORT}/carts/${req.params.id}`,
        timestamp: new Date().toISOString(),
        localizationKey: 'error.cart.not_found'
      });
  }

  res.json(cart);
});

// 7. Add Item to Cart
app.post('/carts/:id/items', requireAuth, (req, res) => {
  const cart = store.carts.find(c => c.id === req.params.id);

  if (!cart) {
    return res.status(404)
      .header('Content-Type', 'application/problem+json')
      .json({
        type: 'https://schemas.OCP.dev/errors/cart-not-found',
        title: 'Cart Not Found',
        status: 404,
        detail: 'Cart not found or expired',
        instance: `http://localhost:${PORT}/carts/${req.params.id}/items`,
        timestamp: new Date().toISOString(),
        code: 'cart_not_found'
      });
  }

  const product = store.products.find(p => p.id === req.body.catalogItemId);

  if (!product) {
    return res.status(404)
      .header('Content-Type', 'application/problem+json')
      .json({
        type: 'https://schemas.OCP.dev/errors/item-not-available',
        title: 'Item Not Available',
        status: 404,
        detail: 'Product not found or not available',
        instance: `http://localhost:${PORT}/carts/${req.params.id}/items`,
        timestamp: new Date().toISOString(),
        localizationKey: 'error.item.not_available'
      });
  }

  if (!product.available) {
    return res.status(400)
      .header('Content-Type', 'application/problem+json')
      .json({
        type: 'https://schemas.OCP.dev/errors/item-out-of-stock',
        title: 'Item Out of Stock',
        status: 400,
        detail: 'Item is out of stock',
        instance: `http://localhost:${PORT}/carts/${req.params.id}/items`,
        timestamp: new Date().toISOString(),
        localizationKey: 'error.item.out_of_stock'
      });
  }

  const quantity = req.body.quantity || 1;
  if (quantity < 1) {
    return res.status(400)
      .header('Content-Type', 'application/problem+json')
      .json({
        type: 'https://schemas.OCP.dev/errors/invalid-quantity',
        title: 'Invalid Quantity',
        status: 400,
        detail: 'Quantity must be at least 1',
        instance: `http://localhost:${PORT}/carts/${req.params.id}/items`,
        timestamp: new Date().toISOString(),
        localizationKey: 'error.quantity.invalid',
        nextActions: [
          {
            id: 'retry_with_valid_quantity',
            href: `/carts/${req.params.id}/items`,
            method: 'POST',
            title: 'Retry with Valid Quantity',
            requestSchema: {
              type: 'object',
              properties: {
                catalogItemId: { type: 'string' },
                quantity: { type: 'integer', minimum: 1 }
              },
              required: ['catalogItemId', 'quantity']
            },
            responseSchema: {
              $ref: 'https://schemas.OCP.dev/cart/item/v1.json'
            }
          }
        ]
      });
  }

  // Check max items
  if (cart.items.length >= 50) {
    return res.status(400)
      .header('Content-Type', 'application/problem+json')
      .json({
        type: 'https://schemas.OCP.dev/errors/max-items-exceeded',
        title: 'Max Items Exceeded',
        status: 400,
        detail: 'Cart has reached maximum number of items',
        instance: `http://localhost:${PORT}/carts/${req.params.id}/items`,
        timestamp: new Date().toISOString(),
        localizationKey: 'error.cart.max_items_exceeded'
      });
  }

  // Add item
  const item = {
    id: `item_${Date.now()}`,
    catalogItemId: product.id,
    name: product.name,
    quantity: quantity,
    price: product.price,
    fulfillmentType: product.fulfillmentType,
  };

  cart.items.push(item);

  // Recalculate total
  const total = cart.items.reduce((sum, item) => {
    return sum + parseFloat(item.price.amount) * item.quantity;
  }, 0);

  cart.total = {
    amount: total.toFixed(2),
    currency: 'USD',
  };

  res.status(201).json(item);
});

// --- Order Management ---

// 8. Place Order (Direct or from Cart)
app.post('/orders', requireAuth, (req, res) => {
  let orderItems = [];

  // Option A: Order from cart (Level 1)
  if (req.body.cartId) {
    const cart = store.carts.find(c => c.id === req.body.cartId);

    if (!cart) {
      return res.status(404)
        .header('Content-Type', 'application/problem+json')
        .json({
          type: 'https://schemas.OCP.dev/errors/cart-not-found',
          title: 'Cart Not Found',
          status: 404,
          detail: 'Cart not found or expired',
          instance: `http://localhost:${PORT}/orders`,
          timestamp: new Date().toISOString()
        });
    }

    orderItems = cart.items;
  }
  // Option B: Direct order (Level 0)
  else if (req.body.items) {
    orderItems = req.body.items.map(item => {
      const product = store.products.find(p => p.id === item.catalogItemId);
      return {
        id: `item_${Date.now()}_${Math.random()}`,
        catalogItemId: product.id,
        name: product.name,
        quantity: item.quantity,
        price: product.price,
        fulfillmentType: product.fulfillmentType,
      };
    });
  } else {
    return res.status(400).json({
      code: 'invalid_request',
      message: 'Either cartId or items array required',
    });
  }

  // Calculate total
  const total = orderItems.reduce((sum, item) => {
    return sum + parseFloat(item.price.amount) * item.quantity;
  }, 0);

  // Validate fulfillment info
  const hasPhysical = orderItems.some(i => i.fulfillmentType === 'physical');
  const hasPickup = orderItems.some(i => i.fulfillmentType === 'pickup');

  if (hasPhysical && !req.body.deliveryAddress) {
    return res.status(400)
      .header('Content-Type', 'application/problem+json')
      .json({
        type: 'https://schemas.OCP.dev/errors/delivery-address-required',
        title: 'Delivery Address Required',
        status: 400,
        detail: 'Order contains physical items but no delivery address provided',
        instance: `http://localhost:${PORT}/orders`,
        timestamp: new Date().toISOString()
      });
  }

  if (hasPickup && !req.body.pickupLocation) {
    return res.status(400)
      .header('Content-Type', 'application/problem+json')
      .json({
        type: 'https://schemas.OCP.dev/errors/pickup-location-required',
        title: 'Pickup Location Required',
        status: 400,
        detail: 'Order contains pickup items but no pickup location provided',
        instance: `http://localhost:${PORT}/orders`,
        timestamp: new Date().toISOString()
      });
  }

  // Create order
  const chainId = `chain_${crypto.randomUUID()}`;
  const orderId = `order_${crypto.randomUUID()}`;
  const order = {
    id: orderId,
    status: 'confirmed',
    items: orderItems,
    total: {
      amount: total.toFixed(2),
      currency: 'USD',
    },
    deliveryAddress: req.body.deliveryAddress,
    pickupLocation: req.body.pickupLocation,
    createdAt: new Date().toISOString(),
    // Add schema-aware hypermedia actions
    actions: buildOrderActions(orderId, 'confirmed'),
    metadata: {
      'dev.ocp.resource.versioning@1.0': {
        _version: '1.0',
        chainId: chainId,
        version: 1,
        revises: null,
        isLatest: true,
        revisionDetails: null
      }
    },
  };

  store.orders.push(order);

  // Remove cart if used
  if (req.body.cartId) {
    store.carts = store.carts.filter(c => c.id !== req.body.cartId);
  }

  res.status(201).json(order);
});

// 9. Get Order
app.get('/orders/:id', requireAuth, (req, res) => {
  const order = store.orders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404)
      .header('Content-Type', 'application/problem+json')
      .json({
        type: 'https://schemas.OCP.dev/errors/order-not-found',
        title: 'Order Not Found',
        status: 404,
        detail: 'Order not found',
        instance: `http://localhost:${PORT}/orders/${req.params.id}`,
        timestamp: new Date().toISOString()
      });
  }

  // Add schema-aware actions based on current status
  order.actions = buildOrderActions(order.id, order.status);

  res.json(order);
});

// 10. List Orders
app.get('/orders', requireAuth, (req, res) => {
  res.json({
    orders: store.orders,
    pagination: {
      limit: 20,
      nextCursor: null,
      previousCursor: null,
      totalCount: store.orders.length,
    },
  });
});

// 11. Cancel Order (Immutable Versioning Example)
app.post('/orders/:id/cancel', requireAuth, (req, res) => {
  const previousOrder = store.orders.find(o => o.id === req.params.id);

  if (!previousOrder) {
    return res.status(404)
      .header('Content-Type', 'application/problem+json')
      .json({
        type: 'https://schemas.OCP.dev/errors/order-not-found',
        title: 'Order Not Found',
        status: 404,
        detail: 'Order not found',
        instance: `http://localhost:${PORT}/orders/${req.params.id}/cancel`,
        timestamp: new Date().toISOString()
      });
  }

  const versioning = previousOrder.metadata['dev.ocp.resource.versioning@1.0'];
  if (!versioning || !versioning.isLatest) {
    const latest = store.orders.find(o => o.metadata['dev.ocp.resource.versioning@1.0']?.chainId === versioning.chainId && o.metadata['dev.ocp.resource.versioning@1.0']?.isLatest);
    return res.status(409).json({
      type: 'https://schemas.OCP.dev/errors/stale-version',
      title: 'Stale Version',
      status: 409,
      detail: 'This order version has been superseded.',
      latestVersionUrl: `http://localhost:${PORT}/orders/${latest.id}`
    });
  }

  if (previousOrder.status !== 'confirmed') {
    return res.status(400)
      .header('Content-Type', 'application/problem+json')
      .json({
        type: 'https://schemas.OCP.dev/errors/order-not-cancellable',
        title: 'Order Not Cancellable',
        status: 400,
        detail: 'Order cannot be cancelled in its current state',
        instance: `http://localhost:${PORT}/orders/${req.params.id}/cancel`,
        timestamp: new Date().toISOString(),
        localizationKey: 'error.order.not_cancellable'
      });
  }

  // --- Immutable Update Logic ---
  // 1. Create a new version
  const newOrderId = `order_${crypto.randomUUID()}`;
  const newOrder = {
    ...previousOrder,
    id: newOrderId,
    status: 'cancelled',
    actions: [], // No actions on a cancelled order
    metadata: {
      ...previousOrder.metadata,
      'dev.ocp.resource.versioning@1.0': {
        ...versioning,
        version: versioning.version + 1,
        revises: previousOrder.id,
        isLatest: true,
        revisionDetails: {
          actionId: 'cancel',
          timestamp: new Date().toISOString(),
          arguments: req.body,
          actor: { type: 'user', id: 'demo_user' }
        }
      }
    }
  };

  // 2. Update the old version
  previousOrder.status = 'superseded';
  previousOrder.actions = [];
  previousOrder.metadata['dev.ocp.resource.versioning@1.0'].isLatest = false;
  previousOrder.metadata['dev.ocp.resource.versioning@1.0'].supersededBy = newOrderId;

  // 3. Save the new version
  store.orders.push(newOrder);

  // 4. Respond with 201 Created
  res.status(201).location(`/orders/${newOrderId}`).json(newOrder);
});

// --- Helper Functions ---

// Build schema-aware actions based on order status
function buildOrderActions(orderId, status) {
  const actions = [];

  // Cancel action (available for confirmed orders)
  if (status === 'confirmed') {
    actions.push({
      id: 'cancel',
      href: `/orders/${orderId}/cancel`,
      method: 'POST',
      title: 'Cancel Order',
      description: 'Cancel this order. Refunds will be processed within 5-7 business days.',
      requestSchema: {
        $ref: 'https://schemas.OCP.dev/order/actions/cancel_request/v1.json'
      },
      responseSchema: {
        $ref: 'https://schemas.OCP.dev/order/v1.json'
      },
      errorSchemas: [
        {
          statusCode: 400,
          errorCodes: ['cancellation_window_expired', 'order_already_cancelled'],
          description: 'Order cannot be cancelled (window expired or already cancelled)'
        },
        {
          statusCode: 404,
          errorCodes: ['not_found'],
          description: 'Order not found'
        }
      ],
      examples: {
        request: {
          reason: 'Changed my mind'
        },
        response: {
          id: orderId,
          status: 'cancelled',
          refundStatus: 'processing'
        }
      }
    });
  }

  // Rating action (available for completed orders)
  if (status === 'completed') {
    actions.push({
      id: 'add_rating',
      href: `/orders/${orderId}/ratings`,
      method: 'POST',
      title: 'Rate Your Order',
      description: 'Share your feedback about this order',
      requestSchema: {
        inline: {
          type: 'object',
          properties: {
            overall: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
              description: 'Overall rating from 1-5 stars'
            },
            food: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
              description: 'Food quality rating'
            },
            delivery: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
              description: 'Delivery service rating'
            },
            comment: {
              type: 'string',
              maxLength: 1000,
              description: 'Optional written review'
            }
          },
          required: ['overall']
        }
      },
      responseSchema: {
        $ref: 'https://schemas.OCP.dev/order/v1.json'
      },
      examples: {
        request: {
          overall: 5,
          food: 5,
          delivery: 4,
          comment: 'Great food, slightly late delivery'
        }
      }
    });

    // Return action (also available for completed orders)
    actions.push({
      id: 'initiate_return',
      href: `/orders/${orderId}/returns`,
      method: 'POST',
      title: 'Return Items',
      description: 'Start a return for one or more items from this order',
      requestSchema: {
        $ref: 'https://schemas.OCP.dev/order/actions/return_request/v1.json'
      },
      responseSchema: {
        $ref: 'https://schemas.OCP.dev/order/return/v1.json'
      },
      errorSchemas: [
        {
          statusCode: 400,
          errorCodes: ['return_window_expired', 'return_policy_violated'],
          description: 'Return window has expired or return is not allowed for this item'
        }
      ],
      examples: {
        request: {
          items: [
            {
              cartItemId: 'item_456',
              quantity: 1,
              reason: 'wrong_size'
            }
          ],
          preferredResolution: 'exchange'
        }
      }
    });
  }

  return actions;
}

// --- Middleware ---

// Simple auth middleware (replace with real auth in production)
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401)
      .header('Content-Type', 'application/problem+json')
      .json({
        type: 'https://schemas.OCP.dev/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Valid authorization token required',
        instance: `http://localhost:${PORT}${req.path}`,
        timestamp: new Date().toISOString()
      });
  }

  // In production: validate token here
  // For demo: accept any token
  next();
}

// --- Start Server ---

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║   🚀 OCP Demo Server Running                          ║
╟────────────────────────────────────────────────────────╢
║   Discovery:     http://localhost:${PORT}/.well-known/ocp   ║
║   Capabilities:  http://localhost:${PORT}/capabilities      ║
║   Catalog:       http://localhost:${PORT}/catalogs/main    ║
╟────────────────────────────────────────────────────────╢
║   Try it:                                              ║
║   curl http://localhost:${PORT}/capabilities               ║
║   curl http://localhost:${PORT}/catalogs/main              ║
╚════════════════════════════════════════════════════════╝
  `);
});

// --- Example Usage ---

/*

# 1. Discover API
curl http://localhost:3000/.well-known/ocp

# 2. Check capabilities
curl http://localhost:3000/capabilities

# 3. Browse products
curl http://localhost:3000/catalogs/main

# 4. Place direct order (no cart)
curl -X POST http://localhost:3000/orders \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer demo_token" \\
  -d '{
    "items": [{"catalogItemId": "coffee_mug", "quantity": 1}],
    "deliveryAddress": {"address": "123 Main St, Anytown, USA"}
  }'

# 5. Create cart-based order
curl -X POST http://localhost:3000/carts \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer demo_token" \\
  -d '{"storeId": "demo_store"}'

# Get cart ID from response, then add items:
curl -X POST http://localhost:3000/carts/CART_ID/items \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer demo_token" \\
  -d '{"catalogItemId": "coffee_mug", "quantity": 2}'

# Checkout cart:
curl -X POST http://localhost:3000/orders \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer demo_token" \\
  -d '{
    "cartId": "CART_ID",
    "deliveryAddress": {"address": "123 Main St, Anytown, USA"}
  }'

*/
