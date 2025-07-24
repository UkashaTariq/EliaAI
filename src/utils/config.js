// src/utils/config.js

// Environment configuration
export const API_CONFIG = {
  // Exa.ai Configuration
  EXA_API_KEY: process.env.NEXT_PUBLIC_EXA_API_KEY || process.env.REACT_APP_EXA_API_KEY,
  EXA_API_URL: process.env.EXA_API_URL || 'https://api.exa.ai',

  // GoHighLevel Configuration
  GHL_CLIENT_ID: process.env.NEXT_PUBLIC_GHL_CLIENT_ID || process.env.REACT_APP_GHL_CLIENT_ID,
  GHL_CLIENT_SECRET: process.env.GHL_CLIENT_SECRET,
  GHL_API_URL: process.env.GHL_API_URL || 'https://services.leadconnectorhq.com',
  GHL_REDIRECT_URI: process.env.GHL_REDIRECT_URI || 
    (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : ''),

  // App Configuration
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || 
    (typeof window !== 'undefined' ? window.location.origin : ''),
  APP_NAME: 'Contact Finder',
  APP_VERSION: '1.0.0',

  // Feature Flags
  FEATURES: {
    MOCK_DATA: process.env.NODE_ENV === 'development' || 
      process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true',
    DEBUG_MODE: process.env.NODE_ENV === 'development',
    ANALYTICS: process.env.NODE_ENV === 'production'
  }
};

// Search Configuration
export const SEARCH_CONFIG = {
  DEFAULT_RESULTS_COUNT: 20,
  MAX_RESULTS_COUNT: 50,
  SEARCH_TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second

  // Default search parameters for Exa.ai
  DEFAULT_SEARCH_PARAMS: {
    type: 'neural',
    useAutoprompt: true,
    contents: {
      text: true,
      highlights: true,
      summary: true
    },
    includeDomains: [],
    excludeDomains: [
      'facebook.com',
      'twitter.com',
      'instagram.com',
      'tiktok.com',
      'youtube.com'
    ]
  },

  // Business type specific configurations
  BUSINESS_TYPES: {
    'car dealers': {
      keywords: ['dealership', 'auto', 'car', 'vehicle', 'automotive'],
      includeDomains: ['cars.com', 'autotrader.com', 'cargurus.com'],
      category: 'Automotive'
    },
    'restaurants': {
      keywords: ['restaurant', 'dining', 'food', 'cuisine', 'eatery'],
      includeDomains: ['yelp.com', 'opentable.com', 'tripadvisor.com'],
      category: 'Food & Beverage'
    },
    'real estate': {
      keywords: ['realtor', 'real estate', 'property', 'homes', 'broker'],
      includeDomains: ['zillow.com', 'realtor.com', 'redfin.com'],
      category: 'Real Estate'
    },
    'medical': {
      keywords: ['doctor', 'medical', 'healthcare', 'clinic', 'physician'],
      includeDomains: ['healthgrades.com', 'vitals.com', 'zocdoc.com'],
      category: 'Healthcare'
    },
    'tech': {
      keywords: ['technology', 'software', 'tech', 'IT', 'startup'],
      includeDomains: ['crunchbase.com', 'linkedin.com'],
      category: 'Technology'
    }
  }
};

// GoHighLevel Configuration
export const GHL_CONFIG = {
  SCOPES: [
    'contacts.write',
    'contacts.read',
    'locations.read',
    'users.read'
  ],
  
  API_VERSION: '2021-07-28',
  
  CUSTOM_FIELDS: {
    BUSINESS_CATEGORY: 'business_category',
    RATING: 'rating',
    DESCRIPTION: 'description',
    IMPORT_SOURCE: 'import_source',
    IMPORT_DATE: 'import_date',
    EXA_SEARCH_QUERY: 'exa_search_query'
  },

  TAGS: {
    EXA_IMPORT: 'EXA_IMPORT',
    AUTO_GENERATED: 'AUTO_GENERATED'
  },

  CONTACT_SOURCE: 'EXA_AI_IMPORT'
};

// UI Configuration
export const UI_CONFIG = {
  COLORS: {
    PRIMARY: '#3b82f6',
    SUCCESS: '#10b981',
    WARNING: '#f59e0b',
    ERROR: '#ef4444',
    GRAY: '#6b7280'
  },

  ANIMATIONS: {
    DURATION: 200,
    EASING: 'ease-in-out'
  },

  BREAKPOINTS: {
    SM: '640px',
    MD: '768px',
    LG: '1024px',
    XL: '1280px'
  },

  MODAL: {
    MAX_WIDTH: '6xl',
    MAX_HEIGHT: '90vh'
  }
};

// Validation Rules
export const VALIDATION_RULES = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[\+]?[1-9][\d]{0,15}$/,
  URL: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
  
  SMART_LIST_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z0-9\s\-_]+$/
  },

  SEARCH_QUERY: {
    MIN_LENGTH: 3,
    MAX_LENGTH: 200
  }
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  AUTHENTICATION_ERROR: 'Authentication failed. Please log in again.',
  SEARCH_ERROR: 'Search failed. Please try again with different keywords.',
  IMPORT_ERROR: 'Failed to import contacts. Please try again.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  RATE_LIMIT_ERROR: 'Too many requests. Please wait a moment and try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_PHONE: 'Please enter a valid phone number',
  INVALID_SMART_LIST_NAME: 'Smart list name can only contain letters, numbers, spaces, hyphens, and underscores'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  SEARCH_COMPLETE: 'Search completed successfully',
  IMPORT_COMPLETE: 'Contacts imported successfully',
  AUTHENTICATION_SUCCESS: 'Authentication successful',
  SMART_LIST_CREATED: 'Smart list created successfully'
};

// Loading Messages
export const LOADING_MESSAGES = {
  SEARCHING: 'Searching for contacts...',
  IMPORTING: 'Importing contacts to GoHighLevel...',
  AUTHENTICATING: 'Authenticating with GoHighLevel...',
  CREATING_SMART_LIST: 'Creating smart list...'
};

// Default Values
export const DEFAULTS = {
  SMART_LIST_NAME: '',
  SEARCH_QUERY: '',
  RESULTS_PER_PAGE: 10,
  CONTACT_RATING: 0,
  CONTACT_CATEGORY: 'Business'
};

// Development helpers
export const isDevelopment = () => process.env.NODE_ENV === 'development';
export const isProduction = () => process.env.NODE_ENV === 'production';

// Environment validation
export const validateEnvironment = () => {
  const requiredVars = {
    'EXA_API_KEY': API_CONFIG.EXA_API_KEY,
    'GHL_CLIENT_ID': API_CONFIG.GHL_CLIENT_ID
  };

  const missing = Object.entries(requiredVars)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    console.warn(`Missing environment variables: ${missing.join(', ')}`);
    if (isProduction()) {
      throw new Error(`Required environment variables are missing: ${missing.join(', ')}`);
    }
  }

  return {
    isValid: missing.length === 0,
    missing
  };
};

// Storage helpers
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'ghl_access_token',
  REFRESH_TOKEN: 'ghl_refresh_token',
  TOKEN_EXPIRY: 'ghl_token_expiry',
  USER_PREFERENCES: 'user_preferences',
  SEARCH_HISTORY: 'search_history'
};

export default {
  API_CONFIG,
  SEARCH_CONFIG,
  GHL_CONFIG,
  UI_CONFIG,
  VALIDATION_RULES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  LOADING_MESSAGES,
  DEFAULTS,
  STORAGE_KEYS,
  isDevelopment,
  isProduction,
  validateEnvironment
};