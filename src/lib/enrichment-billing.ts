// src/lib/enrichment-billing.ts
import { db } from "./firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";
import type { SubscriptionRecord, EnrichmentUsage } from "./firestore-schema";
import { GHL_PLANS } from "./ghl-billing";

// Core enrichment costs based on EXA pricing
export const ENRICHMENT_COSTS = {
  SEARCH: 0.005, // $5 per 1,000 searches
  EMAIL: 0.50,   // 5 credits @ $0.10
  PHONE: 0.50,   // 5 credits @ $0.10  
  INSIGHTS: 0.20, // 2 credits @ $0.10
  TOTAL_PER_CONTACT: 1.20, // Total enrichment cost per contact
} as const;

export interface EnrichmentOptions {
  includeEmail: boolean;
  includePhone: boolean;
  includeInsights: boolean;
}

export interface EnrichmentQuote {
  canAfford: boolean;
  costPerContact: number;
  totalCost: number;
  contactCount: number;
  subscription: SubscriptionRecord;
  remainingBudget?: number;
  planLimits?: {
    isWithinLimits: boolean;
    contactLimit?: number;
    contactsUsed: number;
  };
}

export async function getEnrichmentQuote(
  identifier: string,
  contactCount: number,
  _options: EnrichmentOptions
): Promise<EnrichmentQuote> {
  try {
    // Get current subscription
    const subscriptionDoc = await db
      .collection("subscriptions")
      .doc(identifier)
      .get();

    if (!subscriptionDoc.exists) {
      throw new Error("No subscription found");
    }

    const subscription = subscriptionDoc.data() as SubscriptionRecord;
    const plan = GHL_PLANS[subscription.planId.toUpperCase() as keyof typeof GHL_PLANS];

    if (!plan) {
      throw new Error("Invalid plan");
    }

    // Trial plan cannot do enrichment
    if (plan.isTrial || subscription.planId === 'trial') {
      return {
        canAfford: false,
        costPerContact: 0,
        totalCost: 0,
        contactCount,
        subscription,
      };
    }

    // Calculate cost per contact based on selected options
    const costPerContact = plan.enrichmentPrice || 0;

    // For white label plans, check contact limits
    if (subscription.isWhiteLabel && subscription.contactLimit) {
      const contactsUsed = subscription.enrichmentsUsed;
      const remainingContacts = subscription.contactLimit - contactsUsed;
      
      return {
        canAfford: remainingContacts >= contactCount,
        costPerContact: 0, // White label plans are prepaid
        totalCost: 0,
        contactCount,
        subscription,
        planLimits: {
          isWithinLimits: remainingContacts >= contactCount,
          contactLimit: subscription.contactLimit,
          contactsUsed,
        },
      };
    }

    // Pay-per-use plans - calculate total cost
    const totalCost = costPerContact * contactCount;

    return {
      canAfford: true, // No credit limits for pay-per-use
      costPerContact,
      totalCost,
      contactCount,
      subscription,
    };
  } catch (error) {
    console.error("Error getting enrichment quote:", error);
    throw error;
  }
}

export async function recordEnrichmentUsage(
  identifier: string,
  locationId: string,
  contactsEnriched: number,
  enrichmentTypes: string[],
  searchId?: string
): Promise<void> {
  try {
    const now = new Date();
    const enrichmentId = uuidv4();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get current subscription to determine cost
    const subscriptionDoc = await db
      .collection("subscriptions")
      .doc(identifier)
      .get();

    if (!subscriptionDoc.exists) {
      throw new Error("No subscription found for enrichment billing");
    }

    const subscription = subscriptionDoc.data() as SubscriptionRecord;
    const costPerContact = subscription.enrichmentPrice;
    const totalCost = costPerContact * contactsEnriched;

    // Record individual enrichment usage
    const enrichmentUsage: EnrichmentUsage = {
      identifier,
      locationId,
      enrichmentId,
      searchId,
      contactsEnriched,
      enrichmentTypes,
      costPerContact,
      totalCost,
      timestamp: now,
      monthYear,
      planId: subscription.planId,
    };

    await db.collection("enrichment_usage").doc(enrichmentId).set(enrichmentUsage);

    // Update subscription usage counters
    await db.collection("subscriptions").doc(identifier).update({
      enrichmentsUsed: FieldValue.increment(contactsEnriched),
      enrichmentCostAccrued: FieldValue.increment(totalCost),
      updated_at: now,
    });

    console.log("Enrichment usage recorded:", {
      identifier,
      contactsEnriched,
      totalCost,
      enrichmentId,
    });
  } catch (error) {
    console.error("Error recording enrichment usage:", error);
    throw error;
  }
}

export async function getEnrichmentUsageStats(
  identifier: string,
  monthYear?: string
): Promise<{
  totalEnrichments: number;
  totalCost: number;
  enrichmentHistory: EnrichmentUsage[];
}> {
  try {
    let query = db
      .collection("enrichment_usage")
      .where("identifier", "==", identifier)
      .orderBy("timestamp", "desc");

    if (monthYear) {
      query = query.where("monthYear", "==", monthYear);
    }

    const snapshot = await query.limit(100).get();
    const enrichmentHistory = snapshot.docs.map(doc => doc.data() as EnrichmentUsage);

    const stats = enrichmentHistory.reduce(
      (acc, enrichment) => ({
        totalEnrichments: acc.totalEnrichments + enrichment.contactsEnriched,
        totalCost: acc.totalCost + enrichment.totalCost,
      }),
      {
        totalEnrichments: 0,
        totalCost: 0,
      }
    );

    return {
      ...stats,
      enrichmentHistory,
    };
  } catch (error) {
    console.error("Error getting enrichment stats:", error);
    throw error;
  }
}

// Check if user can perform enrichment (for UI)
export async function canUserEnrich(identifier: string): Promise<{
  canEnrich: boolean;
  reason?: string;
  plan?: typeof GHL_PLANS[keyof typeof GHL_PLANS];
}> {
  try {
    const subscriptionDoc = await db
      .collection("subscriptions")
      .doc(identifier)
      .get();

    if (!subscriptionDoc.exists) {
      return { canEnrich: false, reason: "No subscription found" };
    }

    const subscription = subscriptionDoc.data() as SubscriptionRecord;
    const plan = GHL_PLANS[subscription.planId.toUpperCase() as keyof typeof GHL_PLANS];

    if (plan?.isTrial || subscription.planId === 'trial') {
      return { 
        canEnrich: false, 
        reason: "Enrichment requires a paid subscription", 
        plan 
      };
    }

    if (subscription.status !== "active") {
      return { 
        canEnrich: false, 
        reason: "Subscription is not active", 
        plan 
      };
    }

    // Check white label limits
    if (subscription.isWhiteLabel && subscription.contactLimit) {
      const remainingContacts = subscription.contactLimit - subscription.enrichmentsUsed;
      if (remainingContacts <= 0) {
        return { 
          canEnrich: false, 
          reason: "Contact limit reached for this billing period", 
          plan 
        };
      }
    }

    return { canEnrich: true, plan };
  } catch (error) {
    console.error("Error checking enrichment eligibility:", error);
    return { canEnrich: false, reason: "Error checking subscription" };
  }
}