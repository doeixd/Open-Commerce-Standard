// OCP I18n Capability Implementation
// dev.ocp.i18n@1.0

import { Hono } from 'hono';
import type { I18nCapabilityConfig, LocaleInfo } from '../types';

/**
 * Create i18n capability routes and middleware
 */
export function createI18nCapability(config: I18nCapabilityConfig) {
  const i18nCapability = new Hono();

  // Middleware to handle locale negotiation
  i18nCapability.use('*', async (c, next) => {

    // Get requested locale from Accept-Language header
    const acceptLanguage = c.req.header('Accept-Language');
    const negotiatedLocale = negotiateLocale(acceptLanguage, config);

    // Store negotiated locale in context
    (c as any).set('locale', negotiatedLocale);

    // Add locale info to response headers
    c.header('Content-Language', negotiatedLocale.code);

    await next();
  });

  // GET /locales - Get available locales
  i18nCapability.get('/locales', async (c) => {

    return c.json({
      defaultLocale: config.defaultLocale,
      supportedLocales: config.supportedLocales,
      negotiatedLocale: (c as any).var.locale,
    }, {
      headers: {
        'Content-Type': 'application/ocp+json; version=1.0',
      },
    });
  });

  return i18nCapability;
}

/**
 * Negotiate locale based on Accept-Language header
 */
export function negotiateLocale(acceptLanguage: string | undefined, config: I18nCapabilityConfig): LocaleInfo {
  if (!acceptLanguage) {
    return config.supportedLocales.find(l => l.code === config.defaultLocale) || config.supportedLocales[0];
  }

  // Parse Accept-Language header (simplified - in production use a proper parser)
  const requestedLocales = acceptLanguage.split(',').map(lang => {
    const [code, quality = '1'] = lang.trim().split(';q=');
    return { code: code.trim(), quality: parseFloat(quality) };
  }).sort((a, b) => b.quality - a.quality);

  // Find best match
  for (const requested of requestedLocales) {
    // Exact match
    const exactMatch = config.supportedLocales.find(l => l.code === requested.code);
    if (exactMatch) return exactMatch;

    // Language match (e.g., 'en' matches 'en-US')
    const languageMatch = config.supportedLocales.find(l => l.code.startsWith(requested.code + '-'));
    if (languageMatch) return languageMatch;
  }

  // Fallback to default
  return config.supportedLocales.find(l => l.code === config.defaultLocale) || config.supportedLocales[0];
}

/**
 * Format currency according to locale
 */
export function formatCurrency(amount: string, currency: string, locale: LocaleInfo): string {
  parseFloat(amount); // Validate amount is a number

  if (locale.currencyFormat) {
    const { symbol, position } = locale.currencyFormat;
    const formattedNumber = formatNumber(amount, locale);

    if (position === 'before') {
      return `${symbol}${formattedNumber}`;
    } else {
      return `${formattedNumber}${symbol}`;
    }
  }

  // Fallback
  return `${currency} ${amount}`;
}

/**
 * Format number according to locale
 */
export function formatNumber(value: string | number, locale: LocaleInfo): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (locale.numberFormat) {
    const { decimalSeparator, groupingSeparator } = locale.numberFormat;

    // Simple formatting - in production use Intl.NumberFormat
    const parts = num.toString().split('.');
    const integerPart = parts[0];
    const decimalPart = parts[1] || '';

    // Add grouping separators (simplified)
    let formattedInteger = integerPart;
    if (groupingSeparator && integerPart.length > 3) {
      formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, groupingSeparator);
    }

    return decimalPart ? `${formattedInteger}${decimalSeparator}${decimalPart}` : formattedInteger;
  }

  return num.toString();
}

/**
 * Format date according to locale
 */
export function formatDate(date: Date | string, locale: LocaleInfo, format: 'short' | 'long' = 'short'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (locale.dateFormat) {
    const formatPattern = format === 'short' ? locale.dateFormat.shortDate : locale.dateFormat.longDate;

    if (formatPattern) {
      // Simple date formatting - in production use a proper date formatter
      const year = dateObj.getFullYear();
      const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      const day = dateObj.getDate().toString().padStart(2, '0');

      return formatPattern
        .replace('yyyy', year.toString())
        .replace('MM', month)
        .replace('dd', day);
    }
  }

  // Fallback to ISO string
  return dateObj.toISOString().split('T')[0];
}

/**
 * I18n capability metadata processor
 */
export function processI18nMetadata(metadata: any): any {
  // Process i18n-specific metadata
  if (metadata.supportedLocales) {
    // Ensure all locales have required fields
    metadata.supportedLocales = metadata.supportedLocales.map((locale: any) => ({
      code: locale.code,
      isRtl: locale.isRtl || false,
      numberFormat: {
        decimalSeparator: locale.numberFormat?.decimalSeparator || '.',
        groupingSeparator: locale.numberFormat?.groupingSeparator || ',',
      },
      currencyFormat: locale.currencyFormat || undefined,
      dateFormat: locale.dateFormat || undefined,
    }));
  }

  return metadata;
}

/**
 * I18n capability metadata validator
 */
export function validateI18nMetadata(metadata: any): boolean {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }

  // Validate version
  if (metadata._version !== '1.0') {
    return false;
  }

  // Validate default locale
  if (!metadata.defaultLocale || typeof metadata.defaultLocale !== 'string') {
    return false;
  }

  // Validate supported locales
  if (!Array.isArray(metadata.supportedLocales)) {
    return false;
  }

  for (const locale of metadata.supportedLocales) {
    if (!locale.code || typeof locale.code !== 'string') {
      return false;
    }
    if (!locale.numberFormat || !locale.numberFormat.decimalSeparator) {
      return false;
    }
  }

  return true;
}