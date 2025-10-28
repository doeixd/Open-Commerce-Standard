import { Capability, ProductSearchConfig, ProductSearchCapabilityConfig, Catalog } from '../types';

/**
 * Product Search Capability (dev.ocp.product.search@1.0)
 * Provides URL template-based product search with filters and sorting
 */
export class ProductSearchCapability implements Capability {
  readonly id = 'dev.ocp.product.search@1.0';
  readonly schemaUrl = 'https://schemas.ocp.dev/product/search/v1.json';

  constructor(private config: ProductSearchCapabilityConfig) {}

  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get the search configuration for discovery
   */
  getSearchConfig(): ProductSearchConfig {
    if (!this.isEnabled()) {
      throw new Error('Product search capability is not enabled');
    }

    return {
      urlTemplate: this.config.urlTemplate,
      supportedSorts: this.config.supportedSorts,
      searchableIdentifierTypes: this.config.searchableIdentifierTypes
    };
  }

  /**
   * Perform a product search based on the URL template
   * This is a simplified implementation - in a real system this would parse the URL template
   * and perform actual search operations
   */
  async searchProducts(query: string, sortBy: string | undefined, catalogs: Catalog[]): Promise<any[]> {
    if (!this.isEnabled()) {
      return [];
    }

    // Get all catalogs and their items
    const allItems: any[] = [];
    catalogs.forEach(catalog => {
      catalog.items.forEach(item => {
        allItems.push({
          ...item,
          catalogId: catalog.id,
          catalogName: catalog.name
        });
      });
    });

    // Simple text search implementation
    let results = allItems.filter(item =>
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(query.toLowerCase()))
    );

    // Apply sorting if specified
    if (sortBy && this.config.supportedSorts?.includes(sortBy)) {
      switch (sortBy) {
        case 'relevance':
          // Keep current order (already filtered by relevance)
          break;
        case 'price_asc':
          results.sort((a, b) => parseFloat(a.price.amount) - parseFloat(b.price.amount));
          break;
        case 'price_desc':
          results.sort((a, b) => parseFloat(b.price.amount) - parseFloat(a.price.amount));
          break;
        case 'name':
          results.sort((a, b) => a.name.localeCompare(b.name));
          break;
        default:
          // Unknown sort, keep current order
          break;
      }
    }

    // Limit results
    const maxResults = this.config.maxResultsPerPage || 50;
    return results.slice(0, maxResults);
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
        description: 'URL template-based product search with filters and sorting options',
        config: this.getSearchConfig()
      }
    };
  }
}