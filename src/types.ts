// Core OCP Types - Reference Implementation
// Based on Open Commerce Protocol v1.0.0-rc.1

/**
 * Represents a monetary value with currency information.
 */
export interface Money {
  amount: string;
  currency: string;
}

export interface Location {
  address: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Represents a store/vendor in the OCP ecosystem.
 */
export interface Store {
  id: string;
  name: string;
  location: Location;
  catalogIds: string[];
  metadata?: Record<string, any>;
}

export interface CatalogSummary {
  id: string;
  name: string;
  version: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  description?: string;
  price: Money;
  available: boolean;
  fulfillmentType: 'pickup' | 'physical' | 'digital' | 'hybrid';
  metadata?: Record<string, any>;
  fulfillmentComponents?: Array<{
    type: 'physical' | 'digital' | 'pickup';
    description: string;
    required: boolean;
  }>;
}

export interface Catalog extends CatalogSummary {
  items: CatalogItem[];
  metadata?: Record<string, any>;
}

export interface PaginationMeta {
  limit: number;
  nextCursor?: string | null;
  previousCursor?: string | null;
  totalCount?: number;
}

export interface StoresResponse {
  stores: Store[];
  pagination: PaginationMeta;
}

export interface CatalogsResponse {
  catalogs: CatalogSummary[];
  pagination: PaginationMeta;
}

export interface Capability {
  id: string;
  schemaUrl?: string;
  status?: 'beta' | 'stable' | 'deprecated';
  sunset?: string;
  migrationGuide?: string;
  metadata?: Record<string, any>;
  rel?: string;
  href?: string;
}

export interface CapabilitiesResponse {
  capabilities: Capability[];
}

export interface OcpDiscoveryResponse {
  OCP: {
    capabilities: string;
    version: string;
    context?: string;
    payment?: string;
  };
}

export interface CreateCartRequest {
  storeId: string;
}

export interface CartItemRequest {
  itemId: string;
  quantity: number;
  addOnIds?: string[];
  notes?: string;
  customizations?: Record<string, string | string[]>;
}

export interface UpdateCartItemRequest {
  quantity: number;
  notes?: string | null;
  addOnIds?: string[];
  customizations?: Record<string, string | string[]>;
}

export interface CartItem extends CartItemRequest {
  cartItemId: string;
  price: Money;
  metadata?: Record<string, any>;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: Money;
  tax: Money;
  total: Money;
  stores?: Array<{
    storeId: string;
    storeName: string;
    itemCount: number;
    subtotal: Money;
  }>;
  guestInfo?: {
    email: string;
    deliveryAddress?: Location;
    billingAddress?: Location;
  };
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface CreateOrderFromCartRequest {
  orderType: 'from_cart';
  cartId: string;
  fulfillmentType?: 'pickup' | 'delivery';
  deliveryAddress?: Location;
  billingAddress?: Location;
  consentGiven?: boolean;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface CreateDirectOrderRequest {
  orderType: 'direct';
  items: CartItemRequest[];
  fulfillmentType?: 'pickup' | 'delivery';
  deliveryAddress?: Location;
  billingAddress?: Location;
  consentGiven?: boolean;
  notes?: string;
  promotionCode?: string;
  metadata?: Record<string, any>;
}

export type CreateOrderRequest = CreateOrderFromCartRequest | CreateDirectOrderRequest;

export interface Action {
  id: string;
  href: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  rel?: string;
  title?: string;
  description?: string;
  requestSchema?: any;
  responseSchema?: any;
  errorSchemas?: any[];
  parameters?: any[];
  examples?: {
    request?: any;
    response?: any;
  };
}

export interface ReturnSummary {
  id: string;
  status: 'requested' | 'approved' | 'rejected' | 'in_transit' | 'received' | 'processed' | 'completed';
  href: string;
}

/**
 * Represents an order in the OCP system.
 */
export interface Order {
  id: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  actions?: Action[];
  returns?: ReturnSummary[];
  items: CartItem[];
  total: Money;
  fulfillmentType?: 'pickup' | 'delivery';
  deliveryAddress?: Location;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface OrdersResponse {
  orders: Order[];
  pagination: PaginationMeta;
}

export interface PromotionRequest {
  type: 'promo_code' | 'gift_card' | 'loyalty_points';
  value: string;
}

export interface RatingRequest {
  food?: number;
  delivery?: number;
  restaurant?: number;
  comment?: string;
}

export interface CreateWebhookSubscriptionRequest {
  url: string;
  events: string[];
  description?: string;
  metadata?: Record<string, any>;
}

export interface WebhookSubscription {
  id: string;
  userId: string;
  url: string;
  events: string[];
  description?: string;
  secret?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface WebhookSubscriptionsResponse {
  subscriptions: WebhookSubscription[];
  pagination: PaginationMeta;
}

export interface WebhookEvent {
  id: string;
  event: string;
  timestamp: string;
  data: any;
  previousData?: any;
}

// Store Info types
export interface StoreInfo {
  name: string;
  description?: string;
  address: {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  };
  telephone?: string;
  url?: string;
  openingHours?: string[];
  priceRange?: string;
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
  };
  geo?: {
    latitude: number;
    longitude: number;
  };
  logo?: string;
  email?: string;
  faxNumber?: string;
  image?: string;
  photo?: string[];
  slogan?: string;
  foundingDate?: string;
  numberOfEmployees?: number;
  paymentAccepted?: string[];
  currenciesAccepted?: string[];
  areaServed?: string;
  branchCode?: string;
  keywords?: string[];
  knowsAbout?: string[];
  hasMap?: string;
}

// Product Search types
export interface ProductSearchConfig {
  urlTemplate: string;
  supportedSorts?: string[];
  searchableIdentifierTypes?: string[];
}

// Product Rich Info types
export interface ProductRichInfo {
  _version: string;
  lastModified: string;
  authorRef?: string;
  publicationStatus?: 'published' | 'draft' | 'archived' | 'coming_soon' | 'pre_order';
  names?: {
    short?: string;
    customerFacing?: string;
    backend?: string;
  };
  descriptions?: {
    short?: string;
    longText?: string;
    longHtml?: string;
  };
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    slug?: string;
  };
  keyFeatures?: string[];
  imageGallery?: Array<{
    alt: string;
    title?: string;
    sources?: Array<{
      url: string;
      type?: string;
      srcset?: string;
      sizes?: string;
    }>;
    fallbackUrl: string;
    variantId?: string;
  }>;
  variants?: Array<{
    variantId: string;
    names?: {
      short?: string;
      customerFacing?: string;
      backend?: string;
    };
    descriptions?: {
      short?: string;
      longText?: string;
      longHtml?: string;
    };
    imageGallery?: Array<{
      alt: string;
      title?: string;
      sources?: Array<{
        url: string;
        type?: string;
        srcset?: string;
        sizes?: string;
      }>;
      fallbackUrl: string;
    }>;
    keyFeatures?: string[];
  }>;
}

// Auth Flows types
export interface AuthFlowsConfig {
  signInUrl: string;
  signOutUrl?: string;
  profileUrl?: string;
  registrationUrl?: string;
  tokenFormat: 'jwt' | 'opaque' | 'api_key';
  tokenLocation?: 'header' | 'cookie';
  methods: ('password' | 'oauth2' | 'siwe' | 'magic_link' | 'webauthn')[];
  oauth2?: {
    authorizationUrl: string;
    tokenUrl: string;
    scopes?: string[];
    providers?: Array<{
      id: string;
      name: string;
      iconUrl?: string;
    }>;
  };
  siwe?: {
    domain: string;
    challengeUrl: string;
    verifyUrl: string;
  };
  sessionDuration?: number;
  refreshTokenSupported?: boolean;
}

// User Profile types
export interface UserProfile {
  savedAddresses?: Array<{
    label?: string;
    address: {
      streetAddress: string;
      addressLocality: string;
      addressRegion: string;
      postalCode: string;
      addressCountry: string;
    };
  }>;
  defaultBillingAddress?: {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  };
  preferences?: {
    language?: string;
    notifications?: boolean;
    currency?: string;
  };
  consentGiven?: boolean;
}

// Error handling types
export interface ValidationIssue {
  type: 'validation';
  field: string;
  value?: any;
  reason: string;
}

export interface BusinessLogicIssue {
  type: 'business_logic';
  resourceId?: string;
  reason: string;
}

export type ErrorDetail = ValidationIssue | BusinessLogicIssue;

export interface Error {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  timestamp: string;
  localizationKey?: string;
  nextActions?: Action[];
  errors?: ErrorDetail[];
}

// Capability-specific configuration types
export interface CartCapabilityConfig {
  enabled: boolean;
  lifetimeSeconds: number;
  maxItems?: number;
  maxValue?: Money;
  allowGuestCheckout?: boolean;
  policies?: CartPolicy[];
}

export interface CartPolicy {
  type: 'expiration' | 'max_items' | 'max_value' | 'store_restrictions';
  value: any;
  message?: string;
}

export interface DirectOrderCapabilityConfig {
  enabled: boolean;
  maxItemsPerOrder?: number;
  allowGuestOrders?: boolean;
  supportedFulfillmentTypes?: ('pickup' | 'delivery' | 'digital')[];
}

export interface ProductVariantsCapabilityConfig {
  enabled: boolean;
  maxVariantsPerProduct?: number;
  supportedVariantTypes?: string[];
  allowOutOfStockSelection?: boolean;
}

export interface ProductSearchCapabilityConfig {
  enabled: boolean;
  urlTemplate: string;
  supportedSorts?: string[];
  searchableIdentifierTypes?: string[];
  maxResultsPerPage?: number;
}

export interface ProductRichInfoCapabilityConfig {
  enabled: boolean;
  supportedImageFormats?: string[];
  maxImagesPerProduct?: number;
  allowVariantSpecificImages?: boolean;
}

export interface StoreInfoCapabilityConfig {
  enabled: boolean;
  includeHours?: boolean;
  includeContactInfo?: boolean;
  includePolicies?: boolean;
  includeLocation?: boolean;
  includeRatings?: boolean;
}

export interface AuthFlowsCapabilityConfig {
  enabled: boolean;
  supportedMethods: ('password' | 'oauth2' | 'webauthn' | 'magic_link' | 'siwe')[];
  signInUrl?: string;
  signUpUrl?: string;
  signOutUrl?: string;
  profileUrl?: string;
  registrationUrl?: string;
  tokenFormat?: 'jwt' | 'opaque' | 'api_key';
  tokenLocation?: 'header' | 'cookie';
  sessionDuration?: number;
  refreshTokenSupported?: boolean;
  oauth2?: {
    authorizationUrl?: string;
    tokenUrl?: string;
    scopes?: string[];
    providers?: Array<{
      id: string;
      name: string;
      iconUrl?: string;
    }>;
  };
  siwe?: {
    domain?: string;
    challengeUrl?: string;
    verifyUrl?: string;
  };
}

export interface DeliveryTrackingCapabilityConfig {
  enabled: boolean;
  updateIntervalSeconds?: number;
  enableLiveLocation?: boolean;
  enableDriverInfo?: boolean;
}

export interface ShipmentTrackingCapabilityConfig {
  enabled: boolean;
  supportedCarriers?: string[];
  enableTrackingUrls?: boolean;
}

export interface DetailedStatusCapabilityConfig {
  enabled: boolean;
  supportedLocales?: string[];
  customStatusDefinitions?: Record<string, StatusDefinition>;
}

export interface StatusDefinition {
  title: string;
  description: string;
  progress?: number;
  icon?: string;
}

export interface TippingCapabilityConfig {
  enabled: boolean;
  suggestedPercentages?: number[];
  allowCustomAmount?: boolean;
  minAmount?: Money;
  maxAmount?: Money;
}

export interface StoreInfoCapabilityConfig {
  enabled: boolean;
  includeHours?: boolean;
  includeContactInfo?: boolean;
  includePolicies?: boolean;
}

export interface RestaurantProfileCapabilityConfig {
  enabled: boolean;
  includeCuisine?: boolean;
  includeHours?: boolean;
  includeRatings?: boolean;
  includePriceRange?: boolean;
}

export interface PromotionsCapabilityConfig {
  enabled: boolean;
  allowPublicDiscovery?: boolean;
  supportedTypes?: ('coupon' | 'discount' | 'loyalty' | 'gift_card')[];
}

export interface PaymentCapabilityConfig {
  enabled: boolean;
  supportedSchemes?: ('exact' | 'fiat_intent')[];
  supportedNetworks?: string[];
}

export interface LocaleInfo {
  code: string;
  isRtl?: boolean;
  numberFormat: {
    decimalSeparator: string;
    groupingSeparator?: string;
  };
  currencyFormat?: {
    symbol: string;
    position: 'before' | 'after';
  };
  dateFormat?: {
    shortDate?: string;
    longDate?: string;
    timeFormat?: string;
  };
}

export interface I18nCapabilityConfig {
  enabled: boolean;
  defaultLocale: string;
  supportedLocales: LocaleInfo[];
  fallbackLocale?: string;
}

export interface ResourceVersioningCapabilityConfig {
  enabled: boolean;
  supportedResourceTypes?: string[];
  maxVersionsPerChain?: number;
  retentionPolicy?: {
    keepLatest: number;
    keepDays?: number;
  };
}

export interface UserProfileCapabilityConfig {
  enabled: boolean;
  allowGuestProfiles?: boolean;
  supportedFields?: string[];
  maxSavedAddresses?: number;
  allowCustomPreferences?: boolean;
}

export interface SchedulingCapabilityConfig {
  enabled: boolean;
  allowAdvanceBooking?: boolean;
  maxAdvanceDays?: number;
  timeSlotIntervalMinutes?: number;
}

export interface KitchenStatusCapabilityConfig {
  enabled: boolean;
  updateIntervalSeconds?: number;
  includePrepTimes?: boolean;
  supportedStatuses?: string[];
}

// Enhanced capabilities configuration
export interface OcpCapabilitiesConfig {
  // Core capabilities
  cart?: CartCapabilityConfig;
  directOrder?: DirectOrderCapabilityConfig;

  // Product capabilities
  productVariants?: ProductVariantsCapabilityConfig;
  productSearch?: ProductSearchCapabilityConfig;
  productRichInfo?: ProductRichInfoCapabilityConfig;

  // Order capabilities
  deliveryTracking?: DeliveryTrackingCapabilityConfig;
  shipmentTracking?: ShipmentTrackingCapabilityConfig;
  detailedStatus?: DetailedStatusCapabilityConfig;
  tipping?: TippingCapabilityConfig;

  // Store capabilities
  storeInfo?: StoreInfoCapabilityConfig;
  restaurantProfile?: RestaurantProfileCapabilityConfig;

  // Promotion capabilities
  promotions?: PromotionsCapabilityConfig;

  // Auth capabilities
  authFlows?: AuthFlowsCapabilityConfig;
  userProfile?: UserProfileCapabilityConfig;

  // Advanced capabilities
  payment?: PaymentCapabilityConfig;
  i18n?: I18nCapabilityConfig;
  resourceVersioning?: ResourceVersioningCapabilityConfig;
  scheduling?: SchedulingCapabilityConfig;
  kitchenStatus?: KitchenStatusCapabilityConfig;
}

// Configuration types
export interface OcpConfig {
  baseUrl?: string;
  version?: string;
  capabilities?: Capability[];
  stores?: Store[];
  catalogs?: Catalog[];
  rateLimitConfig?: {
    limit: number;
    window: number;
    unit: string;
  };
  enableWebhooks?: boolean;
  enableOrders?: boolean;
  enableCarts?: boolean;

  // New capability-specific configuration
  capabilityConfig?: OcpCapabilitiesConfig;
}

// Storage interfaces for data persistence
export interface CartStorage {
  create(cart: Omit<Cart, 'id' | 'createdAt' | 'updatedAt'>): Promise<Cart>;
  get(id: string): Promise<Cart | null>;
  update(id: string, updates: Partial<Cart>): Promise<Cart | null>;
  delete(id: string): Promise<boolean>;
  list(userId?: string): Promise<Cart[]>;
}

export interface OrderStorage {
  create(order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<Order>;
  get(id: string): Promise<Order | null>;
  update(id: string, updates: Partial<Order>): Promise<Order | null>;
  delete(id: string): Promise<boolean>;
  list(userId?: string, status?: string): Promise<Order[]>;
}

export interface WebhookStorage {
  create(subscription: Omit<WebhookSubscription, 'id' | 'secret' | 'createdAt' | 'updatedAt'>): Promise<WebhookSubscription>;
  get(id: string): Promise<WebhookSubscription | null>;
  list(userId?: string): Promise<WebhookSubscription[]>;
  delete(id: string): Promise<boolean>;
  update(id: string, updates: Partial<WebhookSubscription>): Promise<WebhookSubscription | null>;
}

// Middleware context extension will be added in the middleware file