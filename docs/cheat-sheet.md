# OCS Cheat Sheet

Quick reference for common OCS patterns and endpoints.

## Core Endpoints (Minimum Viable)

```javascript
GET  /.well-known/ocs       // Discovery (optional but recommended)
GET  /capabilities          // List supported features (required)
GET  /catalogs/{id}         // Get products (required)
POST /orders                // Place order (required)
```

## Common Headers

```http
Content-Type: application/ocs+json; version=1.0
Accept: application/ocs+json; version=1.0
Authorization: Bearer {token}
Idempotency-Key: {unique-key}  // For POST/PATCH/DELETE
```

## Product Structure (Minimal)

```json
{
  "id": "prod_123",
  "name": "Product Name",
  "price": {
    "amount": "19.99",
    "currency": "USD"
  },
  "fulfillmentType": "physical",  // or "digital" or "pickup"
  "available": true
}
```

## Fulfillment Types

| Type | Requires | Example |
|------|----------|---------|
| `physical` | `deliveryAddress` | Books, clothing, electronics |
| `digital` | Nothing | eBooks, software licenses, music |
| `pickup` | `pickupLocation` | Restaurant orders, click-and-collect |

## Order Request (Direct)

```json
POST /orders

{
  "items": [
    {
      "catalogItemId": "prod_123",
      "quantity": 2
    }
  ],
  "deliveryAddress": {
    "address": "123 Main St, City, State 12345"
  }
}
```

## Order Request (From Cart)

```json
POST /orders

{
  "cartId": "cart_abc",
  "deliveryAddress": {
    "address": "123 Main St"
  }
}
```

## Cart Flow

```javascript
// 1. Create cart
POST /carts
{ "storeId": "store_1" }
→ { "id": "cart_abc", "items": [], "total": {...} }

// 2. Add items
POST /carts/cart_abc/items
{ "catalogItemId": "prod_123", "quantity": 1 }

// 3. Get cart state
GET /carts/cart_abc
→ { "id": "cart_abc", "items": [...], "total": {...} }

// 4. Checkout
POST /orders
{ "cartId": "cart_abc", "deliveryAddress": {...} }
```

## Discovery Response

```json
GET /.well-known/ocs

{
  "ocs": {
    "capabilities": "https://api.example.com/capabilities",
    "version": "1.0",
    "context": "https://schemas.ocs.dev/context.jsonld"
  }
}
```

## Capabilities Response

```json
GET /capabilities

{
  "capabilities": [
    {
      "id": "dev.ocs.cart@1.0",
      "schemaUrl": "https://schemas.ocs.dev/cart/v1.json",
      "metadata": {
        "lifetimeSeconds": 3600,
        "maxItems": 50
      }
    }
  ]
}
```

## Common Capabilities

| Capability ID | Purpose |
|---------------|---------|
| `dev.ocs.cart@1.0` | Shopping cart support |
| `dev.ocs.order.direct@1.0` | Direct orders (no cart) |
| `dev.ocs.product.variants@1.0` | Size/color options |
| `dev.ocs.order.shipment_tracking@1.0` | Track deliveries |
| `dev.ocs.discovery@1.0` | Discovery mechanisms |
| `dev.ocs.i18n@1.0` | Internationalization |

## Product with Variants

```json
{
  "id": "tshirt",
  "name": "T-Shirt",
  "price": { "amount": "20.00", "currency": "USD" },
  "fulfillmentType": "physical",
  "available": true,
  "metadata": {
    "dev.ocs.product.variants@1.0": {
      "_version": "1.0",
      "options": ["Size", "Color"],
      "variants": [
        {
          "id": "tshirt_L_black",
          "values": ["Large", "Black"],
          "price": { "amount": "20.00", "currency": "USD" },
          "stock": 15
        }
      ]
    }
  }
}
```

## Order with Variant

```json
POST /orders

{
  "items": [
    {
      "catalogItemId": "tshirt",
      "variantId": "tshirt_L_black",  // ← Specify variant
      "quantity": 1
    }
  ],
  "deliveryAddress": { "address": "..." }
}
```

