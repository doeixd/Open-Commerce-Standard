# OCP Capability Versioning Guide

This document defines the versioning strategy for Open Commerce Protocol (OCP) capabilities, ensuring backward compatibility and smooth evolution of the standard.

## Table of Contents

- [Version Format](#version-format)
- [Version Change Rules](#version-change-rules)
- [Multi-Version Support](#multi-version-support)
- [Client Negotiation](#client-negotiation)
- [Server Response Versioning](#server-response-versioning)
- [Deprecation Policy](#deprecation-policy)
- [Migration Examples](#migration-examples)

## Version Format

OCP capabilities use semantic versioning with a `major.minor` format:

```
dev.ocp.{domain}.{feature}@{major}.{minor}
```

**Examples:**
- `dev.ocp.product.variants@1.0`
- `dev.ocp.product.variants@1.1`
- `dev.ocp.product.variants@2.0`

**Version Components:**
- **Major version**: Breaking changes that require client updates
- **Minor version**: Backward-compatible additions and enhancements

## Version Change Rules

### MINOR Version Changes (`1.0` → `1.1`)

**Backward-compatible changes only:**

✅ **Allowed:**
- Adding optional fields to metadata schemas
- Adding new enum values (if clients are tolerant of unknown values)
- Expanding endpoint capabilities without changing existing behavior
- Clarifying or improving documentation
- Adding new optional endpoints

❌ **Not Allowed:**
- Removing fields
- Changing field types
- Making optional fields required
- Changing field semantics
- Removing enum values

**Example:**

```json
// v1.0
{
  "options": ["Size", "Color"],
  "variants": [
    { "id": "var_1", "values": ["Large", "Blue"] }
  ]
}

// v1.1 (adds optional field)
{
  "options": ["Size", "Color"],
  "variants": [
    { "id": "var_1", "values": ["Large", "Blue"] }
  ],
  "defaultVariantId": "var_medium_blue"  // New optional field
}
```

**Client Compatibility:** Clients using v1.0 can safely ignore unknown fields and continue to function correctly.

### MAJOR Version Changes (`1.x` → `2.0`)

**Breaking changes allowed:**

✅ **Allowed:**
- Removing or renaming fields
- Changing field types
- Changing required/optional status
- Restructuring schema
- Changing endpoint behavior
- Removing endpoints

**Example:**

```json
// v1.0
{
  "options": ["Size", "Color"],
  "variants": [
    { "id": "var_1", "values": ["Large", "Blue"] }
  ]
}

// v2.0 (completely restructured)
{
  "attributes": [
    { "name": "Size", "type": "single_select", "values": ["S", "M", "L"] },
    { "name": "Color", "type": "single_select", "values": ["Blue", "Red"] }
  ],
  "skus": [
    { "id": "var_1", "selections": { "Size": "L", "Color": "Blue" } }
  ]
}
```

**Client Impact:** Clients using v1.x will NOT work with v2.0 without code changes.

## Multi-Version Support

Servers MAY advertise multiple versions of the same capability simultaneously:

```json
{
  "capabilities": [
    {
      "id": "dev.ocp.product.variants@1.0",
      "schemaUrl": "https://schemas.OCP.dev/product/variants/v1.json",
      "status": "deprecated",
      "sunset": "2026-06-01",
      "migrationGuide": "https://docs.OCP.dev/migrations/variants-v1-to-v2"
    },
    {
      "id": "dev.ocp.product.variants@2.0",
      "schemaUrl": "https://schemas.OCP.dev/product/variants/v2.json",
      "status": "stable"
    }
  ]
}
```

**Benefits:**
- Clients can upgrade at their own pace
- Servers can support legacy clients during transition periods
- Gradual migration reduces risk

## Client Negotiation

Clients specify preferred capability versions via the `Accept-OCP-Capabilities` header:

```http
GET /catalogs/123
Accept: application/ocp+json; version=1.0
Accept-OCP-Capabilities: dev.ocp.product.variants@1.0, dev.ocp.order.tracking@2.1
```

**Header Format:**
- Comma-separated list of capability IDs with versions
- If header is omitted, server uses latest stable version
- If requested version is unavailable, server returns latest compatible version

**Client Behavior:**
```javascript
// Client specifies preferred versions
const headers = {
  'Accept': 'application/ocp+json; version=1.0',
  'Accept-OCP-Capabilities': 'dev.ocp.product.variants@1.0'
};

const response = await fetch('/catalogs/123', { headers });
const catalog = await response.json();

// Check which version was actually used
const variantsMetadata = catalog.metadata['dev.ocp.product.variants@1.0'];
if (variantsMetadata) {
  // Server returned v1.0 format
} else if (catalog.metadata['dev.ocp.product.variants@2.0']) {
  // Server only supports v2.0, client needs to adapt
}
```

## Server Response Versioning

The metadata key ALWAYS includes the version actually used by the server:

```json
{
  "id": "prod_123",
  "name": "Blue T-Shirt",
  "metadata": {
    "dev.ocp.product.variants@1.0": {
      "options": ["Size", "Color"],
      "variants": [...]
    }
  }
}
```

**Key Points:**
- Metadata keys include full version (e.g., `@1.0`, `@2.0`)
- Clients MUST check the version in the metadata key
- Servers MUST NOT mix versions in a single response (one version per capability)

## Deprecation Policy

When deprecating a capability version, servers MUST:

1. **Provide minimum 12 months notice**
2. **Add sunset date to capability**
3. **Add `Sunset` HTTP header to responses using deprecated version**
4. **Provide migration guide at documented URL**
5. **Support old version until sunset date**

### Deprecation Response Headers

```http
HTTP/1.1 200 OK
Sunset: Sat, 01 Jun 2026 00:00:00 GMT
Deprecation: true
Link: <https://docs.OCP.dev/migrations/variants-v1-to-v2>; rel="deprecation"
Content-Type: application/ocp+json; version=1.0
```

### Capability Status Lifecycle

```
beta → stable → deprecated → removed
```

**Status Meanings:**
- **beta**: Experimental, may change without notice, NOT for production
- **stable**: Production-ready, follows versioning policy
- **deprecated**: Still supported but scheduled for removal (check `sunset` field)

## Migration Examples

### Example 1: Minor Version Update (Safe)

**Scenario:** Server adds optional `defaultVariantId` field to product variants capability.

**Server Timeline:**
1. **2025-01-01**: Release v1.1 with new optional field
2. Both v1.0 and v1.1 clients work without changes

```json
// Capability announcement
{
  "id": "dev.ocp.product.variants@1.1",
  "schemaUrl": "https://schemas.OCP.dev/product/variants/v1.1.json",
  "status": "stable"
}

// Response includes new field
{
  "metadata": {
    "dev.ocp.product.variants@1.1": {
      "options": ["Size", "Color"],
      "variants": [...],
      "defaultVariantId": "var_medium_blue"  // New field
    }
  }
}
```

**Client Impact:** None. v1.0 clients ignore the new field and continue working.

### Example 2: Major Version Update (Breaking Change)

**Scenario:** Server introduces breaking change in variants schema structure.

**Server Timeline:**

**Step 1: Announce v2.0 (2025-01-01)**

```json
{
  "capabilities": [
    {
      "id": "dev.ocp.product.variants@1.0",
      "status": "stable"
    },
    {
      "id": "dev.ocp.product.variants@2.0",
      "status": "beta",
      "migrationGuide": "https://docs.OCP.dev/migrations/variants-v1-to-v2"
    }
  ]
}
```

**Step 2: Stabilize v2.0 and deprecate v1.0 (2025-06-01)**

```json
{
  "capabilities": [
    {
      "id": "dev.ocp.product.variants@1.0",
      "status": "deprecated",
      "sunset": "2026-06-01",
      "migrationGuide": "https://docs.OCP.dev/migrations/variants-v1-to-v2"
    },
    {
      "id": "dev.ocp.product.variants@2.0",
      "status": "stable"
    }
  ]
}
```

**Step 3: Remove v1.0 (2026-06-01)**

```json
{
  "capabilities": [
    {
      "id": "dev.ocp.product.variants@2.0",
      "status": "stable"
    }
  ]
}
```

**Client Migration Path:**

```javascript
// Phase 1: Detect available versions
const capabilities = await fetch('/capabilities').then(r => r.json());
const v1 = capabilities.capabilities.find(c => c.id === 'dev.ocp.product.variants@1.0');
const v2 = capabilities.capabilities.find(c => c.id === 'dev.ocp.product.variants@2.0');

if (v1?.status === 'deprecated') {
  console.warn(`v1.0 will be removed on ${v1.sunset}. Migration guide: ${v1.migrationGuide}`);
}

// Phase 2: Update client to support both versions
function parseVariants(metadata) {
  if (metadata['dev.ocp.product.variants@2.0']) {
    return parseVariantsV2(metadata['dev.ocp.product.variants@2.0']);
  } else if (metadata['dev.ocp.product.variants@1.0']) {
    return parseVariantsV1(metadata['dev.ocp.product.variants@1.0']);
  }
  throw new Error('Variants not supported');
}

// Phase 3: After all servers support v2.0, remove v1.0 parsing
function parseVariants(metadata) {
  return parseVariantsV2(metadata['dev.ocp.product.variants@2.0']);
}
```

### Example 3: Handling Multiple Major Versions

**Scenario:** Client supports both v1.x and v2.x, server only supports v2.x

```javascript
// Client specifies it can handle v1.0
const headers = {
  'Accept-OCP-Capabilities': 'dev.ocp.product.variants@1.0'
};

const response = await fetch('/catalogs/123', { headers });
const catalog = await response.json();

// Server returns v2.0 (only version it supports)
if (catalog.metadata['dev.ocp.product.variants@2.0']) {
  // Client's v1.0 parser won't work - need to upgrade client
  if (canHandleV2()) {
    parseVariantsV2(catalog.metadata['dev.ocp.product.variants@2.0']);
  } else {
    // Fallback or error
    console.error('Server no longer supports v1.0. Please update client.');
  }
}
```

## Best Practices

### For Server Implementers

1. **Default to Stability**: Ship capabilities as `stable` only after thorough testing
2. **Use Beta Wisely**: Mark experimental features as `beta` to signal instability
3. **Plan Ahead**: Design schemas with extensibility in mind to minimize breaking changes
4. **Communicate Early**: Announce deprecations well in advance (12+ months minimum)
5. **Provide Migration Tools**: Offer scripts, documentation, and support for migrations
6. **Support Multiple Versions**: Run v1.x and v2.x in parallel during transition periods

### For Client Implementers

1. **Check Capabilities**: Always fetch `/capabilities` to discover available versions
2. **Handle Unknown Fields**: Ignore unknown fields gracefully for forward compatibility
3. **Specify Preferences**: Use `Accept-OCP-Capabilities` header to request specific versions
4. **Check Response Versions**: Verify which version was actually returned in metadata keys
5. **Monitor Deprecations**: Watch for `status: deprecated` and `sunset` dates
6. **Plan Upgrades**: Update client code before sunset dates to avoid breakage

## Frequently Asked Questions

### Q: Can I skip minor versions?
**A:** Yes. All minor versions within the same major version are backward-compatible, so you can jump from 1.0 → 1.5 safely.

### Q: What if a server only supports v2.0 but my client only supports v1.0?
**A:** The server will return v2.0 data. Your client will likely fail to parse it. You need to update your client to support v2.0.

### Q: Can I request multiple versions of the same capability?
**A:** No. The server will return exactly one version per capability. Specify your preferred version, and the server will return the closest compatible version it supports.

### Q: How do I know which version a server returned?
**A:** Check the metadata key in the response. It always includes the version (e.g., `dev.ocp.product.variants@2.0`).

### Q: What happens if I don't send `Accept-OCP-Capabilities` header?
**A:** The server will use the latest stable version of each capability by default.

### Q: Can minor versions add required fields?
**A:** No. Adding required fields is a breaking change and requires a major version bump.

---

**Document Version:** 1.0
**Last Updated:** 2025-10-22
**Maintainer:** Open Commerce Protocol Working Group
