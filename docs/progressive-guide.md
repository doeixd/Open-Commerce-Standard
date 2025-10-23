# Progressive Guide to OCS Features

This guide walks you through building an OCS API from simple to advanced, adding one feature at a time. Each level builds on the previous one.

**Prerequisites:** Complete the [Getting Started Lite](./getting-started-lite.md) guide first.

---

## Level 0: Minimal Product Catalog (Start Here)

**Goal:** Sell a single product type with fixed prices.

**What you need:**
- `/capabilities` - Empty list is fine
- `/catalogs/{id}` - List of products
- `POST /orders` - Accept orders directly

**Skip:** Carts, variants, metadata, everything else

**Example:** A bakery selling standard items at fixed prices.

```json
GET /catalogs/bakery
{
  "id": "bakery",
  "name": "Daily Bread Bakery",
  "items": [
    {
      "id": "sourdough",
      "name": "Sourdough Loaf",
      "price": { "amount": "6.00", "currency": "USD" },
      "fulfillmentType": "pickup",
      "available": true
    }
  ]
}
```

**When to move on:** Your products all have the same structure (no options, variants, or customization).

---

## Level 1: Add Shopping Carts

**Goal:** Let customers add multiple items before checkout.

**Why:** Better UX for multi-item orders; calculate totals server-side; apply business logic.

**What to add:**
1. Advertise cart support in capabilities
2. Implement cart endpoints

### 1. Update Capabilities

```json
GET /capabilities
{
  "capabilities": [
    {
      "id": "dev.ocs.cart@1.0",
      "metadata": {
        "lifetimeSeconds": 3600,
        "maxItems": 50
      }
    }
  ]
}
```

### 2. Implement Cart Endpoints

```javascript
// Create cart
POST /carts
{
  "storeId": "bakery"
}
→ Returns: { "id": "cart_123", "items": [], "total": { "amount": "0.00", "currency": "USD" } }

// Add items
POST /carts/cart_123/items
{
  "catalogItemId": "sourdough",
  "quantity": 2
}

// Get cart state
GET /carts/cart_123
→ Returns full cart with items and calculated total

// Place order from cart
POST /orders
{
  "cartId": "cart_123",
  "pickupLocation": { "storeId": "bakery" }
}
```

### 3. Client Flow

```javascript
// Old way (Level 0): Direct order
POST /orders { items: [...] }

// New way (Level 1): Cart-based
const cart = await createCart({ storeId: 'bakery' });
await addToCart(cart.id, { catalogItemId: 'sourdough', quantity: 2 });
await addToCart(cart.id, { catalogItemId: 'croissant', quantity: 1 });
const order = await createOrder({ cartId: cart.id });
```

**When to move on:** You need products with options (sizes, colors, toppings).

---

## Level 2: Add Product Variants

**Goal:** Support products with options like size, color, or style.

**Why:** T-shirts need sizes, coffee needs milk options, shoes need sizes.

**What to add:**
1. Advertise variants capability
2. Add structured metadata to products

### 1. Update Capabilities

```json
{
  "id": "dev.ocs.product.variants@1.0",
  "schemaUrl": "https://schemas.ocs.dev/product/variants/v1.json"
}
```

### 2. Add Variant Metadata

```json
{
  "id": "tshirt",
  "name": "OCS Logo T-Shirt",
  "price": { "amount": "20.00", "currency": "USD" },
  "fulfillmentType": "physical",
  "available": true,
  "metadata": {
    "dev.ocs.product.variants@1.0": {
      "_version": "1.0",
      "options": ["Size", "Color"],
      "variants": [
        {
          "id": "tshirt_large_black",
          "values": ["Large", "Black"],
          "price": { "amount": "20.00", "currency": "USD" },
          "stock": 15
        },
        {
          "id": "tshirt_medium_white",
          "values": ["Medium", "White"],
          "price": { "amount": "20.00", "currency": "USD" },
          "stock": 8
        }
      ]
    }
  }
}
```

### 3. Client Changes

```javascript
// Check if server supports variants
const hasVariants = capabilities.capabilities
  .some(c => c.id === 'dev.ocs.product.variants@1.0');

if (hasVariants && product.metadata['dev.ocs.product.variants@1.0']) {
  // Show size/color picker UI
  const variants = product.metadata['dev.ocs.product.variants@1.0'];
  renderVariantPicker(variants.options, variants.variants);
}

// Add specific variant to cart
await addToCart(cart.id, {
  catalogItemId: 'tshirt',
  variantId: 'tshirt_large_black', // ← Note the variant ID
  quantity: 1
});
```

**When to move on:** You need to show order progress in real-time.

---

## Level 3: Add Real-Time Updates

**Goal:** Stream order status changes to clients (preparing → ready → delivered).

**Why:** Keep customers informed without polling; show live delivery tracking.

**What to add:**
1. Server-Sent Events endpoint
2. JSON Patch updates

### 1. Implement SSE Endpoint

