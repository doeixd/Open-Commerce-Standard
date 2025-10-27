# Getting Started with OCP: The Simple Guide

**If you're new to OCP, start here.** This guide strips away the advanced features and shows you the absolute essentials to build a working commerce API or client.

## What You Actually Need to Know (5-Minute Version)

OCP is just a REST API for e-commerce. At its core:

1. **Products** have a name, price, and type (physical/digital/pickup)
2. **Carts** hold items before checkout
3. **Orders** are placed from carts
4. **Capabilities** tell clients what features are available

That's it. Everything else (JSON-LD, hypermedia, x402, etc.) is **optional** and can be learned later.

---

## Your First OCP Server (Bare Minimum)

Here's the smallest possible OCP-compliant server. It has 3 endpoints:

### 1. List Your Capabilities (Required)

This tells clients what you support. Start simple:

```json
GET /capabilities

{
  "capabilities": [
    {
      "id": "dev.ocp.cart@1.0",
      "schemaUrl": "https://schemas.OCP.dev/cart/v1.json"
    }
  ]
}
```

**Translation:** "I support basic shopping carts. That's all."

### 2. Show Your Products (Required)

Return a list of things to buy:

```json
GET /catalogs/main

{
  "id": "main",
  "name": "My Store",
  "items": [
    {
      "id": "prod_1",
      "name": "Coffee Mug",
      "price": {
        "amount": "15.00",
        "currency": "USD"
      },
      "fulfillmentType": "physical",
      "available": true
    }
  ]
}
```

**Translation:** "I sell coffee mugs for $15. They're physical items, so you'll need a shipping address."

### 3. Accept Orders (Required)

Let people buy stuff:

```json
POST /orders
{
  "items": [
    {
      "catalogItemId": "prod_1",
      "quantity": 1
    }
  ],
  "deliveryAddress": {
    "address": "123 Main St, Anytown, USA"
  }
}

Response (201 Created):
{
  "id": "order_abc123",
  "status": "confirmed",
  "total": {
    "amount": "15.00",
    "currency": "USD"
  }
}
```

**Translation:** "Thanks for buying a mug. Here's your order ID."

---

## Your First OCP Client (Bare Minimum)

Here's how to shop using an OCP API:

```javascript
// Step 1: Check what the server supports (optional, but recommended)
const caps = await fetch('https://shop.example.com/capabilities')
  .then(r => r.json());

console.log('This server supports:', caps.capabilities.map(c => c.id));

// Step 2: Browse products
const catalog = await fetch('https://shop.example.com/catalogs/main')
  .then(r => r.json());

console.log('Available products:', catalog.items);

// Step 3: Buy something
const order = await fetch('https://shop.example.com/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/ocp+json; version=1.0',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify({
    items: [
      { catalogItemId: 'prod_1', quantity: 1 }
    ],
    deliveryAddress: {
      address: '123 Main St, Anytown, USA'
    }
  })
}).then(r => r.json());

console.log('Order placed!', order.id);
```

**That's it.** You just used OCP to buy a coffee mug.

---

## Common Questions from Beginners

### "Do I need to implement discovery (.well-known/ocp)?"

**No.** It's recommended for production, but you can skip it while learning. Just hardcode the `/capabilities` endpoint.

### "What about JSON-LD and semantic web stuff?"

**Ignore it for now.** JSON-LD is for advanced use cases like SEO and AI crawlers. Your API works fine without it.

### "Do I need to support x402 payments?"

**No.** You can use traditional payment processing (Stripe, PayPal) or even skip payments entirely in a prototype. OCP doesn't force any payment method.

### "What about hypermedia and actions?"

**Optional.** Start with fixed URLs like `/orders/{id}/cancel`. Add hypermedia later when you want dynamic APIs.

### "What's the difference between physical, digital, and pickup?"

- **`physical`**: Needs a shipping address (books, clothing, mugs)
- **`digital`**: No address needed (ebooks, music, software licenses)
- **`pickup`**: Customer picks up in-store (restaurant orders, click-and-collect)

Set `fulfillmentType` on each product and your client will know what to ask for.

### "Do I need to implement carts?"

**Not technically.** If you support the `dev.ocp.order.direct@1.0` capability, clients can place orders directly without a cart. But carts are recommended for multi-item purchases.

---

## What to Learn Next

Once you're comfortable with the basics, explore these features **in order**:

### Level 2: Product Variants
Learn how to handle sizes, colors, and other options:
- Capability: `dev.ocp.product.variants@1.0`
- Doc: `schemas/product/variants/v1.json`

### Level 3: Real-Time Updates
Stream order status changes to clients:
- Endpoint: `GET /orders/{id}/updates` (Server-Sent Events)
- Doc: See "Real-time Order Updates" in main README

