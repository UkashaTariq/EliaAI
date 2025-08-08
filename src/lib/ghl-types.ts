// src/lib/ghl-types.ts
export interface GHLSubscriptionStatus {
  plan: string;
  status: 'active' | 'canceled' | 'expired' | 'suspended';
  expiresAt?: string;
  subscriptionId?: string;
}

export interface GHLWebhookData {
  eventType: string;
  data: {
    locationId: string;
    plan?: string;
    subscriptionId?: string;
    expiresAt?: string;
    userId?: string;
    status?: string;
    [key: string]: unknown;
  };
}

export interface GHLMarketplacePayload {
  eventType: 'subscription.created' | 'subscription.updated' | 'subscription.cancelled' | 'subscription.expired' | 'app.installed' | 'app.uninstalled';
  data: {
    locationId: string;
    plan?: string;
    subscriptionId?: string;
    expiresAt?: string;
    userId?: string;
    status?: string;
    [key: string]: unknown;
  };
}