```javascript
GET /orders/order_123/updates
Accept: text/event-stream

Response stream:
event: order.patch
data: [{"op": "replace", "path": "/status", "value": "preparing"}]

event: order.patch
data: [{"op": "replace", "path": "/status", "value": "ready"}]

event: order.patch
data: [{"op": "replace", "path": "/status", "value": "completed"}]
```

### 2. Client Implementation

```javascript
const eventSource = new EventSource('/orders/order_123/updates', {
  headers: { 'Authorization': 'Bearer TOKEN' }
});

let orderState = { /* initial order */ };

eventSource.addEventListener('order.patch', (event) => {
  const patches = JSON.parse(event.data);

  // Apply patches to local state (use a JSON Patch library)
  orderState = applyPatches(orderState, patches);

  // Update UI
  updateOrderUI(orderState);
});

// Status changed: pending → preparing → ready → completed
```

### 3. Advanced: Rich Status Updates

Add human-readable status via metadata:

```json
event: order.patch
data: [
  {"op": "replace", "path": "/status", "value": "in_transit"},
  {"op": "add", "path": "/metadata/dev.ocs.order.detailed_status", "value": {
    "_version": "1.0",
    "title": "Out for Delivery",
    "description": "Your order is on its way!",
    "progress": 75
  }}
]
```

**When to move on:** You need customers to find your API automatically.

---

## Level 4: Add API Discovery

**Goal:** Let clients find your API without hardcoded URLs.

**Why:** Enables browser extensions, federated commerce, SEO, AI agents.

**What to add:**
1. `/.well-known/ocs` endpoint
2. Optional: HTML meta tags, JSON-LD, HTTP headers

### 1. Implement Well-Known Endpoint

```json
GET /.well-known/ocs
Cache-Control: max-age=86400
Access-Control-Allow-Origin: *

{
  "ocs": {
    "capabilities": "https://shop.example.com/api/v1/capabilities",
    "version": "1.0",
    "context": "https://schemas.ocs.dev/context.jsonld"
  }
}
```

### 2. Client Discovery Flow

```javascript
// Old way: Hardcoded
const caps = await fetch('https://shop.example.com/api/v1/capabilities');

// New way: Discovered
async function discoverOCS(domain) {
  // Try well-known endpoint
  const discovery = await fetch(`https://${domain}/.well-known/ocs`)
    .then(r => r.json());

  // Use discovered endpoint
  const caps = await fetch(discovery.ocs.capabilities)
    .then(r => r.json());

  return caps;
}

const caps = await discoverOCS('shop.example.com');
```

### 3. Optional: Add HTML Discovery

If you serve HTML pages:

```html
<head>
  <meta name="ocs:capabilities" content="https://shop.example.com/api/v1/capabilities">

  <script type="application/ld+json">
  {
    "@context": "https://schemas.ocs.dev/context.jsonld",
    "@type": "ocs:EntryPoint",
    "ocs:capabilities": "https://shop.example.com/api/v1/capabilities"
  }
  </script>
</head>
```

**Full details:** See [OCS Discovery Specification](./ocs-discovery.md)

**When to move on:** You need dynamic, context-aware APIs.

---

## Level 5: Add Hypermedia (Actions)

**Goal:** Let the API tell clients what's possible based on current state.

**Why:** Dynamic UIs, server-controlled business logic, resilient to URL changes.

**What to add:**
1. `actions` array on resources
2. Context-aware action availability

### 1. Add Actions to Orders

```json
GET /orders/order_123

{
  "id": "order_123",
  "status": "confirmed",
  "actions": [
    {
      "id": "cancel",
      "href": "/orders/order_123/cancel",
      "method": "POST"
    },
    {
      "id": "track",
      "href": "/orders/order_123/tracking",
      "method": "GET"
    }
  ]
}
```

### 2. Client Uses Actions

```javascript
// Old way: Hardcoded logic
if (order.status === 'confirmed') {
  showCancelButton({
    onClick: () => fetch(`/orders/${order.id}/cancel`, { method: 'POST' })
  });
}

