# Implementation Guide: Integrating Web Payments and Secure Payment Confirmation into OCS

**Date:** October 23, 2025
**Version:** 1.0
**Status:** Implementation Guide

**References:**
- [W3C Payment Request API](https://www.w3.org/TR/payment-request/) (Candidate Recommendation)
- [W3C Secure Payment Confirmation](https://www.w3.org/TR/secure-payment-confirmation/) (Candidate Recommendation Draft)
- [OCS Specification v1.0.0](../src/spec.yaml)
- [x402 Payment Protocol](../README.md#x402-payment-protocol)

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Capability Definitions](#2-capability-definitions)
3. [Server-Side Implementation](#3-server-side-implementation)
4. [Client-Side Implementation](#4-client-side-implementation)
5. [Registration Flows for SPC](#5-registration-flows-for-spc)
6. [Error Handling and Fallbacks](#6-error-handling-and-fallbacks)
7. [Security Considerations](#7-security-considerations)
8. [Testing and Compatibility](#8-testing-and-compatibility)
9. [Future Updates](#9-future-updates)

---

## 1. Introduction

### 1.1 Overview of the Standards

**Web Payments (Payment Request API)**: A browser API that streamlines checkout by allowing users to select saved payment methods (e.g., credit cards, digital wallets like Apple Pay or Google Pay) via a native UI. It collects tokenized credentials and details (e.g., shipping addresses), which are sent to the server for processing. It's fiat-focused but extensible.

**Secure Payment Confirmation (SPC)**: Built on WebAuthn, SPC enables strong, biometric-based authentication (e.g., Touch ID, Windows Hello) during payments. It involves device registration with a Relying Party (RP, e.g., a bank) and transaction confirmation. SPC reduces fraud and friction, with trials showing 8% better conversion rates and 3x faster checkouts.

### 1.2 Benefits for OCS

- **Improved UX**: Native UIs reduce form-filling and cart abandonment
- **Enhanced Security**: SPC provides phishing-resistant authentication; Web Payments tokenizes sensitive data
- **Compliance**: Supports regulations like PSD2/SCA in Europe
- **Extensibility**: Fits OCS's capability discovery model, allowing adaptive clients
- **Conversion Boost**: Stripe's 2025 SPC trials reported significant improvements in completion rates
- **Limitations**: Browser-centric; fallback required for non-browsers (e.g., manual forms or OTPs)

### 1.3 How They Integrate with x402

Both standards complement OCS's x402 Protocol:

- **x402** unifies payments in a stateless HTTP retry loop: `POST /orders` → `402 Payment Required` → client authorizes → retry with `X-PAYMENT`
- **Web Payments and SPC** handle client-side authorization for `fiat_intent` scheme, feeding into `X-PAYMENT` without altering server logic
- The server includes Web Payments/SPC-specific data in the `extra` field of the 402 response

### 1.4 Prerequisites

**Server:**
- OCS server implementing x402 with `fiat_intent` support
- Integration with payment provider (e.g., Stripe, PayPal)
- Ability to verify WebAuthn assertions (for SPC)
- RP coordination for SPC credential registration/verification
- **Recommended:** `dev.ocs.auth.flows@1.0` with WebAuthn support for unified authentication

**Client:**
- Browser supporting the APIs:
  - Check via `window.PaymentRequest` for Web Payments
  - Check `'SecurePaymentConfirmationRequest' in window` for SPC
- Graceful fallback handling for unsupported browsers

**Testing:**
- Chrome DevTools for debugging
- W3C test suites for compliance
- Origin Trials if using experimental features

### 1.5 Relationship to OCS Authentication

**WebAuthn Integration:**

OCS has a general authentication capability (`dev.ocs.auth.flows@1.0`) that includes WebAuthn as a supported authentication method. The relationship between general WebAuthn auth and SPC for payments is:

1. **General Auth (dev.ocs.auth.flows@1.0 + dev.ocs.auth.webauthn@1.0):**
   - Used for user login/authentication
   - Creates passkeys for accessing account
   - Credentials managed by the merchant/store
   - RP ID is the merchant's domain

2. **SPC (dev.ocs.payment.spc@1.0):**
   - Used specifically for payment authorization
   - Creates credentials for payment confirmation
   - Credentials managed by bank/issuer (RP)
   - RP ID is the bank's domain

**They are complementary:**
- A user might authenticate to a store using WebAuthn (general auth)
- Then authorize a payment using SPC with their bank's credential
- The store verifies user identity; the bank verifies payment authority

**Unified Experience:**

Servers implementing both should coordinate the flows:

```javascript
// General auth - user logs in
if (authCapability && authCapability.methods.includes('webauthn')) {
  // Use dev.ocs.auth.webauthn@1.0 for login
  // rpId: "shop.example.com"
}

// Payment auth - user authorizes payment
if (spcCapability) {
  // Use dev.ocs.payment.spc@1.0 for payment
  // rpId: "bank.example.com" (from user's issuer)
}
```

This separation ensures:
- **Security:** Payment credentials are controlled by financial institutions
- **Privacy:** Merchants don't control payment authentication
- **Standards:** Aligns with W3C SPC specification design

---

## 2. Capability Definitions

OCS uses dynamic capabilities (`GET /capabilities`) for discoverability. Two new optional capabilities are defined for these standards, following OCS versioning rules (minor for additions, major for breaks, 12-month deprecation notice).

### 2.1 Web Payments Capability

**Capability ID:** `dev.ocs.payment.web_payments@1.0`

**Schema Location:** `schemas/payment/web_payments/v1.json`

**Schema Definition:**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.ocs.dev/payment/web_payments/v1.json",
  "title": "Web Payments Capability",
  "type": "object",
  "properties": {
    "_version": {
      "type": "string",
      "const": "1.0"
    },
    "supportedMethods": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1,
      "description": "W3C payment method identifiers (e.g., 'basic-card', 'https://apple.com/apple-pay')"
    },
    "merchantIdentifier": {
      "type": "string",
      "description": "Merchant identifier for methods like Apple Pay"
    },
    "merchantName": {
      "type": "string",
      "description": "Display name shown in payment UI"
    },
    "supportedNetworks": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["visa", "mastercard", "amex", "discover", "jcb", "diners", "maestro", "unionpay"]
      }
    },
    "requireShippingAddress": {
      "type": "boolean",
      "default": false
    },
    "requireBillingAddress": {
      "type": "boolean",
      "default": false
    }
  },
  "required": ["_version", "supportedMethods"]
}
```

**Advertisement Example:**

```json
{
  "capabilities": [
    {
      "id": "dev.ocs.payment.web_payments@1.0",
      "schemaUrl": "https://schemas.ocs.dev/payment/web_payments/v1.json",
      "metadata": {
        "_version": "1.0",
        "supportedMethods": ["basic-card", "https://google.com/pay"],
        "merchantName": "Example Shop",
        "supportedNetworks": ["visa", "mastercard", "amex"]
      }
    }
  ]
}
```

### 2.2 Secure Payment Confirmation Capability

**Capability ID:** `dev.ocs.payment.spc@1.0`

**Schema Location:** `schemas/payment/spc/v1.json`

**Schema Definition:**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://schemas.ocs.dev/payment/spc/v1.json",
  "title": "Secure Payment Confirmation (SPC) Capability",
  "type": "object",
  "properties": {
    "_version": {
      "type": "string",
      "const": "1.0"
    },
    "supportedRps": {
      "type": "array",
      "items": { "type": "string", "format": "hostname" },
      "minItems": 1,
      "description": "RP domains (e.g., 'bank.example.com')"
    },
    "registrationUrl": {
      "type": "string",
      "format": "uri",
      "description": "URL for RP registration iframe"
    },
    "registrationFlow": {
      "type": "string",
      "enum": ["iframe", "redirect", "popup"],
      "default": "iframe"
    },
    "timeout": {
      "type": "integer",
      "minimum": 30000,
      "maximum": 600000,
      "default": 300000
    },
    "requiresEnrollment": {
      "type": "boolean",
      "default": true
    },
    "fallbackMethods": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["otp", "password", "web_payments", "manual_entry"]
      }
    }
  },
  "required": ["_version", "supportedRps"]
}
```

**Advertisement Example:**

```json
{
  "capabilities": [
    {
      "id": "dev.ocs.payment.spc@1.0",
      "schemaUrl": "https://schemas.ocs.dev/payment/spc/v1.json",
      "metadata": {
        "_version": "1.0",
        "supportedRps": ["bank.example.com"],
        "registrationUrl": "https://bank.example.com/register-spc",
        "timeout": 300000,
        "fallbackMethods": ["otp", "web_payments"]
      }
    }
  ]
}
```

---

## 3. Server-Side Implementation

### 3.1 Advertising Capabilities

In your `GET /capabilities` endpoint, include the Web Payments and/or SPC capabilities if your server supports them:

```javascript
app.get('/capabilities', (req, res) => {
  res.json({
    capabilities: [
      // ... other capabilities
      {
        id: 'dev.ocs.payment.web_payments@1.0',
        schemaUrl: 'https://schemas.ocs.dev/payment/web_payments/v1.json',
        metadata: {
          _version: '1.0',
          supportedMethods: ['basic-card', 'https://google.com/pay'],
          merchantName: 'My Store',
          supportedNetworks: ['visa', 'mastercard', 'amex']
        }
      },
      {
        id: 'dev.ocs.payment.spc@1.0',
        schemaUrl: 'https://schemas.ocs.dev/payment/spc/v1.json',
        metadata: {
          _version: '1.0',
          supportedRps: ['bank.example.com'],
          registrationUrl: 'https://bank.example.com/register',
          fallbackMethods: ['otp', 'web_payments']
        }
      }
    ]
  });
});
```

### 3.2 x402 Integration

When payment is required, return a 402 response with payment requirements. Include Web Payments and/or SPC data in the `extra` field:

```javascript
app.post('/orders', async (req, res) => {
  // ... order processing logic

  // If payment required:
  return res.status(402).json({
    x402Version: 1,
    error: "Payment required",
    accepts: [
      {
        scheme: "fiat_intent",
        network: "stripe",
        asset: "USD",
        maxAmountRequired: "2500", // $25.00 in cents
        payTo: "acct_123",
        resource: "/orders",
        description: "Pay with card via Stripe",
        maxTimeoutSeconds: 3600,
        extra: {
          clientSecret: "pi_3abc...", // Stripe PaymentIntent client secret

          // Web Payments data
          webPayments: {
            supportedMethods: [
              {
                supportedMethods: "basic-card",
                data: {
                  supportedNetworks: ["visa", "mastercard", "amex"]
                }
              }
            ],
            displayItems: [
              { label: "Coffee Mug", amount: { currency: "USD", value: "15.00" } },
              { label: "Shipping", amount: { currency: "USD", value: "5.00" } },
              { label: "Tax", amount: { currency: "USD", value: "5.00" } }
            ]
          },

          // SPC data (if user has enrolled credential)
          spc: {
            challenge: base64Encode(randomBytes(32)),
            credentialIds: ["Y3JlZGVudGlhbF9pZF8x"], // Base64-encoded credential IDs
            rpId: "bank.example.com",
            instrument: {
              displayName: "Visa ****1234",
              icon: "https://bank.example.com/card-icon.png"
            }
          }
        }
      }
    ]
  });
});
```

### 3.3 Verifying Payment Credentials

#### Web Payments

When the client retries with `X-PAYMENT`, decode and process the payment details:

```javascript
app.post('/orders', async (req, res) => {
  const paymentHeader = req.headers['x-payment'];

  if (paymentHeader) {
    const paymentData = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());

    if (paymentData.scheme === 'fiat_intent') {
      // Process with your payment provider (e.g., Stripe)
      const result = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method_data: {
            card: paymentData.payload.details.cardNumber,
            // ... other card details
          }
        }
      );

      if (result.success) {
        // Complete order...
        return res.status(201).json(order);
      } else {
        return res.status(402).json({
          code: 'payment_failed',
          message: result.error.message
        });
      }
    }
  }

  // ... rest of order logic
});
```

#### Secure Payment Confirmation

For SPC, verify the WebAuthn assertion:

```javascript
const { verifyAuthenticationResponse } = require('@simplewebauthn/server');

app.post('/orders', async (req, res) => {
  const paymentHeader = req.headers['x-payment'];

  if (paymentHeader) {
    const paymentData = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());

    if (paymentData.payload.assertion) {
      // Verify WebAuthn assertion
      const verification = await verifyAuthenticationResponse({
        response: paymentData.payload.assertion,
        expectedChallenge: storedChallenge, // From 402 response
        expectedOrigin: 'https://shop.example.com',
        expectedRPID: 'bank.example.com',
        authenticator: {
          credentialID: storedCredentialId,
          credentialPublicKey: storedPublicKey,
          counter: storedCounter
        }
      });

      if (verification.verified) {
        // Process payment with verified authentication
        // Complete order...
        return res.status(201).json(order);
      } else {
        return res.status(402).json({
          code: 'payment_auth_failed',
          message: 'Authentication verification failed'
        });
      }
    }
  }
});
```

### 3.4 SPC Registration Support

Provide an endpoint or mechanism for users to register SPC credentials:

```javascript
app.get('/spc-register', (req, res) => {
  // Render page with iframe to RP's registration URL
  res.send(`
    <html>
      <body>
        <h1>Register for Secure Payment</h1>
        <iframe src="https://bank.example.com/register?merchant=mystore.com"
                width="100%" height="600"></iframe>
      </body>
    </html>
  `);
});
```

### 3.5 Error Handling

Use OCS structured errors with `nextActions` for recovery:

```json
{
  "type": "https://schemas.ocs.dev/errors/payment-auth-failed",
  "title": "Payment Authentication Failed",
  "status": 402,
  "detail": "SPC authentication failed",
  "instance": "https://api.example.com/orders/123/payment",
  "timestamp": "2023-10-23T12:00:00Z",
  "localizationKey": "error.payment.auth_failed",
  "nextActions": [
    {
      "id": "retry_with_fallback",
      "href": "/orders",
      "method": "POST",
      "title": "Retry with Fallback Payment"
    }
    {
      "id": "use_manual_entry",
      "href": "/orders",
      "method": "POST"
    }
  ]
}
```

---

## 4. Client-Side Implementation

### 4.1 Discovery

Check server capabilities before attempting to use Web Payments or SPC:

```javascript
// Fetch capabilities
const response = await fetch('/capabilities');
const data = await response.json();

// Check for Web Payments support
const hasWebPayments = data.capabilities.some(
  c => c.id === 'dev.ocs.payment.web_payments@1.0'
);

// Check for SPC support
const hasSPC = data.capabilities.some(
  c => c.id === 'dev.ocs.payment.spc@1.0'
);

// Also check browser support
const browserSupportsWebPayments = 'PaymentRequest' in window;
const browserSupportsSPC = 'PaymentRequest' in window &&
  window.PaymentRequest.prototype.hasOwnProperty('show');
```

### 4.2 Web Payments Flow

```javascript
async function placeOrderWithWebPayments(orderData) {
  // Step 1: Attempt to place order
  const response = await fetch('/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ocs+json; version=1.0',
      'Authorization': 'Bearer ' + token,
      'Idempotency-Key': generateUUID()
    },
    body: JSON.stringify(orderData)
  });

  // Step 2: Handle 402 Payment Required
  if (response.status === 402) {
    const x402Data = await response.json();
    const fiatAccept = x402Data.accepts.find(a => a.scheme === 'fiat_intent');

    if (!fiatAccept || !fiatAccept.extra.webPayments) {
      throw new Error('Web Payments not available');
    }

    // Step 3: Construct PaymentRequest
    const paymentMethods = fiatAccept.extra.webPayments.supportedMethods;
    const paymentDetails = {
      total: {
        label: 'Total',
        amount: {
          currency: fiatAccept.asset,
          value: (parseInt(fiatAccept.maxAmountRequired) / 100).toFixed(2)
        }
      },
      displayItems: fiatAccept.extra.webPayments.displayItems || []
    };

    const request = new PaymentRequest(paymentMethods, paymentDetails);

    // Step 4: Show payment UI
    const paymentResponse = await request.show();

    // Step 5: Construct X-PAYMENT payload
    const paymentPayload = {
      x402Version: 1,
      scheme: 'fiat_intent',
      network: fiatAccept.network,
      payload: {
        methodName: paymentResponse.methodName,
        details: paymentResponse.details
      }
    };

    // Step 6: Retry order with payment
    const retryResponse = await fetch('/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ocs+json; version=1.0',
        'Authorization': 'Bearer ' + token,
        'Idempotency-Key': generateUUID(),
        'X-PAYMENT': btoa(JSON.stringify(paymentPayload))
      },
      body: JSON.stringify(orderData)
    });

    if (retryResponse.ok) {
      await paymentResponse.complete('success');
      return await retryResponse.json();
    } else {
      await paymentResponse.complete('fail');
      throw new Error('Payment failed');
    }
  } else if (response.ok) {
    return await response.json();
  } else {
    throw new Error(`Order failed: ${response.status}`);
  }
}
```

### 4.3 SPC Flow

```javascript
async function placeOrderWithSPC(orderData) {
  // Retrieve stored credential
  const credentialId = localStorage.getItem('spc_credential_id');
  if (!credentialId) {
    throw new Error('No SPC credential found. Register first.');
  }

  // Step 1: Attempt to place order
  const response = await fetch('/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ocs+json; version=1.0',
      'Authorization': 'Bearer ' + token,
      'Idempotency-Key': generateUUID()
    },
    body: JSON.stringify(orderData)
  });

  // Step 2: Handle 402 with SPC
  if (response.status === 402) {
    const x402Data = await response.json();
    const fiatAccept = x402Data.accepts.find(a => a.scheme === 'fiat_intent');

    if (!fiatAccept || !fiatAccept.extra.spc) {
      throw new Error('SPC not available');
    }

    const spcData = fiatAccept.extra.spc;

    // Step 3: Construct SecurePaymentConfirmationRequest
    const paymentRequest = new PaymentRequest(
      [{
        supportedMethods: "secure-payment-confirmation",
        data: {
          action: "payment",
          credentialIds: [base64ToArrayBuffer(credentialId)],
          challenge: base64ToArrayBuffer(spcData.challenge),
          instrument: spcData.instrument,
          timeout: 300000,
          payeeName: "My Shop",
          payeeOrigin: window.location.origin,
          rpId: spcData.rpId
        }
      }],
      {
        total: {
          label: 'Total',
          amount: {
            currency: fiatAccept.asset,
            value: (parseInt(fiatAccept.maxAmountRequired) / 100).toFixed(2)
          }
        }
      }
    );

    // Step 4: Show SPC prompt (biometric authentication)
    const paymentResponse = await paymentRequest.show();

    // Step 5: Construct X-PAYMENT with assertion
    const paymentPayload = {
      x402Version: 1,
      scheme: 'fiat_intent',
      network: fiatAccept.network,
      payload: {
        assertion: {
          id: paymentResponse.details.id,
          rawId: arrayBufferToBase64(paymentResponse.details.rawId),
          response: {
            authenticatorData: arrayBufferToBase64(paymentResponse.details.response.authenticatorData),
            clientDataJSON: arrayBufferToBase64(paymentResponse.details.response.clientDataJSON),
            signature: arrayBufferToBase64(paymentResponse.details.response.signature)
          },
          type: paymentResponse.details.type
        }
      }
    };

    // Step 6: Retry order with SPC assertion
    const retryResponse = await fetch('/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ocs+json; version=1.0',
        'Authorization': 'Bearer ' + token,
        'Idempotency-Key': generateUUID(),
        'X-PAYMENT': btoa(JSON.stringify(paymentPayload))
      },
      body: JSON.stringify(orderData)
    });

    if (retryResponse.ok) {
      await paymentResponse.complete('success');
      return await retryResponse.json();
    } else {
      await paymentResponse.complete('fail');
      throw new Error('Payment failed');
    }
  }
}

// Utility functions
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

### 4.4 Handling Mixed Flows

For orders with physical items, collect shipping address:

```javascript
const paymentOptions = {
  requestShipping: true,
  shippingOptions: [
    {
      id: 'standard',
      label: 'Standard Shipping',
      amount: { currency: 'USD', value: '5.00' }
    }
  ]
};

const request = new PaymentRequest(
  paymentMethods,
  paymentDetails,
  paymentOptions
);

const response = await request.show();
const shippingAddress = response.shippingAddress;
```

---

## 5. Registration Flows for SPC

### 5.1 Direct Registration on RP Site

Users can register directly with their bank/issuer:

1. Navigate to bank's website
2. Complete WebAuthn registration
3. Bank stores public key and credential ID
4. User's credential is now available for SPC on any merchant site

### 5.2 Registration via Merchant Site (Iframe)

Merchants can embed RP registration:

```html
<iframe
  src="https://bank.example.com/register-spc?merchant=mystore.com&return=https://mystore.com/spc-complete"
  width="100%"
  height="600"
  allow="publickey-credentials-create"
></iframe>
```

Post-registration:
- RP returns credentialId via postMessage or redirect
- Client stores credentialId locally (IndexedDB/localStorage)
- Future orders use this credentialId for SPC

---

## 6. Error Handling and Fallbacks

### 6.1 Common Errors

**Web Payments:**
- `AbortError`: User cancelled payment sheet
- `NotSupportedError`: Payment method not available
- `SecurityError`: HTTPS required

**SPC:**
- `NotAllowedError`: User denied biometric prompt
- `OptOutError`: User opted out of SPC (clear credentials)
- `InvalidStateError`: Credential not found

### 6.2 Fallback Strategy

```javascript
async function placeOrderWithPayment(orderData) {
  // Try SPC first (best UX + security)
  if (hasSPC && browserSupportsSPC) {
    try {
      return await placeOrderWithSPC(orderData);
    } catch (error) {
      console.warn('SPC failed, trying Web Payments', error);
    }
  }

  // Try Web Payments
  if (hasWebPayments && browserSupportsWebPayments) {
    try {
      return await placeOrderWithWebPayments(orderData);
    } catch (error) {
      console.warn('Web Payments failed, using manual entry', error);
    }
  }

  // Fallback to manual card entry or other methods
  return await placeOrderWithManualEntry(orderData);
}
```

### 6.3 OCS Error Integration

Map API errors to OCS structured errors:

```javascript
try {
  const response = await request.show();
} catch (error) {
  if (error.name === 'AbortError') {
    throw {
      code: 'payment_cancelled',
      message: 'User cancelled payment',
      userMessage: {
        localizationKey: 'error.payment.cancelled'
      },
      nextActions: [
        { id: 'retry', href: '/orders', method: 'POST' },
        { id: 'use_different_method', href: '/orders', method: 'POST' }
      ]
    };
  }
}
```

---

## 7. Security Considerations

### 7.1 PCI Compliance

- **Never handle raw card data**: Web Payments provides tokenized credentials
- **Use HTTPS exclusively**: Both APIs require secure contexts
- **Validate on server**: Client-side data must be verified server-side

### 7.2 Phishing Resistance (SPC)

- SPC binds authentication to origin and RP
- Phishing sites cannot replay assertions
- Always verify `rpId` matches expected value

### 7.3 Privacy

- **Honor opt-outs**: If user opts out of SPC, clear all stored credentials
- **Minimal data collection**: Only request necessary fields
- **Secure storage**: Store credentialIds encrypted in client storage

### 7.4 Rate Limiting

Enforce rate limits on payment attempts:

```javascript
// Advertise via capability
{
  "id": "dev.ocs.server.rate_limits@1.0",
  "metadata": {
    "payment_attempts": {
      "limit": 5,
      "window": 3600,
      "unit": "attempts per hour"
    }
  }
}
```

---

## 8. Testing and Compatibility

### 8.1 Browser Support (October 2025)

| Feature | Chrome | Edge | Safari | Firefox |
|---------|--------|------|--------|---------|
| Payment Request API | ✅ | ✅ | ⚠️ Partial | ❌ |
| SPC | ✅ (macOS, Windows, Android) | ✅ | ❌ | ❌ |
| WebAuthn | ✅ | ✅ | ✅ | ✅ |

**Note:** Always check current support at [caniuse.com](https://caniuse.com)

### 8.2 Testing Tools

- **Chrome DevTools**: Payment Handler debugger
- **WebAuthn Playground**: [webauthn.io](https://webauthn.io)
- **W3C Test Suites**: Official conformance tests
- **Origin Trials**: Test experimental features

### 8.3 Test Checklist

**Web Payments:**
- [ ] Basic card flow with test card numbers
- [ ] Apple Pay/Google Pay (if configured)
- [ ] Shipping address collection
- [ ] Mixed currency handling
- [ ] Error scenarios (declined cards, network errors)

**SPC:**
- [ ] Registration flow
- [ ] Biometric authentication
- [ ] Credential storage/retrieval
- [ ] Challenge verification
- [ ] Opt-out handling
- [ ] Fallback when credential missing

**OCS Integration:**
- [ ] Capability discovery
- [ ] 402 response structure
- [ ] X-PAYMENT payload format
- [ ] Idempotency
- [ ] Error handling with nextActions

---

## 9. Future Updates

### 9.1 Monitoring Standards

- **W3C Web Payments WG**: Charter extended to 2027
- **SPC GitHub Issues**: Track implementation progress
- **Browser Release Notes**: Watch for new features

### 9.2 Potential Enhancements

- **Web3 Integration**: SPC with crypto wallets if standardized
- **Cross-browser Support**: Safari/Firefox SPC support
- **Enhanced Biometrics**: Additional authenticator types
- **Delegated Authentication**: Third-party payment apps

### 9.3 Contributing to OCS

To propose changes or new payment capabilities:

1. Open issue on [OCS GitHub](https://github.com/anthropics/open-commerce-standard)
2. Provide use cases and schema proposals
3. Follow OCS contribution guidelines
4. Participate in community discussions

---

## Quick Reference

### Capability IDs

- `dev.ocs.payment.web_payments@1.0`: Web Payments support
- `dev.ocs.payment.spc@1.0`: Secure Payment Confirmation support

### Key Headers

- `X-PAYMENT`: Base64-encoded payment payload (client → server)
- `X-PAYMENT-RESPONSE`: Base64-encoded settlement response (server → client)
- `Idempotency-Key`: Required for all state-changing operations

### Schema Locations

- Web Payments: `schemas/payment/web_payments/v1.json`
- SPC: `schemas/payment/spc/v1.json`

### Example Files

- HTML Demo: `examples/web-payments-spc-example.html`
- Server: `examples/simple-server.js` (see capabilities endpoint)

---

## Support

For questions or issues:

- **OCS Documentation**: [docs/](../docs/)
- **GitHub Issues**: [OCS Repository Issues](https://github.com/anthropics/open-commerce-standard/issues)
- **W3C Specifications**: [Payment Request](https://www.w3.org/TR/payment-request/), [SPC](https://www.w3.org/TR/secure-payment-confirmation/)

---

**Last Updated:** October 23, 2025
**Version:** 1.0
**License:** MIT