## Hypermedia Actions

### Basic Actions

```json
// Server response includes available actions
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

// Client follows actions (don't hardcode URLs)
const cancelAction = order.actions.find(a => a.id === 'cancel');
if (cancelAction) {
  await fetch(cancelAction.href, { method: cancelAction.method });
}
```

### Schema-Aware Actions

When `dev.ocs.hypermedia.schema_aware_actions@1.0` is enabled:

```json
// Server includes schemas and metadata
{
  "id": "order_123",
  "status": "confirmed",
  "actions": [
    {
      "id": "cancel",
      "href": "/orders/order_123/cancel",
      "method": "POST",
      "title": "Cancel Order",
      "description": "Cancel this order. Refunds processed in 5-7 days.",
      "requestSchema": {
        "$ref": "https://schemas.ocs.dev/order/actions/cancel_request/v1.json"
      },
      "responseSchema": {
        "$ref": "https://schemas.ocs.dev/order/v1.json"
      },
      "errorSchemas": [
        {
          "statusCode": 400,
          "errorCodes": ["cancellation_window_expired", "order_already_cancelled"],
          "description": "Order cannot be cancelled"
        }
      ],
      "examples": {
        "request": { "reason": "Changed my mind" },
        "response": { "id": "order_123", "status": "cancelled" }
      }
    },
    {
      "id": "add_rating",
      "href": "/orders/order_123/ratings",
      "method": "POST",
      "title": "Rate Your Order",
      "description": "Share your feedback",
      "requestSchema": {
        "inline": {
          "type": "object",
          "properties": {
            "overall": {
              "type": "integer",
              "minimum": 1,
              "maximum": 5
            },
            "comment": {
              "type": "string",
              "maxLength": 1000
            }
          },
          "required": ["overall"]
        }
      }
    }
  ]
}
```

### Dynamic Form Generation

```javascript
// Client dynamically generates form from schema
async function renderActionForm(action) {
  const schema = action.requestSchema.inline ||
                 await fetch(action.requestSchema.$ref).then(r => r.json());

  const form = document.createElement('form');

  // Generate fields from schema
  for (const [field, config] of Object.entries(schema.properties)) {
    const input = createInputFromSchema(field, config);
    input.name = field;

    // Add validation from schema
    if (config.minimum) input.min = config.minimum;
    if (config.maximum) input.max = config.maximum;
    if (config.maxLength) input.maxLength = config.maxLength;
    if (schema.required?.includes(field)) input.required = true;

    form.appendChild(input);
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));

    // Client-side validation
    if (!validateAgainstSchema(data, schema)) {
      alert('Validation failed');
      return;
    }

    // Execute action
    await fetch(action.href, {
      method: action.method,
      body: JSON.stringify(data)
    });
  };

  return form;
}
```

### Client-Side Validation

```javascript
function validateAgainstSchema(data, schema) {
  const errors = [];

  // Check required fields
  schema.required?.forEach(field => {
    if (!data[field]) {
      errors.push(`${field} is required`);
    }
  });

  // Check constraints
  for (const [field, value] of Object.entries(data)) {
    const config = schema.properties[field];

    if (config.type === 'integer') {
      const num = parseInt(value);
      if (config.minimum && num < config.minimum) {
        errors.push(`${field} must be at least ${config.minimum}`);
      }
      if (config.maximum && num > config.maximum) {
        errors.push(`${field} must be at most ${config.maximum}`);
      }
    }
  }

  return errors.length === 0;
}
```

### Error Handling with Schema Info

```javascript
try {
  await executeAction(action, data);
} catch (error) {
  // Check if error matches expected error schemas
  const errorSchema = action.errorSchemas.find(
    e => e.statusCode === error.response.status
  );

  if (errorSchema) {
    console.log('Expected error codes:', errorSchema.errorCodes);
    console.log('Description:', errorSchema.description);

    // Handle known error
    if (errorSchema.errorCodes.includes(error.body.code)) {
      showUserFriendlyError(error.body.userMessage);
    }
  }
}
```

## Real-Time Updates (SSE)

