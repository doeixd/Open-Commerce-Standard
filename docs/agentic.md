
# Integration Guide: OCS and the Agentic Checkout Spec

**Status:** Implementation Guide
**Applies To:** OCS v1.0.0
**Goal:** Enable an OCS-compliant server to also function as a merchant backend for OpenAI's Agentic Checkout, allowing transactions to be initiated by ChatGPT.

---

### Table of Contents

1.  [Core Concepts and Integration Strategy](#1-core-concepts-and-integration-strategy)
2.  [The Challenge: Bridging Two Different Models](#2-the-challenge-bridging-two-different-models)
3.  [The Solution: The Adapter Pattern](#3-the-solution-the-adapter-pattern)
4.  [Mapping Agentic Checkout Endpoints to OCS Resources](#4-mapping-agentic-checkout-endpoints-to-ocs-resources)
5.  [Data Model Translation Layer](#5-data-model-translation-layer)
6.  [Handling Payments](#6-handling-payments)
7.  [Implementing Webhooks](#7-implementing-webhooks)
8.  [Proposed OCS Capability for Discovery](#8-proposed-ocs-capability-for-discovery)
9.  [Example End-to-End Flow](#9-example-end-to-end-flow)

---

## 1. Core Concepts and Integration Strategy

The **Open Commerce Standard (OCS)** provides a universal, resource-oriented API for commerce (`/catalogs`, `/carts`, `/orders`). The **Agentic Checkout Spec (ACS)** defines a specific, session-based API (`/checkout_sessions`) for an AI agent (like ChatGPT) to conduct a checkout on behalf of a user.

While they have different structures, their underlying goals are the same: representing a user's intent to purchase. The integration strategy is **not to modify OCS**, but to **build an adapter layer** on top of an existing OCS implementation. This adapter will expose the ACS-required endpoints and translate ACS requests into native OCS operations.

This approach allows a merchant to maintain a single, standard OCS-compliant backend that can serve both universal OCS clients *and* specialized agents like ChatGPT.



## 2. The Challenge: Bridging Two Different Models

The primary challenge lies in mapping the stateful, iterative model of ACS's `CheckoutSession` to OCS's resource model.

| Agentic Checkout Spec (ACS) | Open Commerce Standard (OCS) | Key Difference |
| :--- | :--- | :--- |
| **`CheckoutSession` Resource** | **`Cart` Resource** | ACS's `CheckoutSession` is essentially a super-powered OCS `Cart`, containing items, totals, and fulfillment options. |
| **Iterative `POST` Updates** | **RESTful Verbs** (`POST`, `PATCH`, `DELETE`) | ACS uses `POST` to both create and update a session. OCS uses distinct verbs for creating a cart, adding items, and updating them. |
| **Specific Endpoints** | **Resource-Oriented Endpoints** | ACS dictates `/checkout_sessions`. OCS uses `/carts` and `/orders`. |
| **Integer-based Pricing** | **String-based Decimal Pricing** | ACS uses minor units (e.g., `300` for $3.00). OCS uses strings (e.g., `"3.00"`) to avoid precision issues. |

## 3. The Solution: The Adapter Pattern

You will create a new set of endpoints (`/checkout_sessions`) on your server that act as a facade. This adapter will:
1.  Receive requests from OpenAI compliant with the ACS.
2.  Internally, create and manage an OCS `Cart` resource to hold the state.
3.  Use your existing OCS business logic to calculate totals, taxes, and shipping.
4.  Translate the OCS `Cart` object back into the format of an ACS `CheckoutSession` response.
5.  When checkout is complete, convert the OCS `Cart` into a final OCS `Order`.

The mapping is surprisingly clean: **An Agentic `CheckoutSession` is backed 1-to-1 by an OCS `Cart`.**

## 4. Mapping Agentic Checkout Endpoints to OCS Resources

### `POST /checkout_sessions` (Create)
**ACS Direction:** OpenAI -> Merchant

This call initiates a new checkout.

**Adapter Logic:**
1.  Receive the ACS request containing `items`.
2.  Internally, call your own `POST /carts` endpoint to create a new OCS `Cart`.
3.  Iterate through the `items` in the ACS request and call your own `POST /carts/{cart_id}/items` endpoint for each one.
4.  If `fulfillment_address` is present, call your `PATCH /carts/{cart_id}` to update the cart with the address and trigger shipping calculation.
5.  Fetch the final state of the OCS `Cart`.
6.  Translate this `Cart` object into the ACS `CheckoutSession` response format (see Section 5).
7.  Store a mapping between the ACS `checkout_session_id` and the OCS `cart_id`. A simple key-value store (like Redis) or a database table is perfect for this.
8.  Return `201 Created` with the translated response.

### `POST /checkout_sessions/{id}` (Update)
**ACS Direction:** OpenAI -> Merchant

This call updates an existing session (e.g., adds an address, changes shipping).

**Adapter Logic:**
1.  Look up the OCS `cart_id` associated with the ACS `checkout_session_id`.
2.  Inspect the ACS request body to see what changed:
    *   If `fulfillment_address` changed, call `PATCH /carts/{cart_id}` with the new `deliveryAddress`.
    *   If `items` changed, perform the necessary `POST`/`PATCH`/`DELETE` operations on `/carts/{cart_id}/items`.
    *   If `fulfillment_option_id` changed, call `PATCH /carts/{cart_id}` to update the selected shipping method.
3.  After performing the OCS operations, fetch the final state of the OCS `Cart`.
4.  Translate and return the `Cart` as an ACS `CheckoutSession` response.

### `POST /checkout_sessions/{id}/complete`
**ACS Direction:** OpenAI -> Merchant

This finalizes the checkout and creates the order.

**Adapter Logic:**
1.  Look up the OCS `cart_id`.
2.  Extract the `payment_data` token from the ACS request.
3.  Initiate the OCS order creation by calling your own `POST /orders` endpoint.
4.  Pass the ACS `payment_data` into your OCS payment flow:
    *   **If using the x402 pattern:** The token would be included in the `X-PAYMENT` header of the retry request.
    *   **If using the stateful hypermedia pattern:** The token would be sent to your `/orders/{id}/confirm-payment` endpoint.
5.  Once the OCS `Order` is successfully created, translate it into the `order` object required by the ACS response.
6.  Translate the final OCS `Cart` state into the ACS `CheckoutSession` format.
7.  Combine them and return the final ACS response.

## 5. Data Model Translation Layer

This is the core of the adapter. You need functions to convert between the two models.

**OCS `Cart` -> ACS `CheckoutSession`**

| OCS `Cart` Field | ACS `CheckoutSession` Field | Transformation Logic |
| :--- | :--- | :--- |
| `id` | Backing `cart_id` (not in response) | Used for internal mapping. The `id` in the response is the ACS session ID. |
| `items` | `line_items` | Iterate and convert each item. Convert OCS string price (`"10.50"`) to ACS integer (`1050`). |
| `deliveryAddress` | `fulfillment_address` | Map fields (e.g., `streetAddress` -> `line_one`). |
| `total` | `totals` array | Deconstruct the OCS `total` object into the ACS `totals` array with different types (`subtotal`, `tax`, `total`). |
| Shipping options from logic | `fulfillment_options` | Your OCS server's shipping logic (e.g., from `dev.ocs.store.shipping@1.0`) must generate this list. |

## 6. Handling Payments

The Agentic Checkout Spec's "Delegated Payment" model fits perfectly with OCS.

When OpenAI calls `POST .../complete`, it provides a `payment_data.token`. This token is an abstraction over the user's actual payment method.

Your adapter's job is to pass this token to your payment processing logic.

*   When you call `POST /orders`, you can include this token in a custom metadata field.
*   Your order creation logic then takes this token and passes it to your PSP (e.g., Stripe) to charge the payment, as specified in the ACS documentation.
*   This completely bypasses the need for the client-side part of OCS payment flows, as the "client" in this case (OpenAI) has already handled tokenization.

## 7. Implementing Webhooks

The Agentic Checkout Spec requires you to send webhooks for `order_created` and `order_updated`.

This is straightforward to add to an OCS server.
*   After your `POST /orders` logic successfully creates an order, trigger a function that sends the `order_created` webhook to the URL provided by OpenAI.
*   Whenever an order is updated (e.g., status changes to `shipped`), trigger a function to send the `order_updated` webhook.

The data payload for these webhooks can be generated by translating your OCS `Order` object into the required ACS `EventData` format.

## 8. Proposed OCS Capability for Discovery

To make this integration discoverable and standardized, you can define a new OCS capability. This allows an agent to discover if your OCS-compliant store also supports Agentic Checkout.

**Capability ID:** `dev.ocs.integration.agentic_checkout@1.0`

**Schema:**
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.ocs.dev/integration/agentic_checkout/v1.json",
  "title": "Agentic Checkout Spec Integration",
  "description": "Indicates that the server supports OpenAI's Agentic Checkout Spec.",
  "type": "object",
  "properties": {
    "baseUrl": {
      "type": "string",
      "format": "uri",
      "description": "The base URL for the /checkout_sessions endpoints."
    },
    "supportedApiVersion": {
      "type": "string",
      "description": "The version of the Agentic Checkout Spec supported (e.g., '2025-09-12')."
    }
  },
  "required": ["baseUrl", "supportedApiVersion"]
}
```

When an agent calls your OCS `GET /capabilities` endpoint, it can look for this ID to know how to initiate an agentic checkout.

## 9. Example End-to-End Flow

1.  **Agent (ChatGPT):** Discovers your store and wants to start a checkout for `item_123`.
2.  **Agent -> Adapter:** `POST /checkout_sessions` with `{"items": [{"id": "item_123", "quantity": 1}]}`.
3.  **Adapter -> OCS:**
    *   `POST /carts` -> gets back `{ "id": "cart_abc" }`.
    *   `POST /carts/cart_abc/items` with `{"catalogItemId": "item_123", "quantity": 1}`.
    *   `GET /carts/cart_abc` to get the final cart state.
4.  **Adapter -> Agent:** Translates the OCS `Cart` object into the ACS `CheckoutSession` format and returns it.
5.  **Agent:** User adds a shipping address.
6.  **Agent -> Adapter:** `POST /checkout_sessions/{id}` with the new address.
7.  **Adapter -> OCS:** `PATCH /carts/cart_abc` with the new address. Shipping is re-calculated.
8.  **Adapter -> Agent:** Returns the updated, translated `CheckoutSession` with shipping options.
9.  **Agent:** User clicks "Buy".
10. **Agent -> Adapter:** `POST /checkout_sessions/{id}/complete` with a payment token.
11. **Adapter -> OCS:** `POST /orders` with `{"cartId": "cart_abc"}` and the payment token in metadata.
12. **OCS Backend:** Processes the payment, creates the final OCS `Order`.
13. **Adapter:** Receives the successful OCS `Order`, translates everything into the final ACS response format.
14. **Adapter -> Agent:** Returns the final `completed` checkout session and `order` object.
15. **OCS Backend:** Aynchronously sends an `order_created` webhook to OpenAI.