// New way: Hypermedia-driven
const cancelAction = order.actions?.find(a => a.id === 'cancel');
if (cancelAction) {
  showCancelButton({
    onClick: () => fetch(cancelAction.href, { method: cancelAction.method })
  });
}
```

### 3. Server Controls Business Logic

```javascript
function buildOrder(order, user) {
  const actions = [];

  // Only add cancel action if cancellable
  if (order.status === 'confirmed' && !order.shipped) {
    actions.push({
      id: 'cancel',
      href: `/orders/${order.id}/cancel`,
      method: 'POST'
    });
  }

  // Only add review action if customer purchased and delivered
  if (order.status === 'completed' && order.customerId === user.id) {
    actions.push({
      id: 'review',
      href: `/orders/${order.id}/review`,
      method: 'POST'
    });
  }

  return { ...order, actions };
}
```

**When to move on:** You need web3 payments or advanced semantic features.

---

## Level 6: Advanced Features

Once you've mastered Levels 0-5, explore these optional capabilities:

### Payments (x402 Protocol)
- **Use case:** Blockchain payments, micropayments, AI agent transactions
- **Capability:** Built into core spec (402 status code)
- **Doc:** See "A Unified, HTTP-Native Payment Protocol" in main README

### Promotions & Discounts
- **Use case:** Coupons, seasonal sales, bundle pricing
- **Capabilities:**
  - `dev.ocs.promotions.discoverable@1.0`
  - `dev.ocs.promotions.policies@1.0`
  - `dev.ocs.order.applied_promotions@1.0`

### Returns & Refunds
- **Use case:** E-commerce return workflows
- **Capabilities:**
  - `dev.ocs.order.returns@1.0`
  - `dev.ocs.order.refunds@1.0`

### Internationalization
- **Use case:** Multi-language, multi-currency stores
- **Capability:** `dev.ocs.i18n@1.0`
- **Features:** Locale negotiation, currency formatting, RTL support

### Subscriptions
- **Use case:** Recurring orders (meal kits, software licenses)
- **Capability:** `dev.ocs.order.subscription@1.0`

---

## Feature Comparison: What Level Do You Need?

| Your Business | Recommended Level | Key Features |
|---------------|-------------------|--------------|
| **Single-product digital goods** | Level 0 | Direct ordering, no carts |
| **Coffee shop / Quick service** | Level 1-2 | Carts + simple customization |
| **Apparel / Physical goods** | Level 2-3 | Variants + shipping tracking |
| **Enterprise marketplace** | Level 4-5 | Discovery + hypermedia |
| **Crypto commerce / AI agents** | Level 6 | x402 payments |

---

## Cheat Sheet: Capabilities by Level

| Level | Capabilities to Add |
|-------|---------------------|
| **0** | None (bare minimum) |
| **1** | `dev.ocs.cart@1.0` |
| **2** | `dev.ocs.product.variants@1.0` |
| **3** | No new capability (use SSE endpoint) |
| **4** | `dev.ocs.discovery@1.0` |
| **5** | No new capability (add `actions` to responses) |
| **6** | Custom based on needs |

---

## Common Upgrade Paths

### Path A: Simple Store → Full E-Commerce

```
Level 0 (basic products)
  ↓
Level 1 (add carts)
  ↓
Level 2 (add variants for sizes/colors)
  ↓
Level 3 (add shipment tracking)
  ↓
Level 4 (add discovery for SEO)
```

### Path B: Coffee Shop → Multi-Location Chain

```
Level 0 (basic menu)
  ↓
Level 1 (add carts for large orders)
  ↓
Level 2 (add customization: milk, size, etc.)
  ↓
Level 3 (add real-time order status)
  ↓
Level 4 (add discovery for mobile app)
```

### Path C: SaaS Product → API Marketplace

```
Level 0 (direct digital purchases)
  ↓
Level 4 (add discovery for ecosystem)
  ↓
Level 5 (add hypermedia for dynamic integrations)
  ↓
Level 6 (add subscriptions)
```

---

## Testing Your Implementation

After each level, verify your API works:

### Level 0 Checklist
- [ ] `/capabilities` returns valid JSON
- [ ] `/catalogs/{id}` shows products
- [ ] Products have required fields (id, name, price, fulfillmentType)
- [ ] `POST /orders` accepts direct orders

### Level 1 Checklist
- [ ] All Level 0 items pass
- [ ] Capabilities advertises `dev.ocs.cart@1.0`
- [ ] Can create cart with `POST /carts`
- [ ] Can add items with `POST /carts/{id}/items`
- [ ] Can create order from cart with `POST /orders { cartId }`

### Level 2 Checklist
- [ ] All Level 1 items pass
- [ ] Capabilities advertises `dev.ocs.product.variants@1.0`
- [ ] Products with variants include metadata
- [ ] Can add specific variant to cart using `variantId`

### Level 3 Checklist
- [ ] All Level 2 items pass
- [ ] `GET /orders/{id}/updates` returns `text/event-stream`
- [ ] Events use JSON Patch format
- [ ] Status changes emit patch events

### Level 4 Checklist
- [ ] All Level 3 items pass
- [ ] `GET /.well-known/ocs` returns discovery metadata
- [ ] Discovery response includes `capabilities` URL
- [ ] CORS headers present on `.well-known/ocs`

### Level 5 Checklist
- [ ] All Level 4 items pass
- [ ] Orders include `actions` array
- [ ] Actions reflect current order state
- [ ] Unavailable actions are omitted (not disabled)

---

## Getting Help

**Stuck?** Check these resources:

1. **[Getting Started Lite](./getting-started-lite.md)** - Review the basics
2. **[Full README](../README.md)** - Complete feature documentation
3. **[OpenAPI Spec](../src/spec.yaml)** - Detailed endpoint schemas
4. **[GitHub Issues](https://github.com/anthropics/open-commerce-standard/issues)** - Ask questions

**Next:** Ready for advanced topics? See:
- [OCS Discovery Specification](./ocs-discovery.md)
- [Capability Versioning Guide](./capability-versioning.md)
- Standards alignment documentation
