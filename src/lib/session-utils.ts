// src/lib/session-utils.ts
import { getIronSession } from "iron-session";
import { NextApiRequest, NextApiResponse } from "next";
import { sessionOptions, SessionData, defaultSession } from "./session";
import { db } from "./firebaseAdmin";
import { v4 as uuidv4 } from "uuid";
import type { UserSession, AppInstall, SubscriptionRecord } from "./firestore-schema";

export async function getSession(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<SessionData>(req, res, sessionOptions);
  
  if (!session.user) {
    session.user = defaultSession.user;
  }
  
  return session;
}

export async function createUserSession(
  identifier: string, 
  locationId: string, 
  req: NextApiRequest
): Promise<string> {
  // First, invalidate any existing active sessions for this user/location
  await invalidateUserSessions(identifier, locationId);
  
  const sessionId = uuidv4();
  
  // Create new session record in Firestore
  const sessionData: UserSession = {
    identifier,
    locationId,
    sessionId,
    isActive: true,
    loginTime: new Date(),
    lastActivity: new Date(),
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'] || 'Unknown',
    created_at: new Date(),
    updated_at: new Date(),
  };

  await db.collection('user_sessions').doc(sessionId).set(sessionData);
  
  return sessionId;
}

export async function validateSession(sessionId: string): Promise<UserSession | null> {
  try {
    const doc = await db.collection('user_sessions').doc(sessionId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    const session = doc.data() as UserSession;
    
    // Check if session is still active and not expired (30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    if (!session.isActive || session.lastActivity < thirtyDaysAgo) {
      // Deactivate expired session
      await db.collection('user_sessions').doc(sessionId).update({
        isActive: false,
        updated_at: new Date(),
      });
      return null;
    }
    
    // Update last activity
    await db.collection('user_sessions').doc(sessionId).update({
      lastActivity: new Date(),
      updated_at: new Date(),
    });
    
    return session;
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

export async function invalidateUserSessions(identifier: string, locationId: string) {
  try {
    const sessions = await db
      .collection('user_sessions')
      .where('identifier', '==', identifier)
      .where('locationId', '==', locationId)
      .where('isActive', '==', true)
      .get();
    
    const batch = db.batch();
    
    sessions.docs.forEach(doc => {
      batch.update(doc.ref, {
        isActive: false,
        updated_at: new Date(),
      });
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Error invalidating sessions:', error);
  }
}

export async function checkLocationChange(
  currentLocationId: string, 
  sessionLocationId: string
): Promise<boolean> {
  return currentLocationId !== sessionLocationId;
}

export async function getUserWithSubscription(identifier: string) {
  try {
    // Get user data
    const userDoc = await db.collection('app_installs').doc(identifier).get();
    if (!userDoc.exists) {
      return null;
    }
    
    const userData = userDoc.data() as AppInstall;
    
    // Get subscription data
    const subscriptionDoc = await db
      .collection('subscriptions')
      .doc(identifier)
      .get();
    
    let subscriptionData: SubscriptionRecord | null = null;
    
    if (subscriptionDoc.exists) {
      subscriptionData = subscriptionDoc.data() as SubscriptionRecord;
      
      // Check if we need to sync with GHL marketplace
      if (subscriptionData.billingSource === 'ghl_marketplace' && userData.access_token) {
        await syncWithGHLMarketplace(userData, subscriptionData);
      }
    } else {
      // Create trial subscription
      const trialStartDate = new Date();
      const trialEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      subscriptionData = {
        identifier,
        locationId: userData.locationId,
        planId: 'trial',
        planName: '7-Day Free Trial',
        status: 'trial', // Special trial status
        currentPeriodStart: trialStartDate,
        currentPeriodEnd: trialEndDate,
        
        // Platform Access (Trial has no monthly fee)
        monthlyFee: 0,
        
        // Search Limits (Trial has 3 searches per day)
        searchLimit: 3,
        searchesUsed: 0,
        
        // Enrichment Usage & Billing (Trial cannot use enrichment)
        enrichmentPrice: 0,
        enrichmentsUsed: 0,
        enrichmentCostAccrued: 0,
        
        // White Label (Trial is never white label)
        isWhiteLabel: false,
        
        lastResetDate: trialStartDate,
        billingSource: 'trial',
        created_at: new Date(),
        updated_at: new Date(),
      };
      
      await db.collection('subscriptions').doc(identifier).set(subscriptionData);
    }
    
    return {
      user: userData,
      subscription: subscriptionData,
    };
  } catch (error) {
    console.error('Error getting user with subscription:', error);
    return null;
  }
}

// Sync subscription status with GHL marketplace
async function syncWithGHLMarketplace(
  userData: AppInstall, 
  subscriptionData: SubscriptionRecord
): Promise<void> {
  try {
    const { createGHLBillingService } = await import('./ghl-billing');
    const billingService = createGHLBillingService(userData.access_token);
    
    const marketplaceStatus = await billingService.getSubscriptionStatus(userData.locationId);
    
    // Update subscription if marketplace status differs
    if (marketplaceStatus.planType !== subscriptionData.planId.toUpperCase()) {
      const { GHL_PLANS } = await import('./ghl-billing');
      const newPlan = GHL_PLANS[marketplaceStatus.planType];
      
      await db.collection('subscriptions').doc(userData.identifier).update({
        planId: newPlan.id,
        planName: newPlan.name,
        status: marketplaceStatus.isActive ? 'active' : 'expired',
        searchLimit: newPlan.searchLimit,
        currentPeriodEnd: marketplaceStatus.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        updated_at: new Date(),
      });
      
      console.log(`Synced subscription for ${userData.identifier} to ${newPlan.name}`);
    }
  } catch (error) {
    console.error('Error syncing with GHL marketplace:', error);
  }
}

// Cleanup old inactive sessions (should be run periodically)
export async function cleanupInactiveSessions() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const oldSessions = await db
      .collection('user_sessions')
      .where('lastActivity', '<', thirtyDaysAgo)
      .get();

    if (oldSessions.empty) {
      return { deletedCount: 0 };
    }

    const batch = db.batch();
    oldSessions.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    console.log(`Cleaned up ${oldSessions.size} inactive sessions`);
    return { deletedCount: oldSessions.size };
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
    throw error;
  }
}

// Get active session count for a user (for monitoring)
export async function getActiveSessionCount(identifier: string): Promise<number> {
  try {
    const sessions = await db
      .collection('user_sessions')
      .where('identifier', '==', identifier)
      .where('isActive', '==', true)
      .get();
    
    return sessions.size;
  } catch (error) {
    console.error('Error getting session count:', error);
    return 0;
  }
}

function getClientIP(req: NextApiRequest): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    (req.headers['x-real-ip'] as string) ||
    req.connection?.remoteAddress ||
    'Unknown'
  );
}