```javascript
// Client subscribes to order updates
const eventSource = new EventSource('/orders/order_123/updates', {
  headers: { 'Authorization': 'Bearer TOKEN' }
});

eventSource.addEventListener('order.patch', (event) => {
  const patches = JSON.parse(event.data);
  // patches = [{"op": "replace", "path": "/status", "value": "shipped"}]

  // Apply patches to local state
  orderState = applyPatches(orderState, patches);
  updateUI(orderState);
});
```

## Error Response Format

```json
{
  "code": "cart_expired",
  "message": "Cart expired after 3600 seconds",
  "userMessage": {
    "localizationKey": "error.cart.expired",
    "params": { "lifetimeSeconds": 3600 }
  },
  "nextActions": [
    {
      "id": "create_new_cart",
      "href": "/carts",
      "method": "POST"
    }
  ]
}
```

## Common HTTP Status Codes

| Code | Meaning | When to Use |
|------|---------|-------------|
| `200` | OK | Successful GET/PATCH |
| `201` | Created | Successful POST (new resource) |
| `400` | Bad Request | Invalid input |
| `401` | Unauthorized | Missing/invalid auth token |
| `402` | Payment Required | x402 payment needed |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Resource state conflict |
| `410` | Gone | Resource expired (e.g., cart) |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Server Error | Unexpected server error |

## Idempotency

```javascript
// Always include for state-changing operations
const idempotencyKey = `${userId}-${timestamp}-${randomString}`;

fetch('/orders', {
  method: 'POST',
  headers: {
    'Idempotency-Key': idempotencyKey,
    // ... other headers
  },
  body: JSON.stringify({...})
});

// Retry with SAME key on network error
// Server will return same result if already processed
```

## Pagination

```javascript
// Request
GET /catalogs?limit=20&cursor=eyJpZCI6InByb2RfMjAifQ

// Response
{
  "items": [...],
  "pagination": {
    "limit": 20,
    "nextCursor": "eyJpZCI6InByb2RfNDAifQ",
    "previousCursor": null,
    "totalCount": 157
  }
}

// Get next page
const nextUrl = `/catalogs?limit=20&cursor=${data.pagination.nextCursor}`;
```

## Discovery Precedence

When multiple discovery sources exist, use this order:

1. **`.well-known/ocs`** (highest authority)
2. **`OCS-Discovery` HTTP header**
3. **JSON-LD block** in HTML
4. **HTML `<meta>` tags** (lowest authority)

## Client Capability Negotiation

```javascript
// 1. Get capabilities
const caps = await fetch('/capabilities').then(r => r.json());

// 2. Check for specific feature
const hasVariants = caps.capabilities
  .some(c => c.id === 'dev.ocs.product.variants@1.0');

// 3. Adapt UI
if (hasVariants) {
  showVariantPicker();
} else {
  showQuantityOnly();
}
```

## Metadata Key Format

Always use full capability ID as metadata key:

```json
{
  "metadata": {
    "dev.ocs.product.variants@1.0": { ... },
    // NOT "variants": { ... }  ← Wrong!
  }
}
```

## Cart Expiration Handling

```javascript
try {
  const order = await createOrder({ cartId });
} catch (error) {
  if (error.code === 'cart_expired') {
    // Get items from local storage
    const items = localStorage.getItem('cartItems');

    // Recreate cart
    const newCart = await createCart();
    await addItemsToCart(newCart.id, items);

    // Retry
    return createOrder({ cartId: newCart.id });
  }
}
```

## Mixed Fulfillment Orders

```json
// Order with both physical and digital items
{
  "items": [
    { "catalogItemId": "book_physical", "quantity": 1 },
    { "catalogItemId": "ebook_digital", "quantity": 1 }
  ],
  "deliveryAddress": {
    "address": "123 Main St"  // Only for physical items
  }
  // Digital items delivered via metadata after payment
}
```

## Web Payments & Secure Payment Confirmation

### Check Browser Support

```javascript
const hasPaymentRequest = 'PaymentRequest' in window;
const hasSPC = 'PaymentRequest' in window &&
  'SecurePaymentConfirmationRequest' in window;
const hasWebAuthn = 'credentials' in navigator;
```

