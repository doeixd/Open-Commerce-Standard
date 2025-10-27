# Open Commerce Protocol — Standards Alignment Roadmap

**Version:** Draft 1.0
**Last Updated:** October 2025

This document outlines the roadmap and implementation guidelines for aligning the **Open Commerce Protocol (OCP)** with adjacent web standards — specifically **Hydra** (for hypermedia semantics) and **Interledger/Open Payments** (for payment interoperability).

The goal is to enhance interoperability while preserving OCP's core design principles: **HTTP-native**, **JSON-first**, and **developer-friendly**.

---

## 🎯 Goals

1. Improve interoperability with the broader web ecosystem.
2. Maintain OCP's minimalism and clarity.
3. Enable optional bridges to Semantic Web and multi-rail payment protocols.

---

## 🧩 1. Capability Metadata (`rel` and `href`)

### Purpose
Add lightweight link metadata that allows OCP resources to map cleanly to:
- Standard HTTP `Link` headers
- Hydra's `hydra:Link` and `hydra:Operation` semantics

### Implementation

#### a. Schema Update
Extend the **action** and **capability** schemas with two optional fields:

```json
"properties": {
  "rel": {
    "type": "string",
    "description": "Link relation type, mirrors HTTP Link rel and Hydra relation."
  },
  "href": {
    "type": "string",
    "format": "uri-reference",
    "description": "Target URI for this action or linked capability."
  }
}
```

#### b. Example

```json
{
  "id": "cancel",
  "title": "Cancel Order",
  "method": "POST",
  "href": "/orders/123/cancel",
  "rel": "cancel"
}
```

#### c. Behavior

* `rel` defines the **semantic role** of the link (e.g., `self`, `cancel`, `checkout`).
* `href` defines the **target** of the link.
* These fields are optional and purely descriptive — they do not alter OCP behavior.

#### d. Optional HTTP Link Headers

Servers **may** include equivalent link headers for standard clients:

```
Link: </orders/123/cancel>; rel="cancel"
```

This makes OCP resources semantically interoperable with Hydra clients and HTTP-aware tooling.

---

## 💸 2. Payments — Mapping `x402` to Interledger / Open Payments

### Purpose

Preserve the simple, elegant HTTP 402 flow while defining a clear mapping to **Interledger (ILP)** and **Open Payments** standards.

### Implementation

#### a. Continue Using `x402`

OCP's existing HTTP 402 flow remains canonical:

```http
POST /checkout
402 Payment Required
Content-Type: application/ocp+json
Link: <https://pay.example.com/intent/123>; rel="payment"
```

Response body:

```json
{
  "required_payment": {
    "amount": "25.00",
    "currency": "USD",
    "network": "stripe",
    "intent": "https://pay.example.com/intent/123"
  }
}
```

#### b. Mapping Table

| OCP Field  | Interledger / Open Payments Equivalent | Notes                                |
| ---------- | -------------------------------------- | ------------------------------------ |
| `intent`   | `incoming-payment` or `quote` URL      | Equivalent to Open Payments endpoint |
| `amount`   | `incoming-amount.value`                | Transfer amount                      |
| `currency` | `incoming-amount.assetCode`            | ISO 4217 or token symbol             |
| `network`  | Connector / ledger ID                  | e.g. `stripe`, `ilp`, `ethereum`     |

#### c. Schema Enhancement

In `schemas/payment/x402/v1.json`, add optional Interledger metadata:

```json
"interledger": {
  "type": "object",
  "properties": {
    "incoming_payment": { "type": "string", "format": "uri" },
    "asset_code": { "type": "string" },
    "asset_scale": { "type": "integer" }
  },
  "description": "Optional Interledger-compatible payment metadata."
}
```

#### d. Retry Flow

1. Client receives 402 with a payment link.
2. Optionally follows the `rel="payment"` link to an Open Payments endpoint.
3. Completes the payment using ILP or another rail.
4. Retries the original request with the `X-PAYMENT` header or token.

This preserves the same client behavior, but enables **multi-rail interoperability**.

---

## 🌐 3. Hypermedia Semantics — Optional JSON-LD `@context`

### Purpose

Enable Semantic Web and Hydra compatibility through an optional JSON-LD context, without adding complexity for ordinary JSON clients.

### Implementation

#### a. Context Definition

Host a context at:

```
https://schemas.OCP.dev/context.jsonld
```

Example contents:

```json
{
  "@context": {
    "OCP": "https://schemas.OCP.dev/vocab#",
    "hydra": "http://www.w3.org/ns/hydra/core#",
    "rel": "hydra:Link",
    "actions": "hydra:Operation",
    "capabilities": "OCP:Capability"
  }
}
```

#### b. Usage

Servers **may** include a top-level `@context` field in any response:

```json
{
  "@context": "https://schemas.OCP.dev/context.jsonld",
  "capabilities": [
    {
      "id": "dev.ocp.cart@1.0",
      "title": "Cart API",
      "rel": "self",
      "href": "/cart"
    }
  ]
}
```

* JSON-only clients can safely ignore `@context`.
* JSON-LD-aware clients can parse it semantically.

This allows OCP to integrate with **Hydra, RDF, and Linked Data** tools if needed.

---

## 🧠 4. Implementation Order (Recommended)

| Stage | Feature                           | Goal                                   | Difficulty |
| ----- | --------------------------------- | -------------------------------------- | ---------- |
| **1** | `rel` + `href` metadata           | Hydra & Link header alignment          | ★☆☆☆☆      |
| **2** | Optional JSON-LD `@context`       | Semantic web interoperability          | ★★☆☆☆      |
| **3** | Interledger/Open Payments mapping | Payment interop and multi-rail support | ★★★☆☆      |

---

## 🧩 5. Combined Example

```json
{
  "@context": "https://schemas.OCP.dev/context.jsonld",
  "capabilities": [
    {
      "id": "dev.ocp.cart@1.0",
      "title": "Cart",
      "rel": "self",
      "href": "/cart",
      "actions": [
        {
          "id": "add-item",
          "method": "POST",
          "href": "/cart/add",
          "rel": "create"
        }
      ]
    }
  ],
  "required_payment": {
    "amount": "25.00",
    "currency": "USD",
    "network": "stripe",
    "interledger": {
      "incoming_payment": "https://pay.example.com/incoming-payments/123",
      "asset_code": "USD",
      "asset_scale": 2
    }
  }
}
```

This JSON response:

* Is valid OCP.
* Is valid JSON-LD.
* Can settle via `x402` or Interledger/Open Payments.

---

## ✅ Summary of Benefits

| Enhancement                    | Impact                                                          |
| ------------------------------ | --------------------------------------------------------------- |
| **`rel` / `href` metadata**    | Improves semantic link clarity, supports Hydra and Link headers |
| **JSON-LD `@context`**         | Enables optional semantic web integration                       |
| **x402 → Interledger mapping** | Bridges fiat, crypto, and ILP payments seamlessly               |
| **Incremental rollout**        | No breaking changes; all features backward-compatible           |

---

**OCP remains simple and developer-first — but now sits within the broader family of web standards, ready for Semantic Web and open payment ecosystems.**
