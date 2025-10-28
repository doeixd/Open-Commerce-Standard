// OCP Metadata Processing Middleware - Reference Implementation
// Open Commerce Protocol v1.0.0-rc.1

import type { MiddlewareHandler } from 'hono';

/**
 * Middleware for processing and validating capability-specific metadata
 */
export function createMetadataMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const { capabilityRegistry } = c.var.ocp;

    // Store original request/response processing functions
    const originalJson = c.json.bind(c);

    // Override c.json to process metadata in responses
    c.json = (object: any, ...args: any[]) => {
      const processedObject = processResponseMetadata(object, capabilityRegistry);
      return originalJson(processedObject, ...args);
    };

    // Process request metadata if present
    if (c.req.method === 'POST' || c.req.method === 'PUT' || c.req.method === 'PATCH') {
      try {
        const contentType = c.req.header('Content-Type');
        if (contentType?.includes('application/json') || contentType?.includes('application/ocp+json')) {
          const body = await c.req.json().catch(() => null);
          if (body && body.metadata) {
            const processedBody = processRequestMetadata(body, capabilityRegistry);
            // Replace the request body with processed version
            c.req.raw = new Request(c.req.raw.url, {
              ...c.req.raw,
              body: JSON.stringify(processedBody),
              headers: {
                ...Object.fromEntries(c.req.raw.headers),
                'Content-Type': 'application/json',
              },
            });
          }
        }
      } catch (error) {
        // If metadata processing fails, continue with original request
        console.warn('Failed to process request metadata:', error);
      }
    }

    await next();
  };
}

/**
 * Process metadata in request bodies
 */
function processRequestMetadata(body: any, capabilityRegistry: any): any {
  if (!body.metadata || typeof body.metadata !== 'object') {
    return body;
  }

  const processedMetadata: Record<string, any> = {};

  for (const [key, value] of Object.entries(body.metadata)) {
    // Extract capability ID from metadata key (e.g., "dev.ocp.product.variants@1.0" -> "dev.ocp.product.variants")
    const capabilityId = key.split('@')[0];

    // Validate metadata if capability is registered
    if (capabilityRegistry.isEnabled(capabilityId)) {
      if (capabilityRegistry.validateMetadata(capabilityId, value)) {
        processedMetadata[key] = capabilityRegistry.processMetadata(capabilityId, value);
      } else {
        console.warn(`Invalid metadata for capability ${capabilityId}, skipping`);
        // Skip invalid metadata
      }
    } else {
      // Include metadata for disabled capabilities as-is
      processedMetadata[key] = value;
    }
  }

  return {
    ...body,
    metadata: processedMetadata,
  };
}

/**
 * Process metadata in response bodies
 */
function processResponseMetadata(object: any, capabilityRegistry: any): any {
  if (!object || typeof object !== 'object') {
    return object;
  }

  // Process single object
  if (object.metadata) {
    return {
      ...object,
      metadata: processObjectMetadata(object.metadata, capabilityRegistry),
    };
  }

  // Process arrays of objects (like catalogs, orders, etc.)
  if (Array.isArray(object)) {
    return object.map(item => {
      if (item && typeof item === 'object' && item.metadata) {
        return {
          ...item,
          metadata: processObjectMetadata(item.metadata, capabilityRegistry),
        };
      }
      return item;
    });
  }

  // Process paginated responses
  if (object.stores || object.catalogs || object.orders || object.subscriptions) {
    const key = Object.keys(object).find(k => Array.isArray(object[k]));
    if (key) {
      return {
        ...object,
        [key]: object[key].map((item: any) => {
          if (item && typeof item === 'object' && item.metadata) {
            return {
              ...item,
              metadata: processObjectMetadata(item.metadata, capabilityRegistry),
            };
          }
          return item;
        }),
      };
    }
  }

  return object;
}

/**
 * Process metadata object for a single item
 */
function processObjectMetadata(metadata: Record<string, any>, capabilityRegistry: any): Record<string, any> {
  const processedMetadata: Record<string, any> = {};

  for (const [key, value] of Object.entries(metadata)) {
    // Extract capability ID from metadata key
    const capabilityId = key.split('@')[0];

    // Process metadata if capability is enabled
    if (capabilityRegistry.isEnabled(capabilityId)) {
      processedMetadata[key] = capabilityRegistry.processMetadata(capabilityId, value);
    } else {
      // Include as-is for disabled capabilities
      processedMetadata[key] = value;
    }
  }

  return processedMetadata;
}