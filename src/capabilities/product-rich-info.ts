import { Capability, ProductRichInfo, ProductRichInfoCapabilityConfig, CatalogItem, Catalog } from '../types';

/**
 * Product Rich Info Capability (dev.ocp.product.rich_info@1.0)
 * Provides comprehensive presentation and SEO content for products
 */
export class ProductRichInfoCapability implements Capability {
  readonly id = 'dev.ocp.product.rich_info@1.0';
  readonly schemaUrl = 'https://schemas.ocp.dev/product/rich_info/v1.json';

  constructor(private config: ProductRichInfoCapabilityConfig) {}

  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get rich information for a specific product
   */
  async getProductRichInfo(productId: string, catalogs: Catalog[]): Promise<ProductRichInfo | null> {
    if (!this.isEnabled()) {
      return null;
    }

    // Find the product across all catalogs
    let product: CatalogItem | null = null;

    for (const catalog of catalogs) {
      const found = catalog.items.find(item => item.id === productId);
      if (found) {
        product = found;
        break;
      }
    }

    if (!product) {
      return null;
    }

    // Build rich info from product metadata
    const richInfo: ProductRichInfo = {
      _version: '1.0',
      lastModified: new Date().toISOString(),
      authorRef: 'system'
    };

    // Add names
    if (product.metadata?.names) {
      richInfo.names = product.metadata.names;
    } else {
      richInfo.names = {
        customerFacing: product.name,
        backend: product.name
      };
    }

    // Add descriptions
    if (product.metadata?.descriptions) {
      richInfo.descriptions = product.metadata.descriptions;
    } else if (product.description) {
      richInfo.descriptions = {
        short: product.description,
        longText: product.description
      };
    }

    // Add SEO information
    if (product.metadata?.seo) {
      richInfo.seo = product.metadata.seo;
    }

    // Add key features
    if (product.metadata?.keyFeatures) {
      richInfo.keyFeatures = product.metadata.keyFeatures;
    }

    // Add image gallery
    if (product.metadata?.imageGallery) {
      richInfo.imageGallery = product.metadata.imageGallery;
    } else if (product.metadata?.image) {
      // Fallback to single image
      richInfo.imageGallery = [{
        alt: product.name,
        fallbackUrl: product.metadata.image
      }];
    }

    // Add publication status
    if (product.available) {
      richInfo.publicationStatus = 'published';
    } else {
      richInfo.publicationStatus = 'archived';
    }

    return richInfo;
  }

  /**
   * Update rich information for a product
   */
  async updateProductRichInfo(productId: string, updates: Partial<ProductRichInfo>, catalogs: Catalog[]): Promise<{ richInfo: ProductRichInfo; updatedCatalogs: Catalog[] } | null> {
    if (!this.isEnabled()) {
      return null;
    }

    // Find the product
    let product: CatalogItem | null = null;
    let catalogIndex = -1;
    let itemIndex = -1;

    for (let cIndex = 0; cIndex < catalogs.length; cIndex++) {
      const catalog = catalogs[cIndex];
      const iIndex = catalog.items.findIndex(item => item.id === productId);
      if (iIndex !== -1) {
        product = catalog.items[iIndex];
        catalogIndex = cIndex;
        itemIndex = iIndex;
        break;
      }
    }

    if (!product || catalogIndex === -1 || itemIndex === -1) {
      return null;
    }

    // Update the rich info in metadata
    const existingRichInfo = product.metadata?.richInfo || {};
    const updatedRichInfo = {
      ...existingRichInfo,
      ...updates,
      _version: '1.0',
      lastModified: new Date().toISOString()
    };

    // Update the product metadata
    const updatedCatalogs = [...catalogs];
    updatedCatalogs[catalogIndex] = {
      ...updatedCatalogs[catalogIndex],
      items: [...updatedCatalogs[catalogIndex].items]
    };
    updatedCatalogs[catalogIndex].items[itemIndex] = {
      ...product,
      metadata: {
        ...product.metadata,
        richInfo: updatedRichInfo
      }
    };

    return { richInfo: updatedRichInfo, updatedCatalogs };
  }

  /**
   * Get the capability metadata for discovery
   */
  getMetadata(): Capability {
    return {
      id: this.id,
      schemaUrl: this.schemaUrl,
      status: 'stable',
      metadata: {
        description: 'Comprehensive presentation and SEO content for products including images, descriptions, and metadata',
        config: this.config
      }
    };
  }
}