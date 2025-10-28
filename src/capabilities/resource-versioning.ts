// OCP Resource Versioning Capability Implementation
// dev.ocp.resource.versioning@1.0

import { Hono } from 'hono';
import type { ResourceVersioningCapabilityConfig } from '../types';

/**
 * Create resource versioning capability routes and middleware
 */
export function createResourceVersioningCapability(_config: ResourceVersioningCapabilityConfig) {
  const versioningCapability = new Hono();

  // Middleware to add versioning headers and handle version negotiation
  versioningCapability.use('*', async (c, next) => {
    // Add versioning headers
    c.header('OCP-Versioning', 'immutable');
    c.header('Accept-OCP-Versions', '1.0');

    await next();
  });

  // GET /resources/{chainId}/versions - Get version history for a resource chain
  versioningCapability.get('/resources/:chainId/versions', async (c) => {
    const chainId = c.req.param('chainId');
    // This would need to be implemented in storage layer

    // Mock version history - in real implementation, this would query the storage
    const versions = [
      {
        id: `${chainId}_v1`,
        chainId,
        version: 1,
        revises: null,
        isLatest: false,
        supersededBy: `${chainId}_v2`,
        revisionDetails: {
          actionId: 'update_product',
          timestamp: '2024-01-01T10:00:00Z',
          actor: { type: 'user', id: 'user_123' },
        },
      },
      {
        id: `${chainId}_v2`,
        chainId,
        version: 2,
        revises: `${chainId}_v1`,
        isLatest: true,
        revisionDetails: {
          actionId: 'update_price',
          timestamp: '2024-01-02T10:00:00Z',
          actor: { type: 'user', id: 'user_123' },
        },
      },
    ];

    return c.json({
      chainId,
      versions,
      _links: {
        latest: { href: `/resources/${chainId}` },
        self: { href: `/resources/${chainId}/versions` },
      },
    }, {
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  // GET /resources/{chainId}/versions/{version} - Get specific version
  versioningCapability.get('/resources/:chainId/versions/:version', async (c) => {
    const chainId = c.req.param('chainId');
    const version = parseInt(c.req.param('version'));

    // Mock version retrieval
    const versionData = {
      id: `${chainId}_v${version}`,
      chainId,
      version,
      revises: version > 1 ? `${chainId}_v${version - 1}` : null,
      isLatest: version === 2, // Mock
      revisionDetails: {
        actionId: 'update_resource',
        timestamp: `2024-01-0${version}T10:00:00Z`,
        actor: { type: 'user', id: 'user_123' },
      },
      // Include the actual resource data here
      data: {
        name: `Resource ${chainId} v${version}`,
        value: version * 100,
      },
    };

    return c.json(versionData, {
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
        'OCP-Resource-Version': version.toString(),
      },
    });
  });

  return versioningCapability;
}

/**
 * Create versioned resource data
 */
export function createVersionedResource(
  chainId: string,
  data: any,
  actionId: string,
  actor: { type: string; id: string },
  previousVersion?: any
): any {
  const version = previousVersion ? previousVersion.version + 1 : 1;
  const id = `${chainId}_v${version}`;

  return {
    id,
    chainId,
    version,
    revises: previousVersion?.id || null,
    isLatest: true,
    revisionDetails: {
      actionId,
      timestamp: new Date().toISOString(),
      actor,
      arguments: data, // Store the change arguments
    },
    data,
    _version: '1.0',
  };
}

/**
 * Mark a version as superseded
 */
export function supersedeVersion(version: any, newVersionId: string): any {
  return {
    ...version,
    isLatest: false,
    supersededBy: newVersionId,
  };
}

/**
 * Resource versioning metadata processor
 */
export function processResourceVersioningMetadata(metadata: any): any {
  // Process versioning-specific metadata
  if (metadata.version !== undefined) {
    // Ensure version is a positive integer
    metadata.version = Math.max(1, Math.floor(metadata.version));
  }

  if (metadata.revisionDetails) {
    // Ensure timestamp is valid
    if (metadata.revisionDetails.timestamp) {
      try {
        new Date(metadata.revisionDetails.timestamp);
      } catch {
        metadata.revisionDetails.timestamp = new Date().toISOString();
      }
    }
  }

  return metadata;
}

/**
 * Resource versioning metadata validator
 */
export function validateResourceVersioningMetadata(metadata: any): boolean {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }

  // Validate version
  if (metadata._version !== '1.0') {
    return false;
  }

  // Validate chainId
  if (!metadata.chainId || typeof metadata.chainId !== 'string') {
    return false;
  }

  // Validate version number
  if (typeof metadata.version !== 'number' || metadata.version < 1) {
    return false;
  }

  // Validate isLatest
  if (typeof metadata.isLatest !== 'boolean') {
    return false;
  }

  // Validate revision details if present
  if (metadata.revisionDetails) {
    if (!metadata.revisionDetails.actionId || !metadata.revisionDetails.timestamp || !metadata.revisionDetails.actor) {
      return false;
    }
  }

  return true;
}