### Web Payments Flow (Client)

```javascript
// 1. Get 402 response with webPayments extras
const x402 = await response.json();
const webPaymentsData = x402.accepts[0].extra.webPayments;

// 2. Create PaymentRequest
const request = new PaymentRequest(
  webPaymentsData.supportedMethods.map(m => ({ supportedMethods: m })),
  {
    total: {
      label: 'Total',
      amount: { currency: 'USD', value: '25.00' }
    }
  }
);

// 3. Show payment UI
const response = await request.show();

// 4. Retry with X-PAYMENT
const paymentPayload = btoa(JSON.stringify({
  x402Version: 1,
  scheme: 'fiat_intent',
  network: 'stripe',
  payload: { methodName: response.methodName, details: response.details }
}));

await fetch('/orders', {
  headers: { 'X-PAYMENT': paymentPayload },
  // ... rest of order request
});
```

### SPC Flow (Client)

```javascript
// 1. Get 402 response with spc extras
const spcData = x402.accepts[0].extra.spc;

// 2. Create SPC request
const request = new PaymentRequest(
  [{
    supportedMethods: 'secure-payment-confirmation',
    data: {
      action: 'payment',
      credentialIds: [base64ToArrayBuffer(credentialId)],
      challenge: base64ToArrayBuffer(spcData.challenge),
      instrument: spcData.instrument,
      rpId: spcData.rpId,
      timeout: 300000
    }
  }],
  { total: { label: 'Total', amount: { currency: 'USD', value: '25.00' } } }
);

// 3. Show biometric prompt
const response = await request.show();

// 4. Retry with assertion
const paymentPayload = btoa(JSON.stringify({
  x402Version: 1,
  scheme: 'fiat_intent',
  network: 'stripe',
  payload: {
    assertion: {
      id: response.details.id,
      rawId: arrayBufferToBase64(response.details.rawId),
      response: { /* authenticatorData, clientDataJSON, signature */ }
    }
  }
}));
```

### Server 402 Response with Web Payments/SPC

```json
{
  "x402Version": 1,
  "error": "Payment required",
  "accepts": [{
    "scheme": "fiat_intent",
    "network": "stripe",
    "asset": "USD",
    "maxAmountRequired": "2500",
    "extra": {
      "clientSecret": "pi_...",
      "webPayments": {
        "supportedMethods": ["basic-card", "https://google.com/pay"],
        "displayItems": [
          { "label": "Subtotal", "amount": { "currency": "USD", "value": "20.00" } },
          { "label": "Tax", "amount": { "currency": "USD", "value": "5.00" } }
        ]
      },
      "spc": {
        "challenge": "base64EncodedChallenge",
        "credentialIds": ["base64CredentialId"],
        "rpId": "bank.example.com",
        "instrument": {
          "displayName": "Visa ****1234",
          "icon": "https://bank.example.com/icon.png"
        }
      }
    }
  }]
}
```

### Capabilities Advertisement

```json
{
  "capabilities": [
    {
      "id": "dev.ocs.payment.web_payments@1.0",
      "schemaUrl": "https://schemas.ocs.dev/payment/web_payments/v1.json",
      "metadata": {
        "_version": "1.0",
        "supportedMethods": ["basic-card", "https://google.com/pay"],
        "merchantName": "My Store",
        "supportedNetworks": ["visa", "mastercard", "amex"]
      }
    },
    {
      "id": "dev.ocs.payment.spc@1.0",
      "schemaUrl": "https://schemas.ocs.dev/payment/spc/v1.json",
      "metadata": {
        "_version": "1.0",
        "supportedRps": ["bank.example.com"],
        "registrationUrl": "https://bank.example.com/register-spc",
        "fallbackMethods": ["otp", "web_payments"]
      }
    },
    {
      "id": "dev.ocs.auth.webauthn@1.0",
      "schemaUrl": "https://schemas.ocs.dev/auth/webauthn/v1.json",
      "metadata": {
        "_version": "1.0",
        "rpId": "shop.example.com",
        "rpName": "My Shop",
        "registrationUrl": "https://api.shop.com/auth/webauthn/register",
        "authenticationUrl": "https://api.shop.com/auth/webauthn/authenticate"
      }
    }
  ]
}
```

### Utility Functions

```javascript
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
```

### Browser Support Matrix (Oct 2025)

| Feature | Chrome | Edge | Safari | Firefox |
|---------|--------|------|--------|---------|
| Payment Request API | ✅ | ✅ | ⚠️ | ❌ |
| SPC | ✅* | ✅ | ❌ | ❌ |
| WebAuthn | ✅ | ✅ | ✅ | ✅ |

*SPC on Chrome: macOS, Windows, Android (not iOS/ChromeOS)

### Fallback Strategy

```javascript
async function placeOrderWithPayment(orderData) {
  // Try SPC first (best security)
  if (hasSPC && spcCredentialExists) {
    try {
      return await placeOrderWithSPC(orderData);
    } catch (error) {
      console.warn('SPC failed, trying Web Payments', error);
    }
  }

  // Try Web Payments
  if (hasPaymentRequest) {
    try {
      return await placeOrderWithWebPayments(orderData);
    } catch (error) {
      console.warn('Web Payments failed, using manual entry', error);
    }
  }

  // Fallback to manual entry
  return await placeOrderWithManualEntry(orderData);
}
```

## Server Implementation Checklist

Minimum viable server:

- [ ] `GET /capabilities` returns valid JSON
- [ ] `GET /catalogs/{id}` returns products
- [ ] Products have required fields (id, name, price, fulfillmentType)
- [ ] `POST /orders` accepts orders
- [ ] Orders validate fulfillment requirements
- [ ] Content-Type headers are correct
- [ ] CORS headers included (if needed)

Recommended additions:

- [ ] `GET /.well-known/ocs` for discovery
- [ ] `POST /carts` for cart support
- [ ] Bearer token authentication
- [ ] Idempotency key handling
- [ ] Error responses with `code` field

## Client Implementation Checklist

- [ ] Discovers capabilities first
- [ ] Adapts to server features
- [ ] Handles all fulfillment types
- [ ] Includes proper headers
- [ ] Implements idempotency
- [ ] Graceful error handling
- [ ] Retries on network errors

## Testing Your API

```bash
# 1. Test discovery
curl http://localhost:3000/.well-known/ocs

# 2. Test capabilities
curl http://localhost:3000/capabilities

# 3. Test catalog
curl http://localhost:3000/catalogs/main

# 4. Test order (with auth)
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/ocs+json; version=1.0" \
  -H "Authorization: Bearer test_token" \
  -d '{
    "items": [{"catalogItemId": "prod_1", "quantity": 1}],
    "deliveryAddress": {"address": "123 Main St"}
  }'
```

## Quick Debugging

| Problem | Check |
|---------|-------|
| 401 Unauthorized | Is `Authorization: Bearer` header present? |
| 400 Bad Request | Does fulfillmentType match address type? |
| 404 Not Found | Is the resource ID correct? |
| 410 Gone | Has the cart expired? |
| CORS error | Are CORS headers on server responses? |
| No products | Is catalog ID correct (try "main")? |

## Performance Tips

- Cache `/capabilities` response (changes rarely)
- Cache `.well-known/ocs` (24 hours recommended)
- Use cursor pagination for large catalogs
- Implement SSE for real-time updates (not polling)
- Include `ETag` headers for conditional requests

## Security Checklist

- [ ] HTTPS only (no plain HTTP in production)
- [ ] Bearer token authentication
- [ ] Rate limiting implemented
- [ ] Idempotency keys prevent duplicates
- [ ] Input validation on all endpoints
- [ ] CORS configured correctly
- [ ] No sensitive data in error messages

---

## Quick Links

- [Getting Started Lite](./getting-started-lite.md) - Beginner guide
- [Progressive Guide](./progressive-guide.md) - Step-by-step features
- [Full Spec](../src/spec.yaml) - OpenAPI specification
- [Examples](../examples/) - Working code samples

---

**Print this page for quick reference while coding!**
