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
Traditional e-commerce APIs are fragmented and vendor-specific. OCS provides a consistent, extensible framework that adapts to any business model—from simple menus to complex apparel stores—without dictating internal logic. It prioritizes implementer freedom while enabling universal, adaptive clients.

**How does OCS work?**  
Clients begin by discovering server capabilities (`GET /capabilities`), then browse catalogs/menus, manage carts, and place orders. Real-time updates stream via Server-Sent Events. Complexity is delegated to structured `metadata` linked to JSON Schemas, allowing clients to adapt dynamically without hardcoding features.

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
2. **Implement Core Endpoints:** Start with discovery (`/capabilities`, `/restaurants`, `/menus`) and cart/order flows.
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

The client fetches a catalog (`/menus/{id}`) and gets a product (`MenuItem`).

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
  "orderType": "delivery",
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
// The server confirms the order
event: order.patch
data: [{"op": "replace", "path": "/status", "value": "confirmed"}]

// A few hours later, the order is shipped. The server adds the tracking info
// to the metadata, which is sent as another patch.
event: order.patch
data: [
  {"op": "replace", "path": "/status", "value": "shipped"},
  {"op": "add", "path": "/metadata/dev.ocs.order.shipment_tracking@1.0", "value": [
    {
      "carrier": "UPS",
      "trackingNumber": "1Z999ABCDEFG",
      "trackingUrl": "https://www.ups.com/track?tracknum=1Z999ABCDEFG"
    }
  ]}
]
```
* **Client Insight:** The client's UI updates the status to "Shipped." Because it saw the `dev.ocs.order.shipment_tracking@1.0` capability in Step 1, it knows to look for that key in the metadata and can now display a "Track Your Shipment" button that links to the `trackingUrl`.

<br />

## Capabilities Reference

Capabilities are the heart of OCS's extensibility. The following standard capabilities are defined:

| Capability ID | Applies To | Description | Schema URL |
| :--- | :--- | :--- | :--- |
| **`dev.ocs.product.variants@1.0`** | Product (`MenuItem`) | Defines user-selectable options (e.g., size, color) and their corresponding variants, each with its own ID, price, and stock. | [product/variants/v1.json](./schemas/product/variants/v1.json) |
| **`dev.ocs.order.shipment_tracking@1.0`** | Order | Provides an array of shipment objects, each with a carrier, tracking number, and URL to track the package. | [order/shipment_tracking/v1.json](./schemas/order/shipment_tracking/v1.json) |
| **`dev.ocs.order.digital_access@1.0`** | Order | Provides an array of objects containing access details for digital goods, such as download URLs or license keys. | [order/digital_access/v1.json](./schemas/order/digital_access/v1.json) |
| **`dev.ocs.product.physical_properties@1.0`** | Product (`MenuItem`) | Defines physical properties like weight and dimensions, primarily for shipping estimation. | [product/physical_properties/v1.json](./schemas/product/physical_properties/v1.json) |

<br />

## Future Direction

OCS is a living standard. The future direction includes:
*   **A Richer Capability Library:** Developing more standard schemas for concepts like `product.reviews`, `order.returns`, and `service.bookings`.
*   **Alternative Transport Layers:** Exploring implementations over transports beyond HTTP, such as asynchronous message queues or other protocols.
*   **Tooling and SDKs:** Fostering a community to build server middleware and client libraries that make implementing OCS trivial.
*   **Authentication Capabilities:** Defining standard capabilities for advertising supported authentication methods (e.g., `dev.ocs.auth.oauth2.pkce@1.0`).

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
| `/restaurants` | `GET` | List available vendors/stores. | No |
| `/menus` | `GET` | List available catalogs/menus. | No |
| `/menus/{id}` | `GET` | Get a full product catalog/menu. | No |
| `/carts` | `POST` | Create a new shopping cart. | Yes |
| `/carts/{id}` | `GET` | Get a cart by ID. | Yes |
| `/carts/{id}/items` | `POST` | Add an item to the cart. | Yes |
| `/carts/{id}/items/{itemId}` | `PATCH`/`DELETE` | Update or remove an item. | Yes |
| `/orders` | `POST` | Place an order from a cart. | Yes |
| `/orders/{id}` | `GET` | Get the current state of an order. | Yes |
| `/orders/{id}/updates` | `GET` | **Subscribe to real-time order updates via SSE.** | Yes |

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