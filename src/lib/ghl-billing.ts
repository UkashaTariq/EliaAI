// src/lib/ghl-billing.ts
import type { GHLMarketplacePayload } from './ghl-types';

export const GHL_PLANS = {
  TRIAL: {
    id: "trial",
    name: "7-Day Free Trial",
    monthlyFee: 0,
    enrichmentPrice: 0, // No enrichment during trial
    searchLimit: 3, // 3 searches per day during trial
    searchLimitPeriod: "daily", // Daily limit instead of monthly
    trialDays: 7,
    description: "7-day free trial • 3 searches per day • No contact enrichment • Basic search only",
    features: [
      "3 basic searches per day",
      "7-day trial period",
      "No contact enrichment",
      "Standard support"
    ],
    isTrial: true,
    requiresUpgrade: true,
  },
  STARTER: {
    id: "starter",
    name: "Starter Plan",
    monthlyFee: 29,
    enrichmentPrice: 1.25, // $1.25 per enriched contact
    searchLimit: 1000, // Unlimited searches, pay per enrichment
    description: "$29/month platform access • $1.25 per enriched contact • Perfect for small agencies",
    features: [
      "Unlimited basic searches",
      "Full contact enrichment (email, phone, insights)",
      "$1.25 per enriched contact",
      "Search history & exports",
      "Priority support"
    ],
    isTrial: false,
    payPerUse: true,
  },
  PRO: {
    id: "pro",
    name: "Pro Plan", 
    monthlyFee: 99,
    enrichmentPrice: 0.85, // $0.85 per enriched contact
    searchLimit: 1000, // Unlimited searches, pay per enrichment
    description: "$99/month platform access • $0.85 per enriched contact • Best for growing agencies",
    features: [
      "Unlimited basic searches",
      "Full contact enrichment (email, phone, insights)",
      "$0.85 per enriched contact (32% savings)",
      "Search history & exports", 
      "Advanced filtering & targeting",
      "Priority support"
    ],
    isTrial: false,
    payPerUse: true,
  },
  ENTERPRISE: {
    id: "enterprise", 
    name: "Enterprise Plan",
    monthlyFee: 199,
    enrichmentPrice: 0.75, // $0.75 per enriched contact
    searchLimit: 1000, // Unlimited searches, pay per enrichment
    description: "$199/month platform access • $0.75 per enriched contact • For high-volume agencies",
    features: [
      "Unlimited basic searches",
      "Full contact enrichment (email, phone, insights)",
      "$0.75 per enriched contact (40% savings)",
      "Search history & exports",
      "Advanced filtering & targeting",
      "White-label options",
      "Dedicated account manager",
      "Priority support & training"
    ],
    isTrial: false,
    payPerUse: true,
  },
} as const;

export type PlanType = keyof typeof GHL_PLANS;

// White Label Pricing for Agencies (Reseller Model)
export const WHITE_LABEL_PLANS = {
  STARTER_WL: {
    id: "starter_wl",
    name: "White Label Starter",
    contactLimit: 100,
    eliaCost: 120.50,
    agencyCost: 172.14,
    eliaProfit: 51.64,
    suggestedResell: 275.43,
    agencyProfit: 103.29,
    description: "100 enriched contacts/month • 30% Elia margin • 40% agency markup potential",
    features: [
      "100 enriched contacts per month",
      "Full white-label branding",
      "Agency dashboard access",
      "Reseller support"
    ]
  },
  PRO_WL: {
    id: "pro_wl", 
    name: "White Label Pro",
    contactLimit: 250,
    eliaCost: 301.25,
    agencyCost: 430.36,
    eliaProfit: 129.11,
    suggestedResell: 688.57,
    agencyProfit: 258.21,
    description: "250 enriched contacts/month • 30% Elia margin • 37% agency markup potential",
    features: [
      "250 enriched contacts per month",
      "Full white-label branding",
      "Agency dashboard access",
      "Priority reseller support",
      "Custom onboarding"
    ]
  },
  ELITE_WL: {
    id: "elite_wl",
    name: "White Label Elite", 
    contactLimit: 500,
    eliaCost: 602.50,
    agencyCost: 860.71,
    eliaProfit: 258.21,
    suggestedResell: 1377.14,
    agencyProfit: 516.43,
    description: "500 enriched contacts/month • 30% Elia margin • 37% agency markup potential",
    features: [
      "500 enriched contacts per month",
      "Full white-label branding", 
      "Agency dashboard access",
      "Dedicated account manager",
      "Custom integrations",
      "Advanced reporting"
    ]
  }
} as const;

