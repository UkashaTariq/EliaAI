// src/lib/firestore-schema.ts
export interface AppInstall {
  identifier: string;
  access_token: string;
  refresh_token?: string;
  locationId: string;
  userId?: string;
  email?: string;
  name?: string;
  locationName?: string;
  locationAddress?: string;
  scopes: string;
  token_type: string;
  expires_in?: number;
  created_at: Date;
  updated_at: Date;
  last_login: Date;
  isActive: boolean;
}

export interface UserSession {
  identifier: string;
  locationId: string;
  sessionId: string;
  isActive: boolean;
  loginTime: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionRecord {
  identifier: string;
  locationId: string;
  ghlSubscriptionId?: string; // GHL marketplace subscription ID
  planId: string;
  planName: string;
  status: "active" | "canceled" | "expired" | "suspended" | "trial" | "trial_expired";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  
  // Platform Access (Monthly Fee)
  monthlyFee: number; // Platform access fee
  
  // Search Limits (Basic searches are unlimited for paid plans)
  searchLimit: number; // Basic search limit (unlimited for paid plans = 1000)
  searchesUsed: number;
  
  // Enrichment Usage & Billing
  enrichmentPrice: number; // Price per enriched contact
  enrichmentsUsed: number; // Total enrichments this period
  enrichmentCostAccrued: number; // Total cost accrued this period
  
  // White Label (if applicable)
  isWhiteLabel: boolean;
  contactLimit?: number; // For white label plans with fixed contact limits
  
  lastResetDate: Date;
  billingSource: "ghl_marketplace" | "trial";
  created_at: Date;
  updated_at: Date;
}

export interface SearchUsage {
  identifier: string;
  locationId: string;
  searchId: string;
  query: string;
  contactsFound: number;
  contactsImported: number;
  timestamp: Date;
  monthYear: string; // Format: "2024-01" for aggregation
}

export interface EnrichmentUsage {
  identifier: string;
  locationId: string;
  enrichmentId: string;
  searchId?: string; // Link to originating search
  contactsEnriched: number;
  enrichmentTypes: string[]; // ['email', 'phone', 'insights']
  costPerContact: number;
  totalCost: number;
  timestamp: Date;
  monthYear: string;
  planId: string;
}

export interface SearchHistory {
  identifier: string;
  locationId: string;
  searchId: string;
  query: string;
  timestamp: Date;
  contactsFound: number;
  contacts: Contact[]; // Store the actual contact results
  searchType: 'manual' | 'refresh';
  created_at: Date;
}

export interface ImportHistory {
  identifier: string;
  locationId: string;
  importId: string;
  searchId: string; // Link to the search that generated these contacts
  query: string; // Original search query
  listName: string;
  contactsImported: number;
  contacts: Contact[]; // Contacts that were imported
  timestamp: Date;
  ghlResponse?: Record<string, unknown>; // Response from GHL import API
  created_at: Date;
}

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
}