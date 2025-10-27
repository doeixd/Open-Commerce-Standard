# OCP Examples

This directory contains simple, runnable examples to help you learn OCP quickly.

## 📁 Files

### Beginner Examples

| File | Description | Run It |
|------|-------------|--------|
| **simple-server.js** | Minimal OCP server (Node.js/Express) | `npm install express && node simple-server.js` |
| **simple-client.js** | Basic OCP client with multiple examples | Included in any JS environment |
| **index-with-discovery.html** | HTML page with all 4 discovery mechanisms | Open in browser |

### Reference Files

| File | Description | Use Case |
|------|-------------|----------|
| **.well-known/ocp** | Example discovery endpoint response | Copy to your server's `.well-known/` directory |

---

## 🚀 Quick Start

### Running the Server

```bash
# 1. Install dependencies
npm install express

# 2. Start the server
node simple-server.js

# 3. Test it
curl http://localhost:3000/capabilities
```

The server will run on `http://localhost:3000` with these endpoints:
- `GET /.well-known/ocp` - Discovery
- `GET /capabilities` - List features
- `GET /catalogs/main` - Browse products
- `POST /orders` - Place orders (requires auth header)
- `POST /carts` - Create shopping cart

### Using the Client

The client examples work with any OCP server:

```javascript
// Edit simple-client.js to point to your server
const BASE_URL = 'http://localhost:3000';

// Run examples in Node.js
node -e "
  const { browseProducts, placeOrder } = require('./simple-client.js');
  (async () => {
    const products = await browseProducts('main');
    console.log('Products:', products);
  })();
"
```

Or include in a browser:

```html
<script src="simple-client.js"></script>
<script>
  browseProducts('main').then(products => {
    console.log('Products:', products);
  });
</script>
```

---

## 📚 What Each Example Teaches

### simple-server.js

**Teaches:**
- Minimum viable OCP server (3 endpoints)
- Discovery endpoint (`.well-known/ocp`)
- Cart management
- Order placement (direct and cart-based)
- Basic auth middleware
- Hypermedia actions

**Complexity:** Beginner
**Lines of Code:** ~350
**Features:** Levels 0, 1, 4, 5

**Try these requests:**

```bash
# Discovery
curl http://localhost:3000/.well-known/ocp

# Browse products
curl http://localhost:3000/catalogs/main

# Place direct order
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer demo_token" \
  -d '{
    "items": [{"catalogItemId": "coffee_mug", "quantity": 1}],
    "deliveryAddress": {"address": "123 Main St"}
  }'
```

---

### simple-client.js

**Teaches:**
- Discovering server capabilities
- Browsing catalogs
- Placing orders
- Cart-based checkout flow
- Working with product variants
- Subscribing to real-time updates (SSE)

**Complexity:** Beginner to Intermediate
**Exports:** Reusable functions

**Examples included:**

1. **Basic Flow** (`main()`)
   - Discover capabilities
   - Browse products
   - Place order

2. **Cart-Based Flow** (`cartBasedFlow()`)
   - Create cart
   - Add multiple items
   - Checkout

3. **Variant Example** (`variantExample()`)
   - Find products with variants
   - Select size/color
   - Order specific variant

4. **Real-Time Updates** (`subscribeToOrderUpdates()`)
   - Connect to SSE endpoint
   - Receive order patches
   - Update UI in real-time

**Run examples:**

```javascript
// Uncomment at bottom of file:
main();
// cartBasedFlow();
// variantExample();
// subscribeToOrderUpdates('order_123');
```

---

### index-with-discovery.html

**Teaches:**
- HTML meta tags for discovery
- JSON-LD structured data
- HTTP header examples (in comments)
- Schema.org integration

**Complexity:** Beginner
**Use:** Template for your storefront

**Features demonstrated:**
- ✅ OCP meta tags
- ✅ JSON-LD EntryPoint
- ✅ Schema.org Store markup
- ✅ Comments showing HTTP header config

**View:**
```bash
# Serve with any HTTP server
python -m http.server 8000
# Open http://localhost:8000/index-with-discovery.html
```

---

### .well-known/ocp

**Teaches:**
- RFC 8615 well-known URI format
- Discovery response structure
- CORS and caching headers (see server example)

**Complexity:** Beginner
**Use:** Copy to your server's public directory

**Typical setup:**

```
your-server/
├── public/
│   └── .well-known/
│       └── OCP          ← This file
└── api/
    └── capabilities     ← Your API
```

---

## 🎯 Learning Path with Examples

### Path 1: "I want to build a server"

1. **Read:** [Getting Started Lite](../docs/getting-started-lite.md)
2. **Study:** `simple-server.js`
3. **Modify:** Add your own products
4. **Extend:** Add a new capability (variants, tracking, etc.)

### Path 2: "I want to build a client"

1. **Read:** [Getting Started Lite](../docs/getting-started-lite.md)
2. **Study:** `simple-client.js`
3. **Run:** Against `simple-server.js`
4. **Extend:** Add UI components for your app

### Path 3: "I want to understand discovery"

1. **Study:** `index-with-discovery.html`
2. **Study:** `.well-known/ocp`
3. **Read:** [OCP Discovery Spec](../docs/OCP-discovery.md)
4. **Test:** Use client discovery functions

---

## 💡 Common Modifications

### Add a New Product (Server)

```javascript
// In simple-server.js, add to store.products:
{
  id: 'new_product',
  name: 'My Product',
  price: { amount: '19.99', currency: 'USD' },
  fulfillmentType: 'physical', // or 'digital' or 'pickup'
  available: true,
  description: 'Product description'
}
```

### Add Product Variants (Server)

```javascript
// Add to product object:
metadata: {
  'dev.ocp.product.variants@1.0': {
    _version: '1.0',
    options: ['Size', 'Color'],
    variants: [
      {
        id: 'var_large_red',
        values: ['Large', 'Red'],
        price: { amount: '24.99', currency: 'USD' },
        stock: 10
      }
    ]
  }
}

// Update capabilities endpoint:
{
  id: 'dev.ocp.product.variants@1.0',
  schemaUrl: 'https://schemas.OCP.dev/product/variants/v1.json'
}
```

### Change Server Port

```javascript
// In simple-server.js:
const PORT = 8080; // Change from 3000
```

### Point Client to Different Server

```javascript
// In simple-client.js:
const BASE_URL = 'https://your-production-server.com';
```

### Add Authentication

```javascript
// Server: Update requireAuth() middleware
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  // Replace with real validation:
  if (token !== 'secret_token_123') {
    return res.status(401).json({
      code: 'unauthorized',
      message: 'Invalid token'
    });
  }

  next();
}

// Client: Update AUTH_TOKEN
const AUTH_TOKEN = 'secret_token_123';
```

---

## 🐛 Troubleshooting

### "Module not found: express"

```bash
npm install express
```

### "CORS error" in browser

The server includes CORS headers by default. If still blocked:

```javascript
// In simple-server.js, update CORS middleware:
res.header('Access-Control-Allow-Origin', 'http://your-frontend-domain.com');
```

### "401 Unauthorized"

Make sure you're including the Authorization header:

```bash
curl -H "Authorization: Bearer demo_token" ...
```

Or in client:
```javascript
headers: {
  'Authorization': 'Bearer demo_token'
}
```

### Server-Sent Events not working

SSE requires server implementation. The example server doesn't include SSE - see full spec for implementation details.

---

## 📖 Next Steps

After trying these examples:

1. **Understand Basics?** → Read [Progressive Guide](../docs/progressive-guide.md) to add features
2. **Ready for Production?** → Study [Full README](../README.md) and [OpenAPI Spec](../src/spec.yaml)
3. **Need Discovery?** → Read [OCP Discovery Spec](../docs/OCP-discovery.md)
4. **Want Advanced Features?** → Explore [schemas/](../schemas/) directory

---

## 🤝 Contributing Examples

Have a useful example? Contributions welcome!

- Python/Flask server
- React/Vue client
- Mobile app (React Native, Flutter)
- Database integration
- Payment integration
- Real-world use cases

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.