export type WhiteLabelPlanType = keyof typeof WHITE_LABEL_PLANS;

// GHL Marketplace Billing API Integration
export class GHLBillingService {
  private baseUrl = "https://services.leadconnectorhq.com";
  
  constructor(private accessToken: string) {}

  // Check if user has an active subscription through GHL marketplace
  async getSubscriptionStatus(locationId: string): Promise<{
    hasSubscription: boolean;
    planType: PlanType;
    isActive: boolean;
    expiresAt?: Date;
  }> {
    try {
      // GHL marketplace apps can check billing status through the app installation API
      const response = await fetch(`${this.baseUrl}/apps/subscription/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locationId,
          appId: process.env.GOHIGHLEVEL_APP_ID,
        }),
      });

      if (!response.ok) {
        console.log('No active subscription found');
        return {
          hasSubscription: false,
          planType: 'TRIAL',
          isActive: false,
        };
      }

      const data = await response.json();
      
      // Map GHL subscription response to our plan types
      const planType = this.mapGHLPlanToLocal(data.plan);
      
      return {
        hasSubscription: true,
        planType,
        isActive: data.status === 'active',
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      };
    } catch (error) {
      console.error('Error checking GHL subscription:', error);
      return {
        hasSubscription: false,
        planType: 'TRIAL',
        isActive: false,
      };
    }
  }

  // Create a subscription upgrade URL for GHL marketplace
  async createUpgradeUrl(locationId: string, planType: PlanType): Promise<string> {
    if (planType === 'TRIAL') {
      throw new Error('Cannot create upgrade URL for trial plan');
    }

    const plan = GHL_PLANS[planType];
    
    // GHL marketplace upgrade URL format
    const upgradeUrl = `https://marketplace.leadconnectorhq.com/apps/${process.env.GOHIGHLEVEL_APP_ID}/upgrade`;
    
    const params = new URLSearchParams({
      locationId,
      plan: plan.id,
      monthlyFee: plan.monthlyFee.toString(),
      enrichmentPrice: plan.enrichmentPrice.toString(),
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgrade=success`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgrade=canceled`,
    });

    return `${upgradeUrl}?${params.toString()}`;
  }

  // Handle GHL marketplace webhook for subscription events
  async handleMarketplaceWebhook(payload: GHLMarketplacePayload): Promise<void> {
    const { eventType, data } = payload;
    
    switch (eventType) {
      case 'subscription.created':
        await this.handleSubscriptionCreated(data);
        break;
      case 'subscription.updated':
        await this.handleSubscriptionUpdated(data);
        break;
      case 'subscription.cancelled':
        await this.handleSubscriptionCancelled(data);
        break;
      case 'subscription.expired':
        await this.handleSubscriptionExpired(data);
        break;
      default:
        console.log(`Unhandled marketplace event: ${eventType}`);
    }
  }

  private async handleSubscriptionCreated(data: GHLMarketplacePayload['data']): Promise<void> {
    console.log('GHL Subscription created:', data);
    // This would be handled in the webhook endpoint
  }

  private async handleSubscriptionUpdated(data: GHLMarketplacePayload['data']): Promise<void> {
    console.log('GHL Subscription updated:', data);
    // This would be handled in the webhook endpoint
  }

  private async handleSubscriptionCancelled(data: GHLMarketplacePayload['data']): Promise<void> {
    console.log('GHL Subscription cancelled:', data);
    // This would be handled in the webhook endpoint
  }

  private async handleSubscriptionExpired(data: GHLMarketplacePayload['data']): Promise<void> {
    console.log('GHL Subscription expired:', data);
    // This would be handled in the webhook endpoint
  }

  private mapGHLPlanToLocal(ghlPlan: string): PlanType {
    // Map GHL marketplace plan IDs to our local plan types
    switch (ghlPlan.toLowerCase()) {
      case 'starter':
        return 'STARTER';
      case 'pro':
      case 'professional':
        return 'PRO';
      case 'enterprise':
        return 'ENTERPRISE';
      default:
        return 'TRIAL';
    }
  }
}

// Helper function to get billing service instance
export function createGHLBillingService(accessToken: string): GHLBillingService {
  return new GHLBillingService(accessToken);
}