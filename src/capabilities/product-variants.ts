// OCP Product Variants Capability Implementation
// dev.ocp.product.variants@1.0

import { Hono } from 'hono';
import type { ProductVariantsCapabilityConfig, CatalogItem } from '../types';

/**
 * Create product variants capability routes and middleware
 */
export function createProductVariantsCapability(config: ProductVariantsCapabilityConfig) {
  const variantsCapability = new Hono();

  // Middleware to enrich catalog items with variant information
  variantsCapability.use('/catalogs/:catalogId', async (c, next) => {
    await next();

    // After getting the catalog, enrich items with variant metadata
    if (c.res.status === 200) {
      try {
        const catalog = await c.res.json();
        const enrichedCatalog = enrichCatalogWithVariants(catalog, config, (c as any).var.locale);
        c.res = new Response(JSON.stringify(enrichedCatalog), {
          status: c.res.status,
          headers: c.res.headers,
        });
      } catch (error) {
        // If enrichment fails, continue with original response
        console.warn('Failed to enrich catalog with variants:', error);
      }
    }
  });

  return variantsCapability;
}

/**
 * Enrich catalog items with variant information
 */
export function enrichCatalogWithVariants(catalog: any, config: ProductVariantsCapabilityConfig, locale?: any): any {
  if (!catalog || !catalog.items || !Array.isArray(catalog.items)) {
    return catalog;
  }

  const enrichedItems = catalog.items.map((item: CatalogItem) => {
    // Add variant metadata if not already present
    if (!item.metadata?.['dev.ocp.product.variants@1.0']) {
      // Generate sample variants for demonstration
      const variants = generateSampleVariants(item, config, locale);
      if (variants.length > 0) {
        return {
          ...item,
          metadata: {
            ...item.metadata,
            'dev.ocp.product.variants@1.0': {
              _version: '1.0',
              options: ['Size', 'Color'],
              variants,
            },
          },
        };
      }
    }

    return item;
  });

  return {
    ...catalog,
    items: enrichedItems,
  };
}

/**
 * Generate sample variants for a product
 */
function generateSampleVariants(item: CatalogItem, config: ProductVariantsCapabilityConfig, locale?: any): any[] {
  const variants: any[] = [];
  const basePrice = parseFloat(item.price.amount);

  // Only generate variants for certain product types
  const name = item.name.toLowerCase();
  if (!name.includes('shirt') &&
      !name.includes('shoe') &&
      !name.includes('pants') &&
      !name.includes('t-shirt')) {
    return variants;
  }

  const sizes = ['Small', 'Medium', 'Large', 'X-Large'];
  const colors = ['Black', 'White', 'Blue', 'Red'];

  let variantId = 1;

  for (const size of sizes) {
    for (const color of colors) {
      // Check max variants limit
      if (config.maxVariantsPerProduct && variantId > config.maxVariantsPerProduct) {
        break;
      }

      // Generate variant price (slight variation from base price)
      const priceVariation = (Math.random() - 0.5) * 0.2; // ±10%
      const variantPrice = basePrice * (1 + priceVariation);

      // Generate stock (random between 0-50)
      const stock = Math.floor(Math.random() * 51);

      variants.push({
        id: `variant_${item.id}_${variantId}`,
        values: [size, color],
        price: {
          amount: variantPrice.toFixed(2),
          currency: item.price.currency,
        },
        stock,
        available: stock > 0 || config.allowOutOfStockSelection,
        // Add localized names if i18n is available
        localizedNames: locale ? {
          [locale.code]: `${size} / ${color}`,
          // Add fallback to English
          'en': `${size} / ${color}`,
        } : {
          'en': `${size} / ${color}`,
        },
      });

      variantId++;
    }
  }

  return variants;
}

/**
 * Validate variant selection
 */
export function validateVariantSelection(itemId: string, variantId: string, catalog: any): boolean {
  if (!catalog || !catalog.items) return false;

  const item = catalog.items.find((i: any) => i.id === itemId);
  if (!item) return false;

  const variants = item.metadata?.['dev.ocp.product.variants@1.0']?.variants;
  if (!variants) return false;

  const variant = variants.find((v: any) => v.id === variantId);
  return !!variant;
}

/**
 * Get variant price
 */
export function getVariantPrice(itemId: string, variantId: string, catalog: any): any {
  if (!catalog || !catalog.items) return null;

  const item = catalog.items.find((i: any) => i.id === itemId);
  if (!item) return null;

  const variants = item.metadata?.['dev.ocp.product.variants@1.0']?.variants;
  if (!variants) return null;

  const variant = variants.find((v: any) => v.id === variantId);
  return variant ? variant.price : null;
}

/**
 * Product variants capability metadata processor
 */
export function processProductVariantsMetadata(metadata: any): any {
  // Process variant-specific metadata
  if (metadata.variants && Array.isArray(metadata.variants)) {
    // Ensure all variants have required fields
    metadata.variants = metadata.variants.map((variant: any) => ({
      id: variant.id,
      values: variant.values || [],
      price: variant.price,
      stock: variant.stock || 0,
      available: variant.available !== undefined ? variant.available : variant.stock > 0,
      ...variant,
    }));
  }

  return metadata;
}

/**
 * Product variants capability metadata validator
 */
export function validateProductVariantsMetadata(metadata: any): boolean {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }

  // Validate version
  if (metadata._version !== '1.0') {
    return false;
  }

  // Validate options
  if (metadata.options && !Array.isArray(metadata.options)) {
    return false;
  }

  // Validate variants
  if (metadata.variants) {
    if (!Array.isArray(metadata.variants)) {
      return false;
    }

    for (const variant of metadata.variants) {
      if (!variant.id || !variant.values || !Array.isArray(variant.values)) {
        return false;
      }
    }
  }

  return true;
}