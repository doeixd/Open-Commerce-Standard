# OCS Discovery Specification

**Version:** Draft 1.0
**Status:** Proposal
**Last Updated:** October 2025

This document defines how OCS-compatible servers advertise the location and metadata of their capabilities to clients.
Discovery can occur through four complementary mechanisms:

1. HTML `<meta>` tags
2. JSON-LD blocks
3. `.well-known/ocs` endpoint
4. HTTP response headers

These layers are intentionally redundant so that discovery succeeds whether a client begins with an HTML page, an API call, or a raw domain.

---

## 1. Design Goals

- Universal, zero-configuration detection of OCS APIs.
- Works with existing web infrastructure and caching.
- Machine-readable and human-friendly.
- Hierarchical and deterministic: clients know which source of truth to trust.

---

## 2. Metadata Vocabulary

All mechanisms share the same core keys:

| Key | Description | Example |
|-----|--------------|----------|
| `ocs:capabilities` | URI of the `/capabilities` resource. | `https://example.com/ocs/capabilities` |
| `ocs:version` | Highest supported OCS core version. | `"1.0"` |
| `ocs:context` | JSON-LD context URI. | `https://schemas.ocs.dev/context.jsonld` |
| `ocs:payment` | URI of a payment or x402 endpoint. | `https://example.com/ocs/payment` |

Additional fields MAY be defined in future capability revisions.

---

## 3. Discovery Mechanisms

### 3.1 HTML Meta Tags

```html
<meta name="ocs:capabilities" content="https://example.com/ocs/capabilities">
<meta name="ocs:version" content="1.0">
<meta name="ocs:context" content="https://schemas.ocs.dev/context.jsonld">
```

**Use:** lightweight, public hint for browsers, extensions, and scrapers.
**Scope:** page-level; multiple pages MAY reuse the same values.

---

### 3.2 JSON-LD Block

```html
<script type="application/ld+json">
{
  "@context": "https://schemas.ocs.dev/context.jsonld",
  "@type": "ocs:EntryPoint",
  "ocs:capabilities": "https://example.com/ocs/capabilities",
  "ocs:version": "1.0",
  "ocs:payment": "https://example.com/ocs/payment"
}
</script>
```

**Use:** semantic-web agents, search engines, AI crawlers.
**Scope:** page-level, machine-interpretable via JSON-LD.

---

### 3.3 `.well-known/ocs`

**Endpoint:**

```
GET https://example.com/.well-known/ocs
```

**Response:**

```json
{
  "ocs": {
    "capabilities": "https://example.com/ocs/capabilities",
    "version": "1.0",
    "context": "https://schemas.ocs.dev/context.jsonld",
    "payment": "https://example.com/ocs/payment"
  }
}
```

**Use:** primary machine-level bootstrap for SDKs and crawlers.
**Scope:** domain-level; one per host.

---

### 3.4 HTTP Header

Any HTTP response (HTML or API) MAY include an **OCS-Discovery** header:

```
OCS-Discovery: capabilities=https://example.com/ocs/capabilities;version=1.0;context=https://schemas.ocs.dev/context.jsonld;payment=https://example.com/ocs/payment
```

* Values are semicolon-separated key=URI or literal pairs.
* Servers SHOULD include this header on root (`/`) and `/ocs` responses.
* Clients MAY follow relative URIs against the response's base URL.

**Use:** fastest path for clients that already perform a HEAD/GET request.
**Scope:** response-level.

---

## 4. Discovery Hierarchy & Precedence

When multiple sources provide conflicting or overlapping metadata, clients MUST resolve them in the following order of authority:

| Priority | Source                      | Rationale                                        |
| -------- | --------------------------- | ------------------------------------------------ |
| **1**    | `.well-known/ocs`           | Canonical, domain-level source of truth.         |
| **2**    | `OCS-Discovery` HTTP header | High confidence, attached to API responses.      |
| **3**    | JSON-LD block               | Structured and machine-readable but page-scoped. |
| **4**    | HTML meta tags              | Lowest confidence; human-facing hint.            |

Clients SHOULD cache the highest-priority successful discovery result and MAY periodically revalidate using `ETag` or `max-age`.

---

## 5. Client Discovery Algorithm

1. **Attempt** `GET /.well-known/ocs`
   * If `200 OK` and valid JSON → use it.
2. **Else**, send a **HEAD** request to `/` and inspect `OCS-Discovery` header.
3. **Else**, fetch `/` HTML and search for JSON-LD or `<meta>` tags.
4. **Else**, try the conventional fallback `GET /ocs/capabilities`.
5. **Verify** the endpoint responds with `Content-Type: application/ocs+json`.
6. **Cache** and proceed to capability negotiation.

---

## 6. Context Vocabulary Extension

Update `https://schemas.ocs.dev/context.jsonld` to include:

```json
{
  "@context": {
    "ocs": "https://schemas.ocs.dev/vocab#",
    "ocs:EntryPoint": "ocs:EntryPoint",
    "ocs:capabilities": { "@id": "ocs:capabilities", "@type": "@id" },
    "ocs:version": "ocs:version",
    "ocs:context": { "@id": "ocs:context", "@type": "@id" },
    "ocs:payment": { "@id": "ocs:payment", "@type": "@id" }
  }
}
```

---

## 7. Example Combined Implementation

**Root HTML page**

```html
<head>
  <meta name="ocs:capabilities" content="https://shop.example.com/ocs/capabilities">
  <meta name="ocs:version" content="1.0">
  <script type="application/ld+json">
  {
    "@context": "https://schemas.ocs.dev/context.jsonld",
    "@type": "ocs:EntryPoint",
    "ocs:capabilities": "https://shop.example.com/ocs/capabilities",
    "ocs:version": "1.0"
  }
  </script>
</head>
```

**HTTP headers**

```
OCS-Discovery: capabilities=https://shop.example.com/ocs/capabilities;version=1.0
Link: <https://shop.example.com/.well-known/ocs>; rel="service-meta"
```

**.well-known/ocs**

```json
{
  "ocs": {
    "capabilities": "https://shop.example.com/ocs/capabilities",
    "version": "1.0"
  }
}
```

---

## 8. Security & Caching Considerations

* Clients MUST honor HTTPS; plain HTTP discovery is discouraged.
* Servers SHOULD set `Cache-Control: max-age=86400` or similar for `.well-known/ocs`.
* CORS: `.well-known/ocs` SHOULD include `Access-Control-Allow-Origin: *`.
* Spoofing: clients SHOULD verify that discovered URLs share the same origin as the discovery source unless explicitly trusted.

---

## 9. Capability Registration

The following capability formalizes this feature:

```json
{
  "id": "dev.ocs.discovery@1.0",
  "title": "OCS Discovery Capability",
  "description": "Defines standardized discovery metadata for OCS endpoints via HTML, JSON-LD, HTTP headers, and .well-known URLs.",
  "schemaUrl": "https://schemas.ocs.dev/capabilities/discovery/v1.json"
}
```

---

## 10. Future Work

* Signature and verification of `.well-known/ocs` documents (for federated trust).
* Browser extension or user-agent discovery API.
* Integration with the OCS capability registry for automatic verification.

---

**In summary:**

The four discovery channels—HTML meta, JSON-LD, `.well-known/ocs`, and HTTP headers—form a unified hierarchy that lets both humans and machines locate OCS endpoints reliably. `.well-known/ocs` is authoritative; others are hints or fallbacks. This makes OCS discoverable from any entry point on the modern web.