### Level 4: Discovery
Make your API auto-discoverable:
- Doc: `docs/OCP-discovery.md`

### Level 5: Advanced Features
- Promotions and discounts
- Returns and refunds
- Subscriptions
- Custom metadata schemas

---

## Simple Mental Model

Think of OCP like this:

```
┌─────────────────────────────────────┐
│  Core (required)                    │
│  - Products with prices             │
│  - Basic ordering                   │
│  - Capability list                  │
└─────────────────────────────────────┘
         │
         │ Add when needed ↓
         │
┌─────────────────────────────────────┐
│  Common Features (recommended)      │
│  - Shopping carts                   │
│  - Product variants (size/color)    │
│  - Order status updates             │
└─────────────────────────────────────┘
         │
         │ Add for advanced cases ↓
         │
┌─────────────────────────────────────┐
│  Advanced (optional)                │
│  - Discovery (well-known, JSON-LD)  │
│  - Hypermedia (actions, links)      │
│  - Web3 payments (x402)             │
│  - Semantic metadata                │
└─────────────────────────────────────┘
```

**Start at the top. Move down as you grow.**

---

## Quick Reference: Minimum Viable OCP Server

Here are the absolute minimum endpoints to be OCP-compliant:

| Endpoint | What It Does | Example Response |
|----------|--------------|------------------|
| `GET /capabilities` | Lists features | `{"capabilities": [...]}` |
| `GET /catalogs/{id}` | Shows products | `{"items": [...]}` |
| `POST /orders` | Creates order | `{"id": "order_123", "status": "confirmed"}` |

Optional but recommended:
- `GET /.well-known/ocp` - Discovery
- `POST /carts` - Shopping cart
- `GET /orders/{id}` - Check order status

---

## Example: Building a Coffee Shop API

Let's build a minimal OCP API for a coffee shop:

### 1. Capabilities (what we support)

```json
GET /capabilities

{
  "capabilities": [
    {
      "id": "dev.ocp.cart@1.0"
    },
    {
      "id": "dev.ocp.product.customization@1.0",
      "metadata": {
        "note": "We support custom milk and size options"
      }
    }
  ]
}
```

### 2. Menu (our products)

```json
GET /catalogs/menu

{
  "id": "menu",
  "name": "Coffee Shop Menu",
  "items": [
    {
      "id": "latte",
      "name": "Latte",
      "price": { "amount": "4.50", "currency": "USD" },
      "fulfillmentType": "pickup",
      "available": true,
      "description": "Espresso with steamed milk"
    },
    {
      "id": "croissant",
      "name": "Butter Croissant",
      "price": { "amount": "3.00", "currency": "USD" },
      "fulfillmentType": "pickup",
      "available": true
    }
  ]
}
```

### 3. Place Order

```json
POST /orders

Request:
{
  "items": [
    {
      "catalogItemId": "latte",
      "quantity": 1
    },
    {
      "catalogItemId": "croissant",
      "quantity": 2
    }
  ],
  "pickupLocation": {
    "storeId": "downtown"
  },
  "customerName": "Alice"
}

Response (201):
{
  "id": "order_789",
  "status": "confirmed",
  "total": { "amount": "10.50", "currency": "USD" },
  "pickupTime": "2025-10-23T10:30:00Z"
}
```

**Done!** You have a working coffee shop API.

---

## Debugging Checklist

If your OCP implementation isn't working:

- [ ] Are you using `Content-Type: application/ocp+json; version=1.0`?
- [ ] Does `/capabilities` return valid JSON with a `capabilities` array?
- [ ] Do your products have `id`, `name`, `price`, and `fulfillmentType`?
- [ ] Are you handling the correct `fulfillmentType` for each product?
  - Physical → needs `deliveryAddress`
  - Pickup → needs `pickupLocation` or `storeId`
  - Digital → needs neither
- [ ] Are prices objects with `amount` and `currency`, not plain numbers?

---

## You're Ready!

Congratulations! You now understand:
- ✅ The core OCP data model (products, orders, capabilities)
- ✅ The minimum endpoints needed for compliance
- ✅ How to build a simple client or server
- ✅ What to ignore while learning (most of the advanced stuff)

When you're ready to level up, check out:
- **[Full README](../README.md)** - Complete feature overview
- **[OpenAPI Spec](../src/spec.yaml)** - All endpoints and schemas
- **[Progressive Guide](./progressive-guide.md)** - Step-by-step feature additions
- **[OCP Discovery](./OCP-discovery.md)** - Advanced discovery mechanisms

**Welcome to OCP!** 🎉
