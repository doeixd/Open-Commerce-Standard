<div align="left">
  <img src="assets/logo.png" alt="Open Commerce Standard Logo" width="150">
</div>

# Open Commerce Standard (OCS)

| Spec Version | Status | License |
| :--- | :--- | :--- |
| **1.0.0** | **Active & Ready for Implementation** | **MIT** |

---

> **🆕 New to OCS?** Start with the **[Getting Started Lite Guide](./docs/getting-started-lite.md)** for a beginner-friendly introduction that skips the advanced concepts. Or jump to **[5-Minute Quickstart](#5-minute-quickstart)** below.

---

## Introduction

The Open Commerce Standard (OCS) is an open, extensible API specification for digital commerce, enabling universal clients to interact with any compliant server—from simple product catalogs to complex e-commerce platforms. By leveraging HTTP semantics, capability discovery, and structured metadata, OCS supports physical goods, digital services, and in-store pickup while prioritizing implementer freedom. It integrates the powerful and extensible x402 Protocol for payments. This allows OCS to function as a unified payment gateway, supporting both web3-native assets (like USDC for instant, low-fee blockchain transactions) and traditional fiat currencies (via providers like Stripe and PayPal) through a single, elegant, and stateless API flow.

## Overview & Common Questions

**What is OCS?**
An open, minimal, and extensible standard for digital commerce. It defines a universal HTTP API for the entire transaction lifecycle: product discovery, cart management, ordering, and real-time updates—supporting physical goods, digital services, and in-store pickup.

**Why OCS?**
Traditional e-commerce APIs are fragmented and vendor-specific. OCS provides a consistent, extensible framework that adapts to any business model—from simple catalogs to complex apparel stores—without dictating internal logic. It prioritizes implementer freedom while enabling universal, adaptive clients.

**How does OCS work?**
Clients begin by discovering server capabilities (`GET /capabilities`), then browse catalogs, manage carts, and place orders. Real-time updates stream via Server-Sent Events. Complexity is delegated to structured `metadata` linked to JSON Schemas, allowing clients to adapt dynamically without hardcoding features.

**Why X402 for payments?**
OCS integrates the [x402 Protocol](https://github.com/coinbase/x402) for web3-native payments, enabling instant, low-fee blockchain transactions with stablecoins like USDC. Unlike credit cards (high fees, slow settlement, chargebacks), X402 supports micropayments, AI agents, and programmable commerce.

**How does authentication work?**
OCS uses Bearer token authentication (`Authorization: Bearer <token>`). Token formats (e.g., JWT, API keys) are implementation-specific and may be discoverable via capabilities. Discovery endpoints are public; others require auth.

**Who is OCS for?**
API providers monetizing digital commerce, client developers building universal shopping apps, and AI agents requiring autonomous transactions.

The full OpenAPI 3.0 specification is available in [`spec.yaml`](./src/spec.yaml).

<br />

## 5-Minute Quickstart

**Just want to see it work?** Here's the bare minimum:

### For Clients (Using an OCS API)

```javascript
// 1. Browse products
const catalog = await fetch('https://shop.example.com/catalogs/main')
  .then(r => r.json());

// 2. Buy something
const order = await fetch('https://shop.example.com/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/ocs+json; version=1.0',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    items: [{ catalogItemId: 'prod_1', quantity: 1 }],
    deliveryAddress: { address: '123 Main St' }
  })
}).then(r => r.json());

console.log('Order placed:', order.id);
```

**That's it.** See [simple-client.js](./examples/simple-client.js) for complete working examples.

### For Servers (Building an OCS API)

Implement 3 endpoints:

1. **`GET /capabilities`** - List what you support (can be empty)
2. **`GET /catalogs/{id}`** - Show your products
3. **`POST /orders`** - Accept orders

**Example minimal server:** [simple-server.js](./examples/simple-server.js) (Node.js/Express)

**Need more help?**
- 📚 **Beginner:** [Getting Started Lite](./docs/getting-started-lite.md) - No jargon, just the basics
- 📈 **Progressive:** [Progressive Guide](./docs/progressive-guide.md) - Add features step-by-step
- 🗺️ **Not sure?** [Learning Path Guide](./docs/learning-path.md) - Choose your path based on experience
- 📁 **Examples:** [Code Examples](./examples/README.md) - Runnable client and server code
- 🔄 **Versioning:** [Immutable Resource Versioning Guide](./docs/immutable-resource-versioning.md) - Official guide for immutable versioning of resources
- 🔧 **Reference:** Continue reading below for complete documentation

<br />

## Getting Started

1. **Review the Specification:** Read the [OpenAPI spec](./src/spec.yaml) for the full API details.
2. **Implement Discovery:** Set up OCS discovery mechanisms (see [OCS Discovery Specification](./docs/ocs-discovery.md)) to make your API discoverable.
3. **Implement Core Endpoints:** Start with discovery (`/.well-known/ocs`, `/capabilities`, `/stores`, `/catalogs`) and cart/order flows.
4. **Add Capabilities:** Implement optional features like variants or tracking via standard schemas.
5. **Build Clients:** Use capability discovery for adaptive apps compatible with any OCS server.

---

## 📖 Complete Documentation

*The sections below provide in-depth coverage of OCS architecture, advanced features, and design patterns. New users may want to start with the [quickstart](#5-minute-quickstart) or [lite guide](./docs/getting-started-lite.md) first.*

---

## Key Features

*   **Universal Commerce Model:** A single, elegant model handles **physical goods**, **digital goods/services**, and **in-store pickup** using a simple `fulfillmentType` flag.
*   **Flexible Checkout Flows:** OCS supports both stateful, multi-step shopping carts for complex journeys and stateless, "Buy Now" checkouts for simple, one-click purchases. This is enabled by the discoverable `dev.ocs.order.direct@1.0` capability, allowing clients to provide the optimal user experience for any scenario.
*   **Dynamic Capability Discovery:** The `GET /capabilities` endpoint allows a client to understand a server's full feature set, enabling truly adaptive applications.
*   **Real-time Order Updates:** A built-in Server-Sent Events (SSE) endpoint (`/orders/{id}/updates`) provides efficient, real-time order status changes using standardized JSON Patch.
*   **Structured, Extensible Metadata:** Go beyond simple key-value pairs. OCS provides a system for servers to link to official JSON Schemas that define the structure of their `metadata`.
*   **Web3-Native Payments:** Includes a complete, protocol-compliant implementation for handling payments via the [x402 Protocol](https://github.com/coinbase/x402).
*   **Global-Ready by Design:** Full internationalization support is built into the standard. Servers can advertise supported languages and regional formats, allowing clients to provide a fully localized experience, including right-to-left (RTL) language support and culturally correct currency formatting.
*   **Formal Security Model:** Recommends and formalizes a `Bearer` token authentication scheme for all protected resources.
*   **Immutable, Auditable History:** An optional, advanced capability (`dev.ocs.resource.versioning@1.0`) for treating all resource mutations as the creation of a new, immutable version. This provides a full, unchangeable audit trail for critical resources like orders, inspired by financial ledger systems.

<br />

## A Unified, HTTP-Native Payment Protocol (x402)

OCS integrates the x402 Protocol because it provides a single, open, and stateless pattern for handling any payment flow directly over HTTP. Instead of relying on cumbersome redirects or multiple API calls to manage state, the entire transaction is handled within a simple request/retry cycle.

This is made possible through extensible payment schemes, which allow OCS to support diverse payment rails.

### 1. For Web3-Native Payments (The exact Scheme)

For digital assets, OCS uses the exact scheme to enable payments that are impossible with traditional finance:

- **Micropayments & Pay-Per-Use:** Charge per API call, content access, or item without subscriptions or minimums.
- **Instant Settlement:** Blockchain-based transactions settle in seconds, not days.
- **Low/No Fees:** Near-zero transaction costs compared to legacy rails.
- **AI & Agent Friendly:** Enables autonomous payments by AI agents without human intervention.
- **Programmable:** Direct HTTP integration via the 402 status code, extensible across chains.

### 2. For Traditional Fiat Payments (The fiat_intent Scheme)

For credit cards, bank transfers, and other traditional methods, OCS leverages the fiat_intent scheme to bring order to the chaos of provider-specific APIs.

- **Simplified Client Logic:** The client doesn't need to know the complex, multi-step logic of Stripe's Payment Intents or PayPal's checkouts. It simply follows the server's instructions provided in the 402 response.
- **Server-Driven UI:** The server sends all necessary context—including display names ("Credit / Debit Card"), icons, and instructions—allowing the client to build a rich UI dynamically.
- **Secure and Compliant:** The flow is designed for modern, token-based payment processing. Sensitive card details are never exposed to the OCS client or server, ensuring PCI compliance.
- **A Single, Unified Flow:** Developers write one piece of code to handle the x402 402 retry loop, and it will automatically support any fiat provider the server adds in the future.

### How OCS Uses X402

In the OCS order flow:

1. **Client places order** (`POST /orders`).
2. **If payment required:** Server responds with `402 Payment Required`, including x402 payment requirements (amount, asset, network, etc.).
3. **Client authorizes payment:** Signs a blockchain authorization and retries the request with the `X-PAYMENT` header containing the base64-encoded payment payload.
4. **Server verifies & settles:** Forwards to an x402 facilitator for onchain verification and settlement.
5. **Order completes:** Server returns the order details with a `X-PAYMENT-RESPONSE` header confirming the transaction.

This integration supports physical goods (shipping), digital goods (access keys), and in-store pickup, all with web3 payments.

<br />

## Core Concepts

OCS's power lies in **delegating complexity to `metadata` and making it discoverable**.

Core schemas stay lean—no endless optional fields for variants, sizes, or weights. Domain-specific data resides in a generic `metadata` object.

To avoid chaos, `GET /capabilities` provides a "table of contents" for metadata, linking to standardized JSON Schemas. Clients adapt dynamically, creating a system that's simple by default, complex by choice.

<br />

## API Discovery

OCS provides a comprehensive discovery system that allows clients to locate and bootstrap API endpoints automatically, whether starting from an HTML page, a domain name, or direct API access. Discovery happens through four complementary mechanisms:

1. **`.well-known/ocs` endpoint** (RFC 8615) - The canonical, domain-level source of truth
2. **HTTP headers** (`OCS-Discovery`) - Fast discovery from any HTTP response
3. **JSON-LD blocks** - Machine-readable semantic metadata for crawlers and AI agents
4. **HTML meta tags** - Lightweight hints for browsers and extensions

### Discovery Hierarchy

When multiple sources are available, clients should follow this precedence order:

| Priority | Source | Use Case |
|----------|--------|----------|
| **1** | `/.well-known/ocs` | Authoritative discovery for SDKs and automated clients |
| **2** | `OCS-Discovery` header | Fast discovery when already making HTTP requests |
| **3** | JSON-LD block | Semantic web agents and search engines |
| **4** | HTML meta tags | Browser extensions and manual inspection |

### Example Discovery Flow

```javascript
// 1. Try canonical .well-known endpoint first
const discovery = await fetch('https://shop.example.com/.well-known/ocs')
  .then(r => r.json());

// 2. Use discovered capabilities endpoint
const capabilities = await fetch(discovery.ocs.capabilities)
  .then(r => r.json());

// 3. Proceed with capability-aware client logic
```

For complete details on implementing and using OCS discovery, see the **[OCS Discovery Specification](./docs/ocs-discovery.md)**.

<br />

## The OCS Hypermedia Engine: An API That Guides You

In many APIs, the developer's first step is to read the documentation and hardcode a long list of URL paths into their application. The Open Commerce Standard (OCS) is designed on a more powerful and resilient principle: **Hypermedia as the Engine of Application State (HATEOAS)**.

This sounds complex, but the idea is simple: **instead of memorizing paths, your client "discovers" them.** The API itself tells you what you can do next and provides the exact URLs needed to do it.

### Why Work This Way?

This isn't just an academic exercise; it creates a fundamentally better and more robust integration.

#### 1. No More Brittle URLs
If a server needs to evolve its URL structure (e.g., from `/v1/returns` to `/v2/return-requests`), a client that follows links will **never break**. A client with hardcoded URLs would fail instantly. This makes the entire ecosystem more resilient.

#### 2. A Self-Discovering API
Your application learns the API as it uses it. The presence of a link or an action is the signal that a feature is available. This removes guesswork and the need to constantly consult documentation for every endpoint.

#### 3. Dynamic, Context-Aware UIs
The API provides the logic for your UI. Instead of your client code deciding when to show a "Write a Review" button, the API makes the decision. If the action is present in the response, you show the button. If not, you don't.

#### 4. True Server Freedom
OCS doesn't dictate a server's internal architecture. Your returns system can live on a completely different microservice with a different URL structure, and as long as you provide the correct links, any OCS client can use it seamlessly.

### How It Works: Two Types of Discovery

OCS uses two primary mechanisms for this hypermedia-driven discovery.

#### 1. Global Discovery: The `/capabilities` Endpoint

The first thing your client does is ask the server what it's capable of. This is for server-wide features that aren't tied to a specific product or order.

**Example: Discovering Authentication and Search**

A client makes a `GET /capabilities` request and receives the "table of contents" for the API:

```json
{
  "capabilities": [
    {
      "id": "dev.ocs.auth.flows@1.0",
      "metadata": {
        "signInUrl": "https://auth.example.com/login",
        "profileUrl": "https://api.example.com/users/me"
      }
    },
    {
      "id": "dev.ocs.product.search@1.0",
      "metadata": {
        "urlTemplate": "https://api.example.com/search?q={query}"
      }
    }
  ]
}
```

From this single response, your client now knows:
* **How to sign in:** It doesn't need to know the path is `/login`; it just uses the `signInUrl` provided.
* **How to search:** It doesn't need to guess the query parameter is `q`; it uses the `urlTemplate` to construct a valid search request.

#### 2. Contextual Discovery: The `actions` Array

This is the most powerful feature. Core resources like `Order` and `CatalogItem` will tell you what actions you can perform on them *in their current state*.

**Example: A Discoverable Returns Workflow**

1. A user views a recently delivered order. Your client makes a `GET /orders/order_123`.

2. The server checks its business logic. Because the order is within the 30-day return window, it includes an `initiate_return` action in the response:

```json
{
  "id": "order_123",
  "status": "completed",
  "actions": [
    {
      "id": "initiate_return",
      "href": "https://api.example.com/v2/order/order_123/return-requests"
    }
  ],
  "items": [...]
}
```

3. Your client's logic is now incredibly simple:

```javascript
// Pseudo-code for a UI component
const returnAction = order.actions.find(action => action.id === 'initiate_return');

if (returnAction) {
  // The action is present, so we show the button
  showReturnButton({
    // We tell the button exactly which URL to POST to
    onClick: () => postTo(returnAction.href)
  });
}
```

If the same order were 60 days old, the server would simply omit the `initiate_return` action from the `actions` array. The exact same client code would run, find nothing, and the "Return Items" button would never be rendered. The business logic lives on the server, where it belongs, and the client intelligently adapts.

This same pattern is used for:
* **Cancellations:** The `cancel` action only appears if an order is cancellable.
* **Writing Reviews:** The `add_review` action only appears on a `CatalogItem` if the logged-in user has purchased it.

By embracing this hypermedia-driven approach, the Open Commerce Standard provides a blueprint for a truly modern, resilient, and intelligent commerce ecosystem.

<br />

## Example: A Universal Client Buys a T-Shirt

This narrative demonstrates how a client uses the full power of OCS to interact with an apparel store.

### Step 1: Discover Server Capabilities

The client's first action is to understand the server's features.

**Request:**
`GET /capabilities`

**Response:**
```json
{
  "capabilities": [
    {
      "id": "dev.ocs.product.variants@1.0",
      "schemaUrl": "https://schemas.ocs.dev/product/variants/v1.json"
    },
    {
      "id": "dev.ocs.order.shipment_tracking@1.0",
      "schemaUrl": "https://schemas.ocs.dev/order/shipment_tracking/v1.json"
    }
  ]
}
```
* **Client Insight:** "Okay, this server supports products with variants (like size and color) and will provide shipment tracking details for orders. I can now enable the UI for these features."

### Step 2: View a Product with Structured Metadata

The client fetches a catalog (`/catalogs/{id}`) and gets a product (`CatalogItem`).

**Product Data:**
```json
{
  "id": "prod_123",
  "name": "Classic OCS Tee",
  "price": { "amount": "25.00", "currency": "USD" },
  "fulfillmentType": "physical", // This tells the client to prepare for a shipping address.
  "available": true,
  "metadata": {
    "x-vendor-style-code": "FW25-TEE-01",
    // The key matches the base ID from the capabilities endpoint.
    "dev.ocs.product.variants": {
      "_version": "1.0",
      "options": ["Size", "Color"],
      "variants": [
        {
          "id": "var_large_black", // ID to use when adding to cart.
          "values": ["Large", "Black"],
          "price": { "amount": "25.00", "currency": "USD" },
          "stock": 42
        },
        {
          "id": "var_large_white",
          "values": ["Large", "White"],
          "price": { "amount": "25.00", "currency": "USD" },
          "stock": 0 // This variant is out of stock.
        }
      ]
    }
  }
}
```
* **Client Insight:** The client sees the `dev.ocs.product.variants@1.0` key. It now knows it can confidently parse the data within to build a size/color selection UI and disable the "White" option because its stock is 0.

### Step 3: Place the Order

The user adds `var_large_black` to the cart. During checkout, the client places the order.

**Request:**
`POST /orders`
```json
{
  "cartId": "cart_abc",
  // This field is included because the cart contains a 'physical' item.
  "deliveryAddress": {
    "address": "123 OCS Lane, Protocol City, 1337"
  }
}
```

### Step 4: Handle the Unified Payment Flow

The user adds the item to the cart and proceeds to checkout. The client now makes its first attempt to POST /orders. The server, which supports both crypto and fiat, responds with 402 Payment Required, providing both options.

**Server Response (402 Payment Required):**
```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "fiat_intent",
      "network": "stripe",
      "asset": "USD",
      "maxAmountRequired": "2500",
      "extra": {
        "clientSecret": "pi_3Pq..._secret_XYZ...",
        "displayName": "Credit / Debit Card",
        "inputAction": "Pay $25.00"
      }
    },
    {
      "scheme": "exact",
      "network": "base-sepolia",
      "asset": "0x...",
      "maxAmountRequired": "25000000",
      "extra": {
        "displayName": "Pay with Crypto"
      }
    }
  ]
}
```
* **Client Insight:** "The server has given me two payment options. I don't need to know what 'Stripe' is or how blockchain signing works. I will simply render two buttons using the `displayName` for each. If the user clicks the first, I'll use the provided `clientSecret` to launch the Stripe SDK. If they click the second, I'll initiate the crypto signing flow. The server has done all the hard work for me."

The client then retries the `POST /orders` request with the appropriate `X-PAYMENT` header after the user completes one of the flows.

### Step 5: Track the Order in Real-Time

The client immediately opens a connection to the SSE endpoint.

**Request:**
`GET /orders/{orderId}/updates`

**Response Stream:**
```
# --- Order is confirmed ---
# The programmatic state and detailed status are added atomically.
event: order.patch
data: [
  {"op": "replace", "path": "/status", "value": "confirmed"},
  {"op": "add", "path": "/metadata/dev.ocs.order.detailed_status", "value": {
    "_version": "1.0",
    "title": "Order Confirmed",
    "description": "Your order has been confirmed and will be processed soon."
  }}
]

# --- Order is in transit, and a driver is assigned ---
# The core status changes, and two new metadata capabilities are added.
event: order.patch
data: [
  {"op": "replace", "path": "/status", "value": "in_transit"},
  {"op": "replace", "path": "/metadata/dev.ocs.order.detailed_status/title", "value": "Out for Delivery"},
  {"op": "add", "path": "/metadata/dev.ocs.order.delivery_tracking", "value": {
    "_version": "1.0",
    "driver": { "name": "Jane D.", "vehicle": "Blue Sedan" },
    "status": "en_route_to_customer",
    "liveLocation": { "latitude": 40.7135, "longitude": -74.0050 },
    "estimatedArrivalAt": "2025-10-22T19:30:00Z"
  }}
]

# --- Live location is updated moments later ---
# A tiny, efficient patch is sent for only the data that changed.
event: order.patch
data: [{"op": "replace", "path": "/metadata/dev.ocs.order.delivery_tracking/liveLocation", "value": {"latitude": 40.7140, "longitude": -74.0045}}]
```
* **Client Insight:** The client's UI updates the status to "Shipped." Because it saw the `dev.ocs.order.shipment_tracking@1.0` capability in Step 1, it knows to look for the `dev.ocs.order.shipment_tracking` key in the metadata and can now display a "Track Your Shipment" button that links to the `trackingUrl`.

<br />

## Handling Different Commerce Models

OCS is designed to be flexible. Not all transactions are created equal, and the standard provides the tools to handle both complex and simple checkout flows gracefully.

### The Standard Stateful Cart

By default, OCS uses a robust, server-side `Cart` resource. This is the ideal foundation for traditional e-commerce, where users add multiple items, apply promotions, and calculate shipping before committing to a purchase. The server manages the state, ensuring data is always accurate and validated at every step.

### The "Buy Now" Flow (dev.ocs.order.direct@1.0)

For use cases like purchasing a single digital article, re-ordering a meal, or other quick transactions, servers can implement the Direct Order capability. This allows a client to bypass the cart and create an order directly from a list of items.

A client discovers this capability at runtime and can dynamically render both "Add to Cart" and "Buy Now" buttons, providing the perfect, context-aware user experience for any product.

<br />

## Cart vs. Direct Order Discovery

OCS makes cart support and direct order support explicit and discoverable through capabilities. This eliminates guesswork and enables clients to provide the optimal user experience based on what the server supports.

### How It Works

Clients check the `/capabilities` endpoint for two key capabilities:

- **`dev.ocs.cart@1.0`**: Server supports stateful shopping carts with lifecycle policies
- **`dev.ocs.order.direct@1.0`**: Server supports cart-less "Buy Now" orders

### Client Decision Logic

```javascript
// Step 1: Discover capabilities
const capabilities = await fetch('/capabilities').then(r => r.json());
const capIds = capabilities.capabilities.map(c => c.id);

const hasCart = capIds.includes('dev.ocs.cart');
const hasDirect = capIds.includes('dev.ocs.order.direct');

// Step 2: Determine UI based on capabilities
if (!hasCart && !hasDirect) {
  throw new Error('Server supports neither cart nor direct order creation');
}

if (hasCart && hasDirect) {
  // Show both "Add to Cart" AND "Buy Now" buttons
  renderProductPage({
    buttons: ['addToCart', 'buyNow']
  });

  // Get cart policies for UI hints
  const cartCap = capabilities.capabilities.find(c => c.id === 'dev.ocs.cart');
  if (cartCap.metadata?.lifetimeSeconds) {
    showCartExpirationTimer(cartCap.metadata.lifetimeSeconds);
  }
} else if (hasCart) {
  // Traditional cart-only flow
  renderProductPage({ buttons: ['addToCart'] });
} else {
  // Direct-only (minimal cart-less server)
  renderProductPage({ buttons: ['buyNow'] });
}
```

### Why This Matters

- **No Trial-and-Error**: Clients know exactly what endpoints exist without making failing requests
- **Dynamic UI**: Show the right buttons based on server capabilities
- **Cart Policies**: The `dev.ocs.cart` capability metadata includes `lifetimeSeconds`, `maxItems`, and other policies that help clients provide better UX (e.g., showing cart expiration timers)
- **Explicit Design**: Mixing cart and direct order discovery is now explicit, not implicit

<br />

## Error Handling

OCS provides a comprehensive, machine-readable error catalog in the OpenAPI specification that defines every error code's behavior, common causes, and recovery strategies.

### RFC 9457 Compliant Error Response

All errors follow RFC 9457 problem details format with extensions for backward compatibility:

```json
{
  "type": "https://schemas.ocs.dev/errors/cart-expired",
  "title": "Cart Expired",
  "status": 410,
  "detail": "Cart expired after 3600 seconds of inactivity",
  "instance": "https://api.example.com/carts/123",
  "timestamp": "2023-10-23T12:00:00Z",
  "localizationKey": "error.cart.expired",
  "nextActions": [
    {
      "id": "create_new_cart",
      "href": "/carts",
      "method": "POST",
      "title": "Create New Cart",
      "requestSchema": {
        "type": "object",
        "properties": {
          "storeId": { "type": "string" }
        }
      },
      "responseSchema": {
        "$ref": "https://schemas.ocs.dev/cart/v1.json"
      }
    }
  ]
}
```

### Common Error Patterns

#### Cart Expiration (410 Gone)

When a cart expires due to inactivity:

```javascript
try {
  await createOrder({ cartId });
} catch (error) {
  if (error.type?.endsWith('/cart-expired')) {
    // Use nextActions for automated recovery
    const createAction = error.nextActions?.find(a => a.id === 'create_new_cart');
    if (createAction) {
      const newCart = await ocsRequest(createAction.href, {
        method: createAction.method,
        body: JSON.stringify({ storeId: 'main' })
      });
      // Add items and retry
      return createOrder({ cartId: newCart.id });
    }
  }
}
```

**Prevention**: Check the `dev.ocs.cart` capability's `metadata.lifetimeSeconds` and ensure cart updates happen before expiration.

#### Cart Not Found (404 Not Found)

The cart may have been converted to an order:

```javascript
if (error.type?.endsWith('/cart-not-found')) {
  // Check if cart became an order
  const orders = await fetch('/orders').then(r => r.json());
  const recentOrder = orders.orders.find(o => o.createdAt > lastCartUpdate);

  if (recentOrder) {
    // Navigate to order page
    navigateTo(`/orders/${recentOrder.id}`);
  } else {
    // Create new cart
    createNewCart();
  }
}
```

### Full Error Catalog

The complete error catalog with HTTP status codes, retry strategies, common causes, and recovery actions is available in the `x-error-catalog` section of [`spec.yaml`](./src/spec.yaml).

<br />

## Capabilities Reference

Capabilities are the heart of OCS's extensibility. The following standard capabilities are defined:

| Capability ID | Applies To | Description | Schema URL |
| :--- | :--- | :--- | :--- |
| **`dev.ocs.discovery@1.0`** | Server-wide | Defines standardized discovery metadata for OCS endpoints via HTML, JSON-LD, HTTP headers, and `.well-known` URLs. See [OCS Discovery Specification](./docs/ocs-discovery.md). | [capabilities/discovery/v1.json](./schemas/capabilities/discovery/v1.json) |
| **`dev.ocs.product.variants@1.0`** | Product (`CatalogItem`) | Defines user-selectable options (e.g., size, color) and their corresponding variants, each with its own ID, price, and stock. | [product/variants/v1.json](./schemas/product/variants/v1.json) |
| **`dev.ocs.product.customization@1.0`** | Product (`CatalogItem`) | Defines complex, selectable modifiers for a menu item (e.g., toppings, sides). | [product/customization/v1.json](./schemas/product/customization/v1.json) |
| **`dev.ocs.product.addons@1.0`** | Product (`CatalogItem`) | Defines simple, selectable add-ons for a product, such as gift wrapping, extended warranty, or side dishes. | [product/addons/v1.json](./schemas/product/addons/v1.json) |
| **`dev.ocs.product.physical_properties@1.0`** | Product (`CatalogItem`) | Defines physical properties like weight and dimensions, primarily for shipping estimation. | [product/physical_properties/v1.json](./schemas/product/physical_properties/v1.json) |
| **`dev.ocs.restaurant.profile@1.0`** | Store | Adds restaurant-specific data like cuisine, hours, price range, and ratings. | [restaurant/profile/v1.json](./schemas/restaurant/profile/v1.json) |
| **`dev.ocs.order.kitchen_status@1.0`** | Order | Provides real-time updates on an order's status within the kitchen. | [restaurant/kitchen_status/v1.json](./schemas/restaurant/kitchen_status/v1.json) |
| **`dev.ocs.order.delivery_tracking@1.0`** | Order | Provides a real-time data structure for tracking a delivery, including driver info, GPS, and ETA. | [order/delivery_tracking/v1.json](./schemas/order/delivery_tracking/v1.json) |
| **`dev.ocs.order.shipment_tracking@1.0`** | Order | Provides an array of shipment objects, each with a carrier, tracking number, and URL to track the package. | [order/shipment_tracking/v1.json](./schemas/order/shipment_tracking/v1.json) |
| **`dev.ocs.order.tipping@1.0`** | Order | Allows for adding tips to the order. Ratings are submitted via a dedicated action endpoint. | [order/tipping/v1.json](./schemas/order/tipping/v1.json) |
| **`dev.ocs.order.digital_access@1.0`** | Order | Provides an array of objects containing access details for digital goods, such as download URLs or license keys. | [order/digital_access/v1.json](./schemas/order/digital_access/v1.json) |
| **`dev.ocs.order.detailed_status@1.0`** | Order | Provides a rich, human-readable status (title, description, progress) for display in a UI, augmenting the core `status` field. | [order/detailed_status/v1.json](./schemas/order/detailed_status/v1.json) |
| **`dev.ocs.order.cancellation@1.0`** | Order (Action) | Enables the workflow for cancelling an order via a dedicated endpoint, discoverable through the `Order.actions` field. | N/A (Workflow) |
| **`dev.ocs.order.returns@1.0`** | Order (Action) | Enables a discoverable workflow for item returns, initiated via an action on the Order and navigated via hypermedia links. | N/A (Workflow) |
| **`dev.ocs.order.refunds@1.0`** | Order (Metadata) | Provides a standardized, auditable record of all monetary refunds associated with an order. | [order/refunds/v1.json](./schemas/order/refunds/v1.json) |
| **`dev.ocs.promotions.discoverable@1.0`** | Store, Catalog | Allows a server to advertise publicly available promotions to clients. | [promotions/discoverable/v1.json](./schemas/promotions/discoverable/v1.json) |
| **`dev.ocs.promotions.policies@1.0`** | Server-wide | Defines promotion stacking rules, validation policies, and exclusion rules to help clients provide better UX and prevent promotion conflicts. | [promotions/policies/v1.json](./schemas/promotions/policies/v1.json) |
| **`dev.ocs.order.applied_promotions@1.0`** | Order | Provides a final, authoritative record of all value modifications on the completed order. | [order/applied_promotions/v1.json](./schemas/order/applied_promotions/v1.json) |
| **`dev.ocs.order.fulfillment_intent@1.0`** | CreateOrderRequest | Allows a client to specify a precise fulfillment plan for the items in a cart, supporting mixed fulfillment and split orders. | [order/fulfillment_intent/v1.json](./schemas/order/fulfillment_intent/v1.json) |
| **`dev.ocs.store.constraints@1.0`** | Store | Advertises server-side business rules (e.g., promotion policies, return windows) to help clients prevent errors. | [store/constraints/v1.json](./schemas/store/constraints/v1.json) |
| **`dev.ocs.store.info@1.0`** | Store | Provides general store information including location, hours, website, and contact details, referencing schema.org LocalBusiness properties. | [store/info/v1.json](./schemas/store/info/v1.json) |
| **`dev.ocs.store.policies@1.0`** | Store | Provides URLs to store policies such as return policy, privacy policy, terms of service, etc. | [store/policies/v1.json](./schemas/store/policies/v1.json) |
| **`dev.ocs.user.profile@1.0`** | Server-wide | Provides user-specific data like saved addresses and preferences via a discoverable profile endpoint. | [user/profile/v1.json](./schemas/user/profile/v1.json) |
| **`dev.ocs.cart.guest@1.0`** | Server-wide | Allows carts to include temporary customer information for anonymous guest checkouts. | N/A (Extends Cart schema) |
| **`dev.ocs.order.customer_fields@1.0`** | Order | Defines common custom fields for international commerce, tax, and customs purposes. | [order/customer_fields/v1.json](./schemas/order/customer_fields/v1.json) |
| **`dev.ocs.store.shipping@1.0`** | Store | Defines comprehensive shipping policies including delivery areas, pricing calculations, processing times, shipping options, and providers. | [store/shipping/v1.json](./schemas/store/shipping/v1.json) |
| **`dev.ocs.auth.flows@1.0`** | Server-wide | Provides authentication flow URLs, token format information, and supported authentication methods (password, OAuth2, SIWE, magic link, WebAuthn). | [auth/flows/v1.json](./schemas/auth/flows/v1.json) |
| **`dev.ocs.product.search@1.0`** | Server-wide | Provides a URL template for product search with supported sort options. | [product/search/v1.json](./schemas/product/search/v1.json) |
| **`dev.ocs.product.categorization@1.0`** | Product (`CatalogItem`) | Provides an ordered category path (breadcrumb) for navigation. | [product/categorization/v1.json](./schemas/product/categorization/v1.json) |
| **`dev.ocs.product.relations@1.0`** | Product (`CatalogItem`) | Provides related products (recommendations, accessories, alternatives). | [product/relations/v1.json](./schemas/product/relations/v1.json) |
| **`dev.ocs.payment.x402_fiat@1.0`** | Server-wide | Advertises support for fiat payments via the x402 `fiat_intent` scheme and provides public keys for payment providers. | [payment/x402_fiat/v1.json](./schemas/payment/x402_fiat/v1.json) |
| **`dev.ocs.payment.web_payments@1.0`** | Server-wide | Enables W3C Payment Request API integration for streamlined checkout with saved payment methods and native browser UIs. See [Web Payments & SPC Guide](./docs/web-payments-spc.md). | [payment/web_payments/v1.json](./schemas/payment/web_payments/v1.json) |
| **`dev.ocs.payment.spc@1.0`** | Server-wide | Enables W3C Secure Payment Confirmation for biometric payment authorization via WebAuthn, reducing fraud and improving conversion. See [Web Payments & SPC Guide](./docs/web-payments-spc.md). | [payment/spc/v1.json](./schemas/payment/spc/v1.json) |
| **`dev.ocs.auth.webauthn@1.0`** | Server-wide | Provides WebAuthn/FIDO2 configuration for phishing-resistant biometric authentication (passkeys). Extends `dev.ocs.auth.flows@1.0` when 'webauthn' is included in methods. | [auth/webauthn/v1.json](./schemas/auth/webauthn/v1.json) |
| **`dev.ocs.cart@1.0`** | Server-wide | Indicates support for stateful, server-side shopping carts with configurable lifecycle policies (expiration, limits, persistence). | [cart/v1.json](./schemas/cart/v1.json) |
| **`dev.ocs.order.direct@1.0`** | Server-wide | Indicates support for cart-less "Buy Now" orders created directly from items, bypassing the cart entirely. | [order/direct/v1.json](./schemas/order/direct/v1.json) |
| **`dev.ocs.i18n@1.0`** | Server-wide | Provides internationalization support including supported locales, default locale, and formatting rules for numbers, currencies, and dates. | [i18n/v1.json](./schemas/i18n/v1.json) |
| **`dev.ocs.order.subscription@1.0`** | Order | Defines recurring subscription orders with frequency, billing cycles, and cancellation policies. | [order/subscription/v1.json](./schemas/order/subscription/v1.json) |
| **`dev.ocs.order.preorder@1.0`** | Product (`CatalogItem`) | Defines preorder information for items not yet available, including release dates and payment timing. | [order/preorder/v1.json](./schemas/order/preorder/v1.json) |
| **`dev.ocs.service.scheduling@1.0`** | Product (`CatalogItem`) | Defines scheduling information for service-based items like appointments, including time slots and booking constraints. | [service/scheduling/v1.json](./schemas/service/scheduling/v1.json) |
| **`dev.ocs.resource.versioning@1.0`** | All Resources | Enables immutable versioning for resources, creating a full audit trail of changes where each mutation creates a new resource version. See [Immutable Resource Versioning Guide](./docs/immutable-resource-versioning.md). | [resource/versioning/v1.json](./schemas/resource/versioning/v1.json)[Immutable Resource Versioning Guide](./docs/immutable-resource-versioning.md) |
| **`dev.ocs.hypermedia.schema_aware_actions@1.0`** | Actions | Extends hypermedia actions to include request/response schema references, enabling dynamic client generation, form building, and truly self-documenting APIs. See [Schema-Aware Actions Guide](./docs/schema-aware-actions.md). | [hypermedia/schema_aware_actions/v1.json](./schemas/hypermedia/schema_aware_actions/v1.json) |
| **`dev.ocs.server.webhooks@1.0`** | Server-wide | Enables server-to-server event notifications via webhooks. Servers advertise supported events and provide subscription management endpoints for asynchronous backend system integrations (inventory, shipping, ERP, etc.). | [server/webhooks/v1.json](./schemas/server/webhooks/v1.json) |

<br />

## Versioning Rules

OCS uses semantic versioning for capabilities and the overall standard.

- **PATCH (1.0 → 1.1):** Add optional fields, no breaking changes. Clients can safely upgrade without changes.
- **MINOR (1.x → 2.0):** Breaking changes allowed, must provide migration guide. Servers announce deprecation 3 months in advance.
- **Deprecation:** Servers must support old versions for at least 12 months after sunset announcement.

Clients negotiate versions via the `Accept-OCS-Capabilities` header (comma-separated list of capability IDs with versions, e.g., `dev.ocs.product.variants@2.0`). If omitted, servers use default versions.

For detailed versioning strategy, multi-version support, client negotiation, deprecation policies, and migration examples, see the **[Capability Versioning Guide](./docs/capability-versioning.md)**.

## Future Direction

OCS is a living standard. The future direction includes:
*   **Developing official Client SDKs and Server Middleware:** Building high-quality, open-source libraries that make implementing OCS trivial for both client and server developers.
*   **Expanding the Capability Library:** Adding new standard schemas for emerging commerce concepts like subscriptions, bookings, and advanced personalization.
*   **Formalizing a Community Governance Model:** Establishing processes for proposing, reviewing, and adopting new capabilities to ensure the standard evolves responsibly.
*   **Alternative Transport Layers:** Exploring implementations over transports beyond HTTP, such as asynchronous message queues or other protocols.

<br />

## Implementation Notes

- **Always discover capabilities first:** Call `GET /capabilities` to adapt dynamically—never hardcode features.
- **Use full Capability IDs as metadata keys:** E.g., `"dev.ocs.product.variants@1.0"` to link to schemas.
- **Handle missing capabilities gracefully:** Fall back to basic representations if optional features aren't supported.
- **Require idempotency:** Include `Idempotency-Key` header in all state-changing requests (POST, PATCH, DELETE) to prevent duplicates. Servers store keys for 24 hours minimum.
- **Support all fulfillment types:** Design checkout for `physical` (shipping), `digital`, and `pickup` items in any cart.

<br />

## Quick Reference

| Endpoint | Verb | Description | Auth |
| :--- | :--- | :--- | :--- |
| `/.well-known/ocs` | `GET` | **OCS Discovery endpoint - canonical location of API resources.** | No |
| `/capabilities` | `GET` | **Discover server features and metadata schemas.** | No |
| `/stores` | `GET` | List available vendors/stores. | No |
| `/catalogs` | `GET` | List available catalogs. | No |
| `/catalogs/{id}` | `GET` | Get a full product catalog. | No |
| `/carts` | `POST` | Create a new shopping cart. | Yes |
| `/carts/{id}` | `GET` | Get a cart by ID. | Yes |
| `/carts/{id}/items` | `POST` | Add an item to the cart. | Yes |
| `/carts/{id}/items/{itemId}` | `PATCH`/`DELETE` | Update or remove an item. | Yes |
| `/orders` | `POST` | Place an order from a cart. Order type is inferred from cart contents. May return 402 if payment is required. | Yes |
| `/orders/{id}` | `GET` | Get the current state of an order. | Yes |
| `/orders/{id}/updates` | `GET` | **Subscribe to real-time order updates via SSE.** | Yes |
| `/orders/{id}/cancel` | `POST` | Request to cancel an order. | Yes |
| `/carts/{cartId}/promotions` | `POST` | Apply or validate a promotion on a cart. | Yes |
| `/webhooks` | `GET` | List all webhook subscriptions. | Yes |
| `/webhooks` | `POST` | Create a new webhook subscription. | Yes |
| `/webhooks/{id}` | `GET` | Get a webhook subscription by ID. | Yes |
| `/webhooks/{id}` | `DELETE` | Delete a webhook subscription. | Yes |

<br />

## Content Type

All API requests and responses use the custom media type `application/ocs+json; version=1.0`. Clients should set the `Accept` and `Content-Type` headers accordingly:

```
Accept: application/ocs+json; version=1.0
Content-Type: application/ocs+json; version=1.0
```

<br />

## Pagination

List endpoints (`GET /stores`, `GET /catalogs`, `GET /orders`) return paginated responses using cursor-based pagination.

### Request

```http
GET /stores?limit=20&cursor=eyJpZCI6InN0b3JlXzIwIn0
```

### Response

```json
{
  "stores": [
    { "id": "store_1", "name": "Store 1", ... }
  ],
  "pagination": {
    "limit": 20,
    "nextCursor": "eyJpZCI6InN0b3JlXzQwIn0",
    "previousCursor": null,
    "totalCount": 157
  }
}
```

### Client Usage

```javascript
let cursor = null;
const allStores = [];

do {
  const url = `/stores?limit=20${cursor ? `&cursor=${cursor}` : ''}`;
  const response = await fetch(url);
  const data = await response.json();

  allStores.push(...data.stores);
  cursor = data.pagination.nextCursor;
} while (cursor);
```

<br />

## Contributing

This is an open standard, and contributions are welcome. Please open an issue or pull request to suggest changes, propose new standard capability modules, or report any issues.

## License

The Open Commerce Standard is open-source and available under the **[MIT License](./LICENSE)**.
