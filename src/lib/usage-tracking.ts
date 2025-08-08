// src/lib/usage-tracking.ts
import { db } from "./firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { v4 as uuidv4 } from "uuid";
import type { SearchUsage, SubscriptionRecord } from "./firestore-schema";

export async function checkSearchLimit(identifier: string): Promise<{
  canSearch: boolean;
  subscription: SubscriptionRecord;
  remainingSearches: number;
  isTrialExpired?: boolean;
  trialDaysRemaining?: number;
}> {
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
    const now = new Date();
    
    // Check trial expiration first
    const currentPeriodEnd = subscription.currentPeriodEnd instanceof Date 
      ? subscription.currentPeriodEnd 
      : new Date(subscription.currentPeriodEnd);
    
    let isTrialExpired = false;
    let trialDaysRemaining = 0;
    
    if (subscription.planId === 'trial') {
      const timeRemaining = currentPeriodEnd.getTime() - now.getTime();
      trialDaysRemaining = Math.max(0, Math.ceil(timeRemaining / (24 * 60 * 60 * 1000)));
      isTrialExpired = timeRemaining <= 0;
      
      if (isTrialExpired) {
        // Update trial status to expired
        await db.collection("subscriptions").doc(identifier).update({
          status: 'trial_expired',
          updated_at: now,
        });
        subscription.status = 'trial_expired';
        
        return {
          canSearch: false,
          subscription,
          remainingSearches: 0,
          isTrialExpired: true,
          trialDaysRemaining: 0,
        };
      }
    }
    
    // Handle daily reset for trial users
    if (subscription.planId === 'trial') {
      const lastResetDate = subscription.lastResetDate instanceof Date 
        ? subscription.lastResetDate 
        : new Date(subscription.lastResetDate);
      
      const isNewDay = now.toDateString() !== lastResetDate.toDateString();
      
      if (isNewDay) {
        // Reset daily usage
        await db.collection("subscriptions").doc(identifier).update({
          searchesUsed: 0,
          lastResetDate: now,
          updated_at: now,
        });
        subscription.searchesUsed = 0;
      }
    }
    
    // Handle monthly reset for paid plans
    if (subscription.planId !== 'trial' && now > currentPeriodEnd) {
      const nextPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      await db.collection("subscriptions").doc(identifier).update({
        searchesUsed: 0,
        enrichmentCostAccrued: 0, // Reset monthly enrichment costs
        lastResetDate: now,
        currentPeriodStart: now,
        currentPeriodEnd: nextPeriodEnd,
        updated_at: now,
      });
      
      subscription.searchesUsed = 0;
      subscription.currentPeriodEnd = nextPeriodEnd;
    }

    const remainingSearches = Math.max(0, (subscription.searchLimit || 0) - (subscription.searchesUsed || 0));
    
    // For paid plans, unlimited searches means we always return canSearch: true
    const canSearch = subscription.planId === 'trial' 
      ? remainingSearches > 0 && !isTrialExpired
      : true; // Paid plans have unlimited basic searches

    return {
      canSearch,
      subscription,
      remainingSearches: subscription.planId === 'trial' ? remainingSearches : 999999, // Show unlimited for paid
      isTrialExpired,
      trialDaysRemaining,
    };
  } catch (error) {
    console.error("Error checking search limit:", error);
    throw error;
  }
}

export async function recordSearchUsage(
  identifier: string,
  locationId: string,
  query: string,
  contactsFound: number,
  contactsImported: number = 0
): Promise<void> {
  try {
    const now = new Date();
    const searchId = uuidv4();
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Record individual search
    const searchUsage: SearchUsage = {
      identifier,
      locationId,
      searchId,
      query,
      contactsFound,
      contactsImported,
      timestamp: now,
      monthYear,
    };

    await db.collection("search_usage").doc(searchId).set(searchUsage);

    // Increment usage count in subscription
    await db.collection("subscriptions").doc(identifier).update({
      searchesUsed: FieldValue.increment(1),
      updated_at: now,
    });

    console.log("Search usage recorded:", {
      identifier,
      query: query.substring(0, 50),
      contactsFound,
    });
  } catch (error) {
    console.error("Error recording search usage:", error);
    throw error;
  }
}

export async function getUsageStats(
  identifier: string,
  monthYear?: string
): Promise<{
  totalSearches: number;
  totalContactsFound: number;
  totalContactsImported: number;
  searches: SearchUsage[];
}> {
  try {
    let query = db
      .collection("search_usage")
      .where("identifier", "==", identifier)
      .orderBy("timestamp", "desc");

    if (monthYear) {
      query = query.where("monthYear", "==", monthYear);
    }

    const snapshot = await query.limit(100).get();
    const searches = snapshot.docs.map(doc => doc.data() as SearchUsage);

    const stats = searches.reduce(
      (acc, search) => ({
        totalSearches: acc.totalSearches + 1,
        totalContactsFound: acc.totalContactsFound + search.contactsFound,
        totalContactsImported: acc.totalContactsImported + search.contactsImported,
      }),
      {
        totalSearches: 0,
        totalContactsFound: 0,
        totalContactsImported: 0,
      }
    );

    return {
      ...stats,
      searches,
    };
  } catch (error) {
    console.error("Error getting usage stats:", error);
    throw error;
  }
}