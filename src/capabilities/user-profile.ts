import { Capability, UserProfile, UserProfileCapabilityConfig } from '../types';

/**
 * User Profile Capability (dev.ocp.user.profile@1.0)
 * Provides user-specific data like saved addresses and preferences
 */
export class UserProfileCapability implements Capability {
  readonly id = 'dev.ocp.user.profile@1.0';
  readonly schemaUrl = 'https://schemas.ocp.dev/user/profile/v1.json';

  constructor(private config: UserProfileCapabilityConfig) {}

  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get user profile for a given user ID
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    if (!this.isEnabled()) {
      return null;
    }

    // In a real implementation, this would fetch from a user storage system
    // For now, we'll return a mock profile or null
    const mockProfile: UserProfile = {
      savedAddresses: [
        {
          label: 'Home',
          address: {
            streetAddress: '123 Main St',
            addressLocality: 'Anytown',
            addressRegion: 'CA',
            postalCode: '12345',
            addressCountry: 'US'
          }
        }
      ],
      preferences: {
        language: 'en-US',
        notifications: true,
        currency: 'USD'
      },
      consentGiven: true
    };

    // Check if guest profiles are allowed and this is a guest user
    if (!this.config.allowGuestProfiles && userId.startsWith('guest_')) {
      return null;
    }

    return mockProfile;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    if (!this.isEnabled()) {
      return null;
    }

    // Get current profile
    const currentProfile = await this.getUserProfile(userId);
    if (!currentProfile) {
      return null;
    }

    // Validate updates based on configuration
    const validatedUpdates: Partial<UserProfile> = {};

    if (updates.savedAddresses !== undefined) {
      const maxAddresses = this.config.maxSavedAddresses || 10;
      if (updates.savedAddresses.length <= maxAddresses) {
        validatedUpdates.savedAddresses = updates.savedAddresses;
      }
    }

    if (updates.preferences !== undefined) {
      if (this.config.allowCustomPreferences) {
        validatedUpdates.preferences = updates.preferences;
      }
    }

    if (updates.consentGiven !== undefined) {
      validatedUpdates.consentGiven = updates.consentGiven;
    }

    if (updates.defaultBillingAddress !== undefined) {
      validatedUpdates.defaultBillingAddress = updates.defaultBillingAddress;
    }

    // Merge updates with current profile
    const updatedProfile: UserProfile = {
      ...currentProfile,
      ...validatedUpdates
    };

    // In a real implementation, this would save to storage
    return updatedProfile;
  }

  /**
   * Add a saved address to user profile
   */
  async addSavedAddress(userId: string, address: { label?: string; address: any }): Promise<UserProfile | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const currentProfile = await this.getUserProfile(userId);
    if (!currentProfile) {
      return null;
    }

    const maxAddresses = this.config.maxSavedAddresses || 10;
    if (currentProfile.savedAddresses && currentProfile.savedAddresses.length >= maxAddresses) {
      throw new Error(`Maximum number of saved addresses (${maxAddresses}) reached`);
    }

    const updatedAddresses = [...(currentProfile.savedAddresses || []), address];

    return this.updateUserProfile(userId, { savedAddresses: updatedAddresses });
  }

  /**
   * Remove a saved address from user profile
   */
  async removeSavedAddress(userId: string, addressIndex: number): Promise<UserProfile | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const currentProfile = await this.getUserProfile(userId);
    if (!currentProfile || !currentProfile.savedAddresses) {
      return null;
    }

    if (addressIndex < 0 || addressIndex >= currentProfile.savedAddresses.length) {
      throw new Error('Invalid address index');
    }

    const updatedAddresses = currentProfile.savedAddresses.filter((_, index) => index !== addressIndex);

    return this.updateUserProfile(userId, { savedAddresses: updatedAddresses });
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
        description: 'User preferences and saved information including addresses and profile management',
        config: this.config
      }
    };
  }
}