# Fiat Payments with Stripe, Apple Pay, and SPC

**Status:** Community Guide
**Applies To:** OCS v1.0.0
**Goal:** Implement modern fiat payment flows using a stateful, hypermedia-driven approach, without using the stateless x402 protocol.

---

### Table of Contents

1.  [Core Philosophy: The Stateful, Hypermedia-Driven Flow](#1-core-philosophy-the-stateful-hypermedia-driven-flow)
2.  [The Stateful Order Lifecycle](#2-the-stateful-order-lifecycle)
3.  [Server-Side Implementation Guide](#3-server-side-implementation-guide)
4.  [Client-Side Implementation Guide](#4-client-side-implementation-guide)
5.  [Summary and Trade-offs](#5-summary-and-trade-offs)
6.  [Quick Reference](#6-quick-reference)

---

## 1. Core Philosophy: The Stateful, Hypermedia-Driven Flow

While the Open Commerce Standard (OCS) specifies a powerful, stateless payment protocol using the `402 Payment Required` status code, some implementations may prefer a more traditional, stateful approach. This guide outlines how to achieve this using OCS's core hypermedia principles.

Instead of a stateless request/retry loop, this pattern uses a stateful `Order` resource. The flow is as follows:

1.  **Create a Pending Order:** The client first creates an order without any payment details. The server responds by creating an `Order` resource with a status of `pending_payment`.
2.  **Discover Payment Actions:** The server's response includes a hypermedia `actions` array. A key action, `add_payment`, tells the client how to proceed with payment.
3.  **Client-Side Payment Authorization:** The client uses the metadata within the `add_payment` action to initialize the appropriate payment SDK (e.g., Stripe.js, Apple Pay) and guide the user through authorization.
4.  **Confirm Payment:** The client sends the resulting payment token or assertion to a dedicated confirmation endpoint provided by the server.
5.  **Finalize Order:** The server verifies the payment, captures the funds, and transitions the order's status to `confirmed`.

This pattern relies on the `Order` resource to hold state, and on the `actions` array to guide the client, making it fully compliant with OCS's HATEOAS design.

---

## 2. The Stateful Order Lifecycle

This pattern introduces a new `status` for the Order resource:

-   **`pending_payment`**: The order has been created and inventory may be reserved, but it is not yet paid. It is awaiting payment confirmation.
-   **`confirmed`**: Payment has been successfully processed. The order is now ready for fulfillment.
-   **`payment_failed`**: The payment attempt failed. The order remains in this state until a new payment is attempted or the order expires.
-   **`expired`**: The order was in `pending_payment` for too long and has been automatically cancelled by the server.

---

## 3. Server-Side Implementation Guide

### Step 3.1: Create the Order with `pending_payment` Status

Modify your `POST /orders` endpoint. When an order is created, set its initial status to `pending_payment` and include the `add_payment` action.

**Request:**
`POST /orders`
```json
{
  "items": [{ "catalogItemId": "prod_1", "quantity": 1 }],
  "deliveryAddress": { "address": "123 Main St" }
}
```

**Response (`201 Created`):**
```json
{
  "id": "order_abc123",
  "status": "pending_payment",
  "total": { "amount": "25.00", "currency": "USD" },
  "items": [...],
  "actions": [
    {
      "id": "add_payment",
      "href": "/orders/order_abc123/confirm-payment",
      "method": "POST",
      "title": "Add Payment",
      "description": "Provide payment details to complete this order.",
      "metadata": {
        // Metadata will contain provider-specific info
        // See Step 3.2 for examples
      }
    },
    {
      "id": "cancel",
      "href": "/orders/order_abc123/cancel",
      "method": "POST",
      "title": "Cancel Order"
    }
  ]
}
```

### Step 3.2: Define the `add_payment` Action's Metadata

The `metadata` block inside the `add_payment` action is where you provide the client with everything it needs to initialize the payment flow.

#### Example for Stripe Payment Intents

```json
"metadata": {
  "provider": "stripe",
  "clientSecret": "pi_3Pq..._secret_XYZ...",
  "publishableKey": "pk_test_..."
}
```

#### Example for Apple Pay / Google Pay (via Payment Request API)

```json
"metadata": {
  "provider": "payment_request_api",
  "paymentRequest": {
    "supportedMethods": ["https://apple.com/apple-pay", "https://google.com/pay"],
    "total": {
      "label": "Total",
      "amount": { "currency": "USD", "value": "25.00" }
    },
    "displayItems": [
      { "label": "Subtotal", "amount": { "currency": "USD", "value": "20.00" } },
      { "label": "Tax", "amount": { "currency": "USD", "value": "5.00" } }
    ]
  }
}
```

#### Example for Secure Payment Confirmation (SPC)

```json
"metadata": {
  "provider": "spc",
  "spcData": {
    "challenge": "base64EncodedChallengeString...",
    "credentialIds": ["base64CredentialId..."],
    "rpId": "bank.example.com",
    "instrument": {
      "displayName": "Visa ****1234",
      "icon": "https://bank.example.com/icon.png"
    }
  }
}
```

### Step 3.3: Implement the Payment Confirmation Endpoint

Create a new endpoint, as advertised in the action's `href`, to receive the payment token from the client.

`POST /orders/{id}/confirm-payment`

This endpoint's logic should:
1.  Find the order by its ID.
2.  Verify the order status is `pending_payment`.
3.  Take the payment token/assertion from the request body.
4.  Use your payment provider's SDK to confirm and capture the payment.
5.  If successful, update the order status to `confirmed` and return the final `Order` object.
6.  If it fails, update the order status to `payment_failed` and return an appropriate error.

**Request from Client:**
```json
{
  "provider": "stripe",
  "paymentMethodId": "pm_1Pq..." // From Stripe.js
}
```

**Server Logic (Pseudo-code):**
```javascript
app.post('/orders/:id/confirm-payment', async (req, res) => {
  const order = findOrderById(req.params.id);
  const { provider, paymentMethodId } = req.body;

  if (order.status !== 'pending_payment') {
    return res.status(409).json({ error: 'Order is not awaiting payment.' });
  }

  try {
    // Use the provider's SDK to process the payment
    const paymentResult = await stripe.paymentIntents.confirm(
      order.paymentIntentId, // Stored when the order was created
      { payment_method: paymentMethodId }
    );

    if (paymentResult.status === 'succeeded') {
      order.status = 'confirmed';
      order.actions = []; // Remove payment actions
      saveOrder(order);
      res.status(200).json(order);
    } else {
      order.status = 'payment_failed';
      saveOrder(order);
      res.status(400).json({ error: 'Payment failed' });
    }
  } catch (e) {
    res.status(500).json({ error: 'Server error during payment.' });
  }
});
```

### Step 3.4: Handle Webhooks (Recommended for Production)

For robustness, listen for webhooks from your payment provider. A webhook can reliably update the order's status even if the client disconnects after authorizing payment.

---

## 4. Client-Side Implementation Guide

### Step 4.1: Create the Initial Order

First, create the order to get its `pending_payment` state and available actions.

```javascript
async function createOrder() {
  const response = await fetch('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/ocs+json; version=1.0' },
    body: JSON.stringify({ items: [...] })
  });
  const pendingOrder = await response.json();
  
  // Find the action to add payment
  const paymentAction = pendingOrder.actions.find(a => a.id === 'add_payment');
  
  if (paymentAction) {
    // Proceed to process the payment
    processPaymentAction(paymentAction);
  }
}
```

### Step 4.2: Process the `add_payment` Action

Your client's logic will inspect the action's metadata and branch accordingly.

```javascript
function processPaymentAction(action) {
  const metadata = action.metadata;

  switch (metadata.provider) {
    case 'stripe':
      handleStripePayment(action, metadata);
      break;
    case 'payment_request_api':
      handlePaymentRequest(action, metadata);
      break;
    case 'spc':
      handleSPCPayment(action, metadata);
      break;
    default:
      console.error('Unsupported payment provider:', metadata.provider);
  }
}
```

#### Handling a Stripe Payment
```javascript
async function handleStripePayment(action, metadata) {
  const stripe = Stripe(metadata.publishableKey);

  // Use Stripe Elements to collect card details, then confirm
  const result = await stripe.confirmCardPayment(metadata.clientSecret, {
    payment_method: { card: cardElement }
  });

  if (result.error) {
    alert(result.error.message);
  } else {
    // Payment succeeded, now confirm with your server
    await confirmPaymentWithServer(action.href, {
      provider: 'stripe',
      paymentIntentId: result.paymentIntent.id
    });
  }
}
```

#### Handling Apple Pay / Google Pay
```javascript
async function handlePaymentRequest(action, metadata) {
  const paymentRequest = new PaymentRequest(
    metadata.paymentRequest.supportedMethods,
    metadata.paymentRequest
  );

  const result = await paymentRequest.show();
  
  if (result) {
    // The `result.details` object contains the payment token
    await confirmPaymentWithServer(action.href, {
      provider: 'payment_request_api',
      token: result.details
    });
    result.complete('success');
  }
}
```

#### Handling Secure Payment Confirmation (SPC)
```javascript
async function handleSPCPayment(action, metadata) {
  // Logic to build and show the SPC payment request
  const spcRequest = new PaymentRequest([...]); // Build from metadata.spcData
  const result = await spcRequest.show();

  if (result) {
    // The `result.details` contains the WebAuthn assertion
    await confirmPaymentWithServer(action.href, {
      provider: 'spc',
      assertion: result.details
    });
    result.complete('success');
  }
}
```

### Step 4.3: Confirm Payment with the Server

This function sends the token to the endpoint you created in Step 3.3.

```javascript
async function confirmPaymentWithServer(href, payload) {
  const response = await fetch(href, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (response.ok) {
    const finalOrder = await response.json();
    alert('Payment successful! Order confirmed.');
    // Update UI to show confirmed order state
    displayOrder(finalOrder);
  } else {
    alert('Payment confirmation failed.');
  }
}
```

---

## 5. Summary and Trade-offs

This stateful, hypermedia-driven pattern is a robust and widely understood alternative for integrating fiat payments.

**Pros:**
*   **Familiar Pattern:** Aligns with how many web applications handle multi-step processes.
*   **Explicit State:** The `pending_payment` status makes the order's state clear at all times.
*   **Server-Driven:** The `actions` array still allows the server to control which payment methods are available.

**Cons:**
*   **Increased State Management:** The server must manage the lifecycle of pending orders (e.g., expiring them after a timeout).
*   **Less Universal Client:** The client needs to have logic and potentially SDKs for each payment provider (Stripe, etc.), whereas the x402 pattern abstracts this away.
*   **More "Chatty":** This flow typically requires at least two client-server interactions (`POST /orders`, then `POST /orders/{id}/confirm-payment`) compared to the single request/retry of the x402 pattern.

---

## 6. Quick Reference

**Flow:**
1.  `CLIENT` -> `POST /orders`
2.  `SERVER` -> `201 Created` with `Order` in `pending_payment` status and `add_payment` action.
3.  `CLIENT` -> Uses metadata from `add_payment` action to interact with payment provider SDK.
4.  `CLIENT` -> `POST /orders/{id}/confirm-payment` with payment token/assertion.
5.  `SERVER` -> Verifies payment, updates order status to `confirmed`, and returns final `Order` object.

**Key `Order` Statuses:**
*   `pending_payment`
*   `payment_failed`
*   `confirmed`



# Comparative Analysis: OCS Fiat Payment Patterns

The Open Commerce Standard (OCS) is flexible enough to support multiple payment integration patterns. This document compares two primary approaches for handling fiat payments like Stripe, Apple Pay, and SPC:

1.  **Stateless x402 Pattern:** The official, recommended approach using the `402 Payment Required` HTTP status code for a stateless, universal flow.
2.  **Stateful Hypermedia Pattern:** A more traditional, alternative approach that uses a `pending_payment` order state and hypermedia `actions` to guide the client.

Both patterns are valid within the OCS framework, but they offer different architectural trade-offs.

---

## 1. At a Glance: Core Differences

| Feature | Stateless x402 Pattern (Recommended) | Stateful Hypermedia Pattern |
| :--- | :--- | :--- |
| **Primary Mechanism** | HTTP `402` Status Code & `X-PAYMENT` Header | `Order` Resource State (`pending_payment`) & `actions` array |
| **State Management** | **Stateless.** Server holds no "pending" state. | **Stateful.** Server must manage `pending_payment` orders. |
| **Client Complexity** | **Low.** Client is "dumb" and follows generic instructions. | **Higher.** Client needs logic for each payment provider. |
| **Number of API Calls** | **1 (with retry).** `POST /orders` -> `402` -> `POST /orders`. | **2.** `POST /orders` -> `201` -> `POST /confirm-payment`. |
| **Universality** | **High.** A single client can support any provider the server adds. | **Lower.** Client must be updated to support new providers. |
| **Familiarity** | **Less familiar** to many web developers. | **Highly familiar,** mirrors common web application flows. |
| **Atomicity** | **High.** Order creation and payment are one atomic transaction. | **Lower.** Order creation and payment are two separate steps. |

---

## 2. Detailed Flow Comparison

Let's trace a simple Stripe payment through both patterns.

### Stateless x402 Pattern

**Goal:** Create an order and pay for it in a single, atomic, server-guided transaction.

| Step | Actor | Action |
| :--- | :--- | :--- |
| 1 | Client | Sends `POST /orders` with items and address. **No payment info.** |
| 2 | Server | Validates the order. Determines payment is needed. **Does not create an order record yet.** |
| 3 | Server | Responds with **`402 Payment Required`**. The body contains a JSON object with everything the client needs to initialize the Stripe SDK (e.g., `clientSecret`). |
| 4 | Client | Receives the `402`. It **does not need to know what "Stripe" is.** It finds the `fiat_intent` scheme and uses the provided `clientSecret` to launch the payment SDK. |
| 5 | User | Interacts with the Stripe UI (e.g., enters card details, completes 3D Secure). |
| 6 | Client | The Stripe SDK returns a success signal. |
| 7 | Client | **Retries the original `POST /orders` request**, but this time includes an `X-PAYMENT` header containing the payment confirmation payload. |
| 8 | Server | Receives the retry. It verifies the `X-PAYMENT` payload, captures the funds, creates the final `Order` record with status `confirmed`, and returns **`201 Created`**. |

**Outcome:** A single `Order` record is created directly in the `confirmed` state. The transaction is atomic.

### Stateful Hypermedia Pattern

**Goal:** First create a placeholder order, then discover how to pay for it.

| Step | Actor | Action |
| :--- | :--- | :--- |
| 1 | Client | Sends `POST /orders` with items and address. **No payment info.** |
| 2 | Server | Validates the order. **Creates an `Order` record** in the database with `status: 'pending_payment'`. |
| 3 | Server | Responds with **`201 Created`**. The body contains the new `Order` object, which includes an `actions` array with an `add_payment` action. This action's metadata contains the Stripe `clientSecret`. |
| 4 | Client | Receives the `201`. **It must now check the provider** ("stripe") in the metadata and trigger its Stripe-specific logic. |
| 5 | User | Interacts with the Stripe UI. |
| 6 | Client | The Stripe SDK returns a success signal. |
| 7 | Client | Follows the `href` from the `add_payment` action, sending a **new request** (`POST /orders/{id}/confirm-payment`) with the Stripe payment token. |
| 8 | Server | Receives the confirmation. It finds the existing `pending_payment` order, verifies the token, captures the funds, updates the order status to `confirmed`, and returns **`200 OK`** with the updated `Order` object. |

**Outcome:** An `Order` record transitions from `pending_payment` to `confirmed`. The transaction is split into two distinct server operations.

---

## 3. Architectural Trade-offs Analysis

### Client-Side Perspective

| Aspect | Stateless x402 Pattern | Stateful Hypermedia Pattern |
| :--- | :--- | :--- |
| **Code Logic** | `try { await placeOrder() } catch (e if e.status === 402) { handlePayment(e.body); await placeOrder(withPayment); }` | `const order = await createOrder(); const action = findPaymentAction(order); handlePayment(action); await confirmPayment(action.href);` |
| **Provider Support** | **Universal.** The client's code is generic. It can support Stripe, PayPal, or any future provider without modification, as long as it can handle the basic schemes (`fiat_intent`, etc.). | **Specific.** The client must contain explicit code branches (`if (provider === 'stripe')`, `if (provider === 'paypal')`) and the corresponding SDKs for every supported provider. |
| **Resilience** | **High.** The entire flow is a single logical transaction. If the client disconnects after payment, it can simply retry the original request with the same `Idempotency-Key`. | **Moderate.** If the client disconnects after payment but before confirming, the order remains `pending_payment`. The server needs a robust webhook and expiration system to handle this. |

### Server-Side Perspective

| Aspect | Stateless x402 Pattern | Stateful Hypermedia Pattern |
| :--- | :--- | :--- |
| **State Management** | **Simple.** The server is stateless regarding the payment flow. No need to manage "abandoned" pending orders. An order either exists and is paid, or it doesn't exist. | **Complex.** The server is stateful. It must create, manage, and eventually expire/delete `pending_payment` orders. This requires background jobs and adds database complexity. |
| **Implementation** | **Novel.** Requires implementing the `402` response logic and the `X-PAYMENT` header verification. This pattern is less common in typical web frameworks. | **Familiar.** This is a standard multi-step workflow. The logic of "create, then update" is well-understood and easy to implement in most frameworks. |
| **Atomicity** | **Guaranteed.** The order record is only created once payment is confirmed, ensuring data integrity. | **Requires Care.** The server must ensure that the transition from `pending_payment` to `confirmed` is atomic and that payment can't be confirmed twice. Webhooks are essential for production reliability. |

---

## 4. Which Pattern Should You Use?

**Choose the Stateless x402 Pattern if:**
*   You are building a **universal client** designed to work with any OCS server.
*   You prioritize **architectural elegance, atomicity, and simplicity** on the server.
*   Your developers are comfortable learning a slightly unconventional but powerful HTTP pattern.
*   You are building for the future, including potential for **AI agents or other automated systems** that benefit from a simple, stateless protocol.
*   You want to support both **fiat and Web3 payments** through a single, unified flow.

**Choose the Stateful Hypermedia Pattern if:**
*   You are building a **single client for a single backend** and don't need universality.
*   Your development team has a strong preference for **traditional, familiar web application patterns.**
*   The concept of a `pending_payment` order is a natural fit for your business logic (e.g., you need to reserve inventory for a period before payment).
*   You are migrating an existing system where this stateful flow is already in place.

### Final Recommendation

For new, greenfield projects aiming to fully embrace the power and philosophy of the Open Commerce Standard, the **Stateless x402 Pattern is the recommended approach.** It best embodies the goals of universality, resilience, and server-driven logic.

The **Stateful Hypermedia Pattern** remains an excellent, fully compliant, and practical alternative for teams who prioritize implementation familiarity and have business needs that align with a stateful order model.