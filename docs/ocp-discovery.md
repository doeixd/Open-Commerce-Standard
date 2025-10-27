# OCP Discovery Specification

**Version:** Draft 1.0
**Status:** Proposal
**Last Updated:** October 2025

This document defines how OCP-compatible servers advertise the location and metadata of their capabilities to clients.
Discovery can occur through four complementary mechanisms:

1. HTML `<meta>` tags
2. JSON-LD blocks
3. `.well-known/ocp` endpoint
4. HTTP response headers

These layers are intentionally redundant so that discovery succeeds whether a client begins with an HTML page, an API call, or a raw domain.

---

## 1. Design Goals

- Universal, zero-configuration detection of OCP APIs.
- Works with existing web infrastructure and caching.
- Machine-readable and human-friendly.
- Hierarchical and deterministic: clients know which source of truth to trust.

---

## 2. Metadata Vocabulary

All mechanisms share the same core keys:

| Key | Description | Example |
|-----|--------------|----------|
| `OCP:capabilities` | URI of the `/capabilities` resource. | `https://example.com/OCP/capabilities` |
| `OCP:version` | Highest supported OCP core version. | `"1.0"` |
| `OCP:context` | JSON-LD context URI. | `https://schemas.OCP.dev/context.jsonld` |
| `OCP:payment` | URI of a payment or x402 endpoint. | `https://example.com/OCP/payment` |

Additional fields MAY be defined in future capability revisions.

---

## 3. Discovery Mechanisms

### 3.1 HTML Meta Tags

```html
<meta name="OCP:capabilities" content="https://example.com/OCP/capabilities">
<meta name="OCP:version" content="1.0">
<meta name="OCP:context" content="https://schemas.OCP.dev/context.jsonld">
```

**Use:** lightweight, public hint for browsers, extensions, and scrapers.
**Scope:** page-level; multiple pages MAY reuse the same values.

---

### 3.2 JSON-LD Block

```html
<script type="application/ld+json">
{
  "@context": "https://schemas.OCP.dev/context.jsonld",
  "@type": "OCP:EntryPoint",
  "OCP:capabilities": "https://example.com/OCP/capabilities",
  "OCP:version": "1.0",
  "OCP:payment": "https://example.com/OCP/payment"
}
</script>
```

**Use:** semantic-web agents, search engines, AI crawlers.
**Scope:** page-level, machine-interpretable via JSON-LD.

---

### 3.3 `.well-known/ocp`

**Endpoint:**

```
GET https://example.com/.well-known/ocp
```

**Response:**

```json
{
  "OCP": {
    "capabilities": "https://example.com/OCP/capabilities",
    "version": "1.0",
    "context": "https://schemas.OCP.dev/context.jsonld",
    "payment": "https://example.com/OCP/payment"
  }
}
```

**Use:** primary machine-level bootstrap for SDKs and crawlers.
**Scope:** domain-level; one per host.

---

### 3.4 HTTP Header

Any HTTP response (HTML or API) MAY include an **OCP-Discovery** header:

```
OCP-Discovery: capabilities=https://example.com/OCP/capabilities;version=1.0;context=https://schemas.OCP.dev/context.jsonld;payment=https://example.com/OCP/payment
```

* Values are semicolon-separated key=URI or literal pairs.
* Servers SHOULD include this header on root (`/`) and `/OCP` responses.
* Clients MAY follow relative URIs against the response's base URL.

**Use:** fastest path for clients that already perform a HEAD/GET request.
**Scope:** response-level.

---

## 4. Discovery Hierarchy & Precedence

When multiple sources provide conflicting or overlapping metadata, clients MUST resolve them in the following order of authority:

| Priority | Source                      | Rationale                                        |
| -------- | --------------------------- | ------------------------------------------------ |
| **1**    | `.well-known/ocp`           | Canonical, domain-level source of truth.         |
| **2**    | `OCP-Discovery` HTTP header | High confidence, attached to API responses.      |
| **3**    | JSON-LD block               | Structured and machine-readable but page-scoped. |
| **4**    | HTML meta tags              | Lowest confidence; human-facing hint.            |

Clients SHOULD cache the highest-priority successful discovery result and MAY periodically revalidate using `ETag` or `max-age`.

---

## 5. Client Discovery Algorithm

1. **Attempt** `GET /.well-known/ocp`
   * If `200 OK` and valid JSON → use it.
2. **Else**, send a **HEAD** request to `/` and inspect `OCP-Discovery` header.
3. **Else**, fetch `/` HTML and search for JSON-LD or `<meta>` tags.
4. **Else**, try the conventional fallback `GET /OCP/capabilities`.
5. **Verify** the endpoint responds with `Content-Type: application/ocp+json`.
6. **Cache** and proceed to capability negotiation.

---

## 6. Context Vocabulary Extension

Update `https://schemas.OCP.dev/context.jsonld` to include:

```json
{
  "@context": {
    "OCP": "https://schemas.OCP.dev/vocab#",
    "OCP:EntryPoint": "OCP:EntryPoint",
    "OCP:capabilities": { "@id": "OCP:capabilities", "@type": "@id" },
    "OCP:version": "OCP:version",
    "OCP:context": { "@id": "OCP:context", "@type": "@id" },
    "OCP:payment": { "@id": "OCP:payment", "@type": "@id" }
  }
}
```

---

## 7. Example Combined Implementation

**Root HTML page**

```html
<head>
  <meta name="OCP:capabilities" content="https://shop.example.com/OCP/capabilities">
  <meta name="OCP:version" content="1.0">
  <script type="application/ld+json">
  {
    "@context": "https://schemas.OCP.dev/context.jsonld",
    "@type": "OCP:EntryPoint",
    "OCP:capabilities": "https://shop.example.com/OCP/capabilities",
    "OCP:version": "1.0"
  }
  </script>
</head>
```

**HTTP headers**

```
OCP-Discovery: capabilities=https://shop.example.com/OCP/capabilities;version=1.0
Link: <https://shop.example.com/.well-known/ocp>; rel="service-meta"
```

**.well-known/ocp**

```json
{
  "OCP": {
    "capabilities": "https://shop.example.com/OCP/capabilities",
    "version": "1.0"
  }
}
```

---

## 8. Security & Caching Considerations

* Clients MUST honor HTTPS; plain HTTP discovery is discouraged.
* Servers SHOULD set `Cache-Control: max-age=86400` or similar for `.well-known/ocp`.
* CORS: `.well-known/ocp` SHOULD include `Access-Control-Allow-Origin: *`.
* Spoofing: clients SHOULD verify that discovered URLs share the same origin as the discovery source unless explicitly trusted.

---

## 9. Capability Registration

The following capability formalizes this feature:

```json
{
  "id": "dev.ocp.discovery@1.0",
  "title": "OCP Discovery Capability",
  "description": "Defines standardized discovery metadata for OCP endpoints via HTML, JSON-LD, HTTP headers, and .well-known URLs.",
  "schemaUrl": "https://schemas.OCP.dev/capabilities/discovery/v1.json"
}
```

---

## 10. Future Work

* Signature and verification of `.well-known/ocp` documents (for federated trust).
* Browser extension or user-agent discovery API.
* Integration with the OCP capability registry for automatic verification.

---

**In summary:**

The four discovery channels—HTML meta, JSON-LD, `.well-known/ocp`, and HTTP headers—form a unified hierarchy that lets both humans and machines locate OCP endpoints reliably. `.well-known/ocp` is authoritative; others are hints or fallbacks. This makes OCP discoverable from any entry point on the modern web.
