import { Capability, StoreInfo, StoreInfoCapabilityConfig, Store } from '../types';

/**
 * Store Info Capability (dev.ocp.store.info@1.0)
 * Provides extended store information including location, hours, contact details, and policies
 */
export class StoreInfoCapability implements Capability {
  readonly id = 'dev.ocp.store.info@1.0';
  readonly schemaUrl = 'https://schemas.ocp.dev/store/info/v1.json';

  constructor(private config: StoreInfoCapabilityConfig) {}

  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get store information for a given store ID
   */
  async getStoreInfo(storeId: string, stores: Store[]): Promise<StoreInfo | null> {
    if (!this.isEnabled()) {
      return null;
    }

    // Get store from context or storage
    const store = stores.find(s => s.id === storeId);
    if (!store) {
      return null;
    }

    // Build store info based on configuration
    const storeInfo: StoreInfo = {
      name: store.name,
      address: {
        streetAddress: store.location.address,
        addressLocality: 'Unknown', // Would be populated from actual store data
        addressRegion: 'Unknown',
        postalCode: '00000',
        addressCountry: 'US'
      }
    };

    // Add optional fields based on config
    if (this.config.includeLocation && store.location.latitude && store.location.longitude) {
      storeInfo.geo = {
        latitude: store.location.latitude,
        longitude: store.location.longitude
      };
    }

    if (this.config.includeContactInfo) {
      // Add contact info if available in store metadata
      if (store.metadata?.telephone) {
        storeInfo.telephone = store.metadata.telephone;
      }
      if (store.metadata?.email) {
        storeInfo.email = store.metadata.email;
      }
      if (store.metadata?.url) {
        storeInfo.url = store.metadata.url;
      }
    }

    if (this.config.includeHours && store.metadata?.openingHours) {
      storeInfo.openingHours = store.metadata.openingHours;
    }

    if (this.config.includePolicies) {
      // Add policy-related fields if available
      if (store.metadata?.paymentAccepted) {
        storeInfo.paymentAccepted = store.metadata.paymentAccepted;
      }
      if (store.metadata?.currenciesAccepted) {
        storeInfo.currenciesAccepted = store.metadata.currenciesAccepted;
      }
    }

    if (this.config.includeRatings && store.metadata?.aggregateRating) {
      storeInfo.aggregateRating = store.metadata.aggregateRating;
    }

    return storeInfo;
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
        description: 'Extended store information including location, hours, contact details, and policies',
        config: this.config
      }
    };
  }
}