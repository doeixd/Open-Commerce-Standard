import { Capability, AuthFlowsConfig, AuthFlowsCapabilityConfig } from '../types';

/**
 * Auth Flows Capability (dev.ocp.auth.flows@1.0)
 * Provides authentication discovery with supported methods and flow URLs
 */
export class AuthFlowsCapability implements Capability {
  readonly id = 'dev.ocp.auth.flows@1.0';
  readonly schemaUrl = 'https://schemas.ocp.dev/auth/flows/v1.json';

  constructor(private config: AuthFlowsCapabilityConfig) {}

  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get the authentication configuration for discovery
   */
  getAuthConfig(): AuthFlowsConfig {
    if (!this.isEnabled()) {
      throw new Error('Auth flows capability is not enabled');
    }

    const authConfig: AuthFlowsConfig = {
      signInUrl: this.config.signInUrl || '/auth/signin',
      tokenFormat: this.config.tokenFormat || 'jwt',
      methods: this.config.supportedMethods
    };

    // Add optional fields
    if (this.config.signOutUrl) {
      authConfig.signOutUrl = this.config.signOutUrl;
    }

    if (this.config.profileUrl) {
      authConfig.profileUrl = this.config.profileUrl;
    }

    if (this.config.registrationUrl) {
      authConfig.registrationUrl = this.config.registrationUrl;
    }

    if (this.config.tokenLocation) {
      authConfig.tokenLocation = this.config.tokenLocation;
    }

    if (this.config.sessionDuration) {
      authConfig.sessionDuration = this.config.sessionDuration;
    }

    if (this.config.refreshTokenSupported !== undefined) {
      authConfig.refreshTokenSupported = this.config.refreshTokenSupported;
    }

    // Add OAuth2 config if supported
    if (this.config.supportedMethods.includes('oauth2') && this.config.oauth2) {
      authConfig.oauth2 = {
        authorizationUrl: this.config.oauth2.authorizationUrl!,
        tokenUrl: this.config.oauth2.tokenUrl!,
        scopes: this.config.oauth2.scopes,
        providers: this.config.oauth2.providers
      };
    }

    // Add SIWE config if supported
    if (this.config.supportedMethods.includes('siwe') && this.config.siwe) {
      authConfig.siwe = {
        domain: this.config.siwe.domain!,
        challengeUrl: this.config.siwe.challengeUrl!,
        verifyUrl: this.config.siwe.verifyUrl!
      };
    }

    return authConfig;
  }

  /**
   * Validate if a requested auth method is supported
   */
  isMethodSupported(method: string): boolean {
    if (!this.isEnabled()) {
      return false;
    }

    return this.config.supportedMethods.includes(method as any);
  }

  /**
   * Get OAuth2 provider information
   */
  getOAuth2Provider(providerId: string): { id: string; name: string; iconUrl?: string } | null {
    if (!this.isEnabled() || !this.config.oauth2?.providers) {
      return null;
    }

    return this.config.oauth2.providers.find(p => p.id === providerId) || null;
  }

  /**
   * Get all supported OAuth2 providers
   */
  getOAuth2Providers(): Array<{ id: string; name: string; iconUrl?: string }> {
    if (!this.isEnabled() || !this.config.oauth2?.providers) {
      return [];
    }

    return this.config.oauth2.providers;
  }

  /**
   * Get SIWE configuration
   */
  getSIWEConfig(): { domain: string; challengeUrl: string; verifyUrl: string } | null {
    if (!this.isEnabled() || !this.config.siwe) {
      return null;
    }

    return {
      domain: this.config.siwe.domain!,
      challengeUrl: this.config.siwe.challengeUrl!,
      verifyUrl: this.config.siwe.verifyUrl!
    };
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
        description: 'Authentication discovery with supported methods, token formats, and flow URLs',
        config: this.getAuthConfig()
      }
    };
  }
}