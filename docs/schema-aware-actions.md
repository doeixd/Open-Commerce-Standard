# Schema-Aware Actions in OCP

**Capability ID:** `dev.ocp.hypermedia.schema_aware_actions@1.0`
**Status:** Proposed Enhancement
**Date:** October 23, 2025

---

## Problem Statement

Currently, OCP actions provide hypermedia links but **don't advertise schemas**:

```json
{
  "id": "order_123",
  "status": "confirmed",
  "actions": [
    {
      "id": "cancel",
      "href": "/orders/order_123/cancel",
      "method": "POST"
    }
  ]
}
```

**Limitations:**
- ❌ Clients don't know what request body to send
- ❌ No validation rules available
- ❌ Can't generate forms dynamically
- ❌ No type information for strongly-typed clients
- ❌ Requires out-of-band documentation

---

## Solution: Schema-Aware Actions

Extend actions to include schema references:

```json
{
  "id": "order_123",
  "status": "confirmed",
  "actions": [
    {
      "id": "cancel",
      "href": "/orders/order_123/cancel",
      "method": "POST",
      "requestSchema": {
        "$ref": "https://schemas.OCP.dev/order/actions/cancel_request/v1.json"
      },
      "responseSchema": {
        "$ref": "https://schemas.OCP.dev/order/v1.json"
      },
      "title": "Cancel Order",
      "description": "Cancel this order if it hasn't been fulfilled yet"
    }
  ]
}
```

---

## Enhanced Action Schema

### Core Structure

```yaml
Action:
  type: object
  properties:
    # Existing fields
    id: { type: string }
    href: { type: string, format: uri }
    method: { type: string, enum: [GET, POST, PUT, PATCH, DELETE] }
    rel: { type: string }

    # NEW: Schema-aware fields
    title:
      type: string
      description: "Human-readable action name for UI display"
    description:
      type: string
      description: "Detailed explanation of what this action does"
    requestSchema:
      type: object
      description: "JSON Schema for the request body"
      properties:
        $ref: { type: string, format: uri }
        inline: { type: object }  # For small schemas
    responseSchema:
      type: object
      description: "JSON Schema for the response body"
    errorSchemas:
      type: array
      description: "Possible error responses"
      items:
        type: object
        properties:
          statusCode: { type: integer }
          schema: { type: object }
    parameters:
      type: array
      description: "URL/query parameters"
      items:
        type: object
        properties:
          name: { type: string }
          in: { type: string, enum: [path, query, header] }
          required: { type: boolean }
          schema: { type: object }
    examples:
      type: object
      properties:
        request: { type: object }
        response: { type: object }
  required: [id, href]
```

---

## Complete Examples

### Example 1: Cancel Order

```json
{
  "id": "order_123",
  "status": "confirmed",
  "actions": [
    {
      "id": "cancel",
      "href": "/orders/order_123/cancel",
      "method": "POST",
      "title": "Cancel Order",
      "description": "Cancel this order. Refunds will be processed within 5-7 business days.",

      "requestSchema": {
        "$ref": "https://schemas.OCP.dev/order/actions/cancel_request/v1.json"
      },

      "responseSchema": {
        "$ref": "https://schemas.OCP.dev/order/v1.json"
      },

      "errorSchemas": [
        {
          "statusCode": 400,
          "errorCodes": ["cancellation_window_expired"],
          "description": "Order cannot be cancelled (window expired)"
        }
      ],

      "examples": {
        "request": {
          "reason": "Changed my mind"
        },
        "response": {
          "id": "order_123",
          "status": "cancelled",
          "refundStatus": "processing"
        }
      }
    }
  ]
}
```

### Example 2: Add Rating (with inline schema)

```json
{
  "id": "order_123",
  "status": "completed",
  "actions": [
    {
      "id": "add_rating",
      "href": "/orders/order_123/ratings",
      "method": "POST",
      "title": "Rate Your Order",
      "description": "Share your feedback about this order",

      "requestSchema": {
        "inline": {
          "type": "object",
          "properties": {
            "food": {
              "type": "integer",
              "minimum": 1,
              "maximum": 5,
              "description": "Food quality rating"
            },
            "delivery": {
              "type": "integer",
              "minimum": 1,
              "maximum": 5,
              "description": "Delivery service rating"
            },
            "comment": {
              "type": "string",
              "maxLength": 500,
              "description": "Optional feedback"
            }
          },
          "required": ["food", "delivery"]
        }
      },

      "responseSchema": {
        "$ref": "https://schemas.OCP.dev/order/v1.json"
      },

      "examples": {
        "request": {
          "food": 5,
          "delivery": 4,
          "comment": "Great food, slightly late delivery"
        }
      }
    }
  ]
}
```

### Example 3: Return Item (with parameters)

```json
{
  "id": "order_123",
  "status": "completed",
  "actions": [
    {
      "id": "initiate_return",
      "href": "/orders/order_123/returns",
      "method": "POST",
      "title": "Return Items",
      "description": "Start a return for one or more items from this order",

      "parameters": [
        {
          "name": "orderId",
          "in": "path",
          "required": true,
          "schema": { "type": "string", "format": "uuid" }
        }
      ],

      "requestSchema": {
        "$ref": "https://schemas.OCP.dev/order/actions/return_request/v1.json"
      },

      "responseSchema": {
        "$ref": "https://schemas.OCP.dev/order/return/v1.json"
      },

      "examples": {
        "request": {
          "items": [
            {
              "cartItemId": "item_456",
              "quantity": 1,
              "reason": "Wrong size"
            }
          ]
        },
        "response": {
          "id": "return_789",
          "status": "requested",
          "returnLabelUrl": "https://example.com/label/789.pdf"
        }
      }
    }
  ]
}
```

---

## Benefits

### 1. Dynamic Client Generation

```javascript
// Client can generate forms dynamically
async function renderActionForm(action) {
  const schema = await fetch(action.requestSchema.$ref).then(r => r.json());

  // Generate form fields from schema
  const form = document.createElement('form');
  for (const [field, config] of Object.entries(schema.properties)) {
    const input = createInputFromSchema(field, config);
    form.appendChild(input);
  }

  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    await fetch(action.href, {
      method: action.method,
      body: JSON.stringify(Object.fromEntries(data))
    });
  };

  return form;
}
```

### 2. Strong Typing (TypeScript)

```typescript
// Generate TypeScript types from schemas
type CancelOrderRequest = {
  reason?: string;
};

type CancelOrderResponse = Order;

async function cancelOrder(
  orderId: string,
  request: CancelOrderRequest
): Promise<CancelOrderResponse> {
  // Type-safe implementation
}
```

### 3. Client-Side Validation

```javascript
// Validate before sending
function validateAgainstSchema(data, action) {
  const schema = action.requestSchema.inline ||
                 await fetch(action.requestSchema.$ref).then(r => r.json());

  const ajv = new Ajv();
  const valid = ajv.validate(schema, data);

  if (!valid) {
    return {
      valid: false,
      errors: ajv.errors.map(e => ({
        field: e.instancePath,
        message: e.message
      }))
    };
  }

  return { valid: true };
}
```

### 4. API Documentation Generation

```javascript
// Generate OpenAPI spec from actions
function generateOpenAPIFromActions(order) {
  const paths = {};

  for (const action of order.actions) {
    paths[action.href] = {
      [action.method.toLowerCase()]: {
        summary: action.title,
        description: action.description,
        requestBody: {
          content: {
            'application/json': {
              schema: action.requestSchema
            }
          }
        },
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: action.responseSchema
              }
            }
          }
        }
      }
    };
  }

  return { paths };
}
```

---

## Server Implementation

### Capability Advertisement

```json
{
  "capabilities": [
    {
      "id": "dev.ocp.hypermedia.schema_aware_actions@1.0",
      "schemaUrl": "https://schemas.OCP.dev/hypermedia/schema_aware_actions/v1.json",
      "metadata": {
        "_version": "1.0",
        "enabled": true,
        "schemaFormat": "json-schema",
        "inlineSchemas": true,
        "includeExamples": true
      }
    }
  ]
}
```

### Action Builder Helper

```javascript
function buildAction({
  id,
  href,
  method = 'POST',
  title,
  description,
  requestSchemaUrl,
  responseSchemaUrl,
  inlineRequestSchema,
  examples
}) {
  const action = {
    id,
    href,
    method,
    title,
    description
  };

  // Add request schema
  if (inlineRequestSchema) {
    action.requestSchema = { inline: inlineRequestSchema };
  } else if (requestSchemaUrl) {
    action.requestSchema = { $ref: requestSchemaUrl };
  }

  // Add response schema
  if (responseSchemaUrl) {
    action.responseSchema = { $ref: responseSchemaUrl };
  }

  // Add examples if enabled
  if (examples && serverConfig.includeExamples) {
    action.examples = examples;
  }

  return action;
}

// Usage
const order = {
  id: 'order_123',
  status: 'confirmed',
  actions: [
    buildAction({
      id: 'cancel',
      href: `/orders/order_123/cancel`,
      title: 'Cancel Order',
      description: 'Cancel this order',
      requestSchemaUrl: 'https://schemas.OCP.dev/order/actions/cancel_request/v1.json',
      responseSchemaUrl: 'https://schemas.OCP.dev/order/v1.json',
      examples: {
        request: { reason: 'Changed my mind' }
      }
    })
  ]
};
```

---

## Client Implementation

### Capability Detection

```javascript
async function supportsSchemaAwareActions() {
  const caps = await fetch('/capabilities').then(r => r.json());
  return caps.capabilities.some(
    c => c.id === 'dev.ocp.hypermedia.schema_aware_actions@1.0'
  );
}
```

### Smart Action Handler

```javascript
class ActionHandler {
  async execute(action, data) {
    // Validate if schema available
    if (action.requestSchema) {
      const validation = await this.validate(data, action.requestSchema);
      if (!validation.valid) {
        throw new ValidationError(validation.errors);
      }
    }

    // Execute action
    const response = await fetch(action.href, {
      method: action.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    // Validate response if schema available
    if (action.responseSchema) {
      const responseData = await response.json();
      await this.validate(responseData, action.responseSchema);
    }

    return response;
  }

  async validate(data, schemaRef) {
    const schema = schemaRef.inline ||
                   await fetch(schemaRef.$ref).then(r => r.json());
    // Use ajv or similar
    return validateWithAjv(data, schema);
  }
}
```

---

## Backward Compatibility

**Fully backward compatible!**

- ✅ Old clients ignore new fields
- ✅ New clients detect capability and use schemas
- ✅ Servers can opt-in gradually
- ✅ No breaking changes to existing actions

### Migration Path

**Phase 1: Add capability**
```json
{
  "capabilities": [
    { "id": "dev.ocp.hypermedia.schema_aware_actions@1.0" }
  ]
}
```

**Phase 2: Add schemas to actions**
- Start with important actions (cancel, return)
- Add `title`, `description`, `requestSchema`
- Monitor client usage

**Phase 3: Full adoption**
- All actions include schemas
- Generate API docs automatically
- Enable client code generation

---

## Comparison to Existing Standards

### vs. OpenAPI
- ✅ **Advantage**: Runtime discovery (not static spec)
- ✅ **Advantage**: State-dependent (actions vary by order status)
- ✅ **Advantage**: Embedded in responses (no separate spec file)

### vs. JSON:API
- ✅ **Advantage**: Uses JSON Schema (more widespread)
- ✅ **Advantage**: Simpler structure
- ✅ **Advantage**: Compatible with OCP patterns

### vs. HAL / Siren
- ✅ **Advantage**: Explicit schemas (not just links)
- ✅ **Advantage**: Validation-ready
- ✅ **Advantage**: Type generation support

---

## Schema Registry

For schema-aware actions to work well, establish a schema registry:

### Registry Structure
```
https://schemas.OCP.dev/
├── order/
│   ├── v1.json (Order schema)
│   └── actions/
│       ├── cancel_request/v1.json
│       ├── return_request/v1.json
│       └── rating_request/v1.json
├── cart/
│   └── actions/
│       └── add_item_request/v1.json
└── error/
    └── v1.json
```

### Schema Versioning
- Use semantic versioning in URLs
- Cache schemas client-side
- Deprecate old versions with 12-month notice

---

## Future Enhancements

### Conditional Actions
```json
{
  "id": "cancel",
  "href": "/orders/123/cancel",
  "condition": {
    "field": "createdAt",
    "operator": "within",
    "value": "24h"
  }
}
```

### Action Chains
```json
{
  "id": "initiate_return",
  "nextActions": [
    { "id": "print_label" },
    { "id": "track_return" }
  ]
}
```

### Form Hints
```json
{
  "requestSchema": {
    "inline": {
      "properties": {
        "reason": {
          "type": "string",
          "ui:widget": "textarea",
          "ui:placeholder": "Tell us why..."
        }
      }
    }
  }
}
```

---

## Summary

**Schema-aware actions transform OCP from:**
- ❌ "Here's a link, good luck figuring out what to send"

**To:**
- ✅ "Here's a link, schema, examples, and validation rules"

**Benefits:**
- ✅ Self-documenting APIs
- ✅ Dynamic form generation
- ✅ Type-safe clients
- ✅ Better DX
- ✅ Fewer integration errors
- ✅ Automatic API docs

**Recommendation:** Implement as optional capability with gradual adoption path.

---

**Status:** Ready for community feedback and RFC
**Next Steps:** Gather implementer input, create reference implementation
**Target:** OCP v1.1 or v2.0
