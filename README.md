<div align="left">
  <img src="assets/logo.png" alt="Open Commerce Standard Logo" width="150">
</div>

# Open Commerce Standard (OCS)

| Spec Version | Status | License |
| :--- | :--- | :--- |
| **1.0.0** | **Active & Ready for Implementation** | **MIT** |

## Introduction

The Open Commerce Standard (OCS) is an open, extensible API specification for digital commerce, enabling universal clients to interact with any compliant server—from simple product catalogs to complex e-commerce platforms. By leveraging HTTP semantics, capability discovery, and structured metadata, OCS supports physical goods, digital services, and in-store pickup while prioritizing implementer freedom. It integrates web3-native payments via the x402 Protocol for instant, low-fee blockchain transactions.

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

## Getting Started

1. **Review the Specification:** Read the [OpenAPI spec](./src/spec.yaml) for the full API details.
2. **Implement Core Endpoints:** Start with discovery (`/capabilities`, `/stores`, `/catalogs`) and cart/order flows.
3. **Add Capabilities:** Implement optional features like variants or tracking via standard schemas.
4. **Build Clients:** Use capability discovery for adaptive apps compatible with any OCS server.

## Key Features

*   **Universal Commerce Model:** A single, elegant model handles **physical goods**, **digital goods/services**, and **in-store pickup** using a simple `fulfillmentType` flag.
*   **Dynamic Capability Discovery:** The `GET /capabilities` endpoint allows a client to understand a server's full feature set, enabling truly adaptive applications.
*   **Real-time Order Updates:** A built-in Server-Sent Events (SSE) endpoint (`/orders/{id}/updates`) provides efficient, real-time order status changes using standardized JSON Patch.
*   **Structured, Extensible Metadata:** Go beyond simple key-value pairs. OCS provides a system for servers to link to official JSON Schemas that define the structure of their `metadata`.
*   **Web3-Native Payments:** Includes a complete, protocol-compliant implementation for handling payments via the [x402 Protocol](https://github.com/coinbase/x402).
*   **Formal Security Model:** Recommends and formalizes a `Bearer` token authentication scheme for all protected resources.

<br />

## X402 Protocol Compliance

OCS integrates the [x402 Protocol](https://github.com/coinbase/x402), Coinbase's open standard for internet-native payments, to enable seamless, blockchain-based transactions within the order lifecycle. This makes OCS "web3-native," allowing for instant, programmable payments using stablecoins like USDC.

**Furthermore, OCS leverages the x402 protocol's extensibility to support traditional fiat payments.** Through the `fiat_intent` scheme, servers can handle secure, modern payment flows from providers like Stripe and PayPal, all within the same elegant request/retry cycle. This provides implementers with a single, unified protocol for both web3 and traditional e-commerce.

### Why X402?

Traditional payment systems (credit cards, PayPal) suffer from high fees (2-3% + processing costs), slow settlement (days), chargeback risks, and friction for machine-to-machine transactions. X402 addresses these by:

- **Micropayments & Pay-Per-Use:** Charge per API call, content access, or item without subscriptions or minimums.
- **Instant Settlement:** Blockchain-based transactions settle in seconds, not days.
- **Low/No Fees:** Near-zero transaction costs compared to legacy rails.
- **AI & Agent Friendly:** Enables autonomous payments by AI agents without human intervention.
- **Programmable:** Direct HTTP integration via the 402 status code, extensible across chains.

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
    // The key matches the ID from the capabilities endpoint.
    "dev.ocs.product.variants@1.0": {
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

### Step 4: Track the Order in Real-Time

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
  {"op": "add", "path": "/metadata/dev.ocs.order.detailed_status@1.0", "value": {
    "title": "Order Confirmed",
    "description": "Your order has been confirmed and will be processed soon."
  }}
]

# --- Order is in transit, and a driver is assigned ---
# The core status changes, and two new metadata capabilities are added.
event: order.patch
data: [
  {"op": "replace", "path": "/status", "value": "in_transit"},
  {"op": "replace", "path": "/metadata/dev.ocs.order.detailed_status@1.0/title", "value": "Out for Delivery"},
  {"op": "add", "path": "/metadata/dev.ocs.order.delivery_tracking@1.0", "value": {
    "driver": { "name": "Jane D.", "vehicle": "Blue Sedan" },
    "status": "en_route_to_customer",
    "liveLocation": { "latitude": 40.7135, "longitude": -74.0050 },
    "estimatedArrivalAt": "2025-10-22T19:30:00Z"
  }}
]

# --- Live location is updated moments later ---
# A tiny, efficient patch is sent for only the data that changed.
event: order.patch
data: [{"op": "replace", "path": "/metadata/dev.ocs.order.delivery_tracking@1.0/liveLocation", "value": {"latitude": 40.7140, "longitude": -74.0045}}]
```
* **Client Insight:** The client's UI updates the status to "Shipped." Because it saw the `dev.ocs.order.shipment_tracking@1.0` capability in Step 1, it knows to look for that key in the metadata and can now display a "Track Your Shipment" button that links to the `trackingUrl`.

<br />

## Capabilities Reference

Capabilities are the heart of OCS's extensibility. The following standard capabilities are defined:

| Capability ID | Applies To | Description | Schema URL |
| :--- | :--- | :--- | :--- |
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
| **`dev.ocs.order.applied_promotions@1.0`** | Order | Provides a final, authoritative record of all value modifications on the completed order. | [order/applied_promotions/v1.json](./schemas/order/applied_promotions/v1.json) |
| **`dev.ocs.order.fulfillment_intent@1.0`** | CreateOrderRequest | Allows a client to specify a precise fulfillment plan for the items in a cart, supporting mixed fulfillment and split orders. | [order/fulfillment_intent/v1.json](./schemas/order/fulfillment_intent/v1.json) |
| **`dev.ocs.store.constraints@1.0`** | Store | Advertises server-side business rules (e.g., promotion policies, return windows) to help clients prevent errors. | [store/constraints/v1.json](./schemas/store/constraints/v1.json) |
| **`dev.ocs.auth.flows@1.0`** | Server-wide | Provides URLs for authentication flows (sign-in, sign-out, profile, registration). | [auth/flows/v1.json](./schemas/auth/flows/v1.json) |
| **`dev.ocs.product.search@1.0`** | Server-wide | Provides a URL template for product search with supported sort options. | [product/search/v1.json](./schemas/product/search/v1.json) |
| **`dev.ocs.product.categorization@1.0`** | Product (`CatalogItem`) | Provides an ordered category path (breadcrumb) for navigation. | [product/categorization/v1.json](./schemas/product/categorization/v1.json) |
| **`dev.ocs.product.relations@1.0`** | Product (`CatalogItem`) | Provides related products (recommendations, accessories, alternatives). | [product/relations/v1.json](./schemas/product/relations/v1.json) |
| **`dev.ocs.payment.x402_fiat@1.0`** | Server-wide | Advertises support for fiat payments via the x402 `fiat_intent` scheme and provides public keys for payment providers. | [payment/x402_fiat/v1.json](./schemas/payment/x402_fiat/v1.json) |

<br />

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
- **Require idempotency:** Include `Idempotency-Key` in all state-changing requests to prevent duplicates.
- **Support all fulfillment types:** Design checkout for `physical` (shipping), `digital`, and `pickup` items in any cart.

<br />

## Quick Reference

| Endpoint | Verb | Description | Auth |
| :--- | :--- | :--- | :--- |
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

<br />

## Content Type

All API requests and responses use the custom media type `application/ocs+json; version=1.0`. Clients should set the `Accept` and `Content-Type` headers accordingly:

```
Accept: application/ocs+json; version=1.0
Content-Type: application/ocs+json; version=1.0
```

<br />

## Contributing

This is an open standard, and contributions are welcome. Please open an issue or pull request to suggest changes, propose new standard capability modules, or report any issues.

## License

The Open Commerce Standard is open-source and available under the **[MIT License](./LICENSE)**.