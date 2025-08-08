// src/pages/api/ghl/webhook.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../lib/firebaseAdmin";
import { GHL_PLANS } from "../../../lib/ghl-billing";
import type { SubscriptionRecord } from "../../../lib/firestore-schema";
import type { GHLMarketplacePayload } from "../../../lib/ghl-types";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const { eventType, data } = req.body;
    
    console.log('GHL Marketplace webhook received:', { eventType, data });

    switch (eventType) {
      case 'subscription.created':
        await handleSubscriptionCreated(data);
        break;
        
      case 'subscription.updated':
        await handleSubscriptionUpdated(data);
        break;
        
      case 'subscription.cancelled':
        await handleSubscriptionCancelled(data);
        break;
        
      case 'subscription.expired':
        await handleSubscriptionExpired(data);
        break;
        
      case 'app.installed':
        await handleAppInstalled(data);
        break;
        
      case 'app.uninstalled':
        await handleAppUninstalled(data);
        break;
        
      default:
        console.log(`Unhandled GHL event type: ${eventType}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("GHL webhook handler error:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
}

async function handleSubscriptionCreated(data: GHLMarketplacePayload['data']) {
  console.log("GHL Subscription created:", data);
  
  const { locationId, plan, subscriptionId, expiresAt } = data;
  
  if (!locationId || !plan) {
    console.error("Missing required subscription data");
    return;
  }

  // Find user by locationId
  const usersSnapshot = await db
    .collection('app_installs')
    .where('locationId', '==', locationId)
    .get();

  if (usersSnapshot.empty) {
    console.error(`No user found for locationId: ${locationId}`);
    return;
  }

  const userDoc = usersSnapshot.docs[0];
  const identifier = userDoc.id;
  
  // Map GHL plan to our plan structure
  const planType = mapGHLPlanToLocal(plan || 'free');
  const localPlan = GHL_PLANS[planType];
  
  // Create or update subscription record
  const subscriptionRecord: SubscriptionRecord = {
    identifier,
    locationId,
    ghlSubscriptionId: subscriptionId,
    planId: localPlan.id,
    planName: localPlan.name,
    status: 'active',
    currentPeriodStart: new Date(),
    currentPeriodEnd: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    
    // New pricing structure
    monthlyFee: localPlan.monthlyFee || 0,
    searchLimit: localPlan.searchLimit || 10,
    searchesUsed: 0,
    enrichmentPrice: localPlan.enrichmentPrice || 0,
    enrichmentsUsed: 0,
    enrichmentCostAccrued: 0,
    
    // White label settings
    isWhiteLabel: false,
    contactLimit: undefined,
    
    lastResetDate: new Date(),
    billingSource: 'ghl_marketplace',
    created_at: new Date(),
    updated_at: new Date(),
  };

  await db.collection("subscriptions").doc(identifier).set(subscriptionRecord);
  
  console.log("GHL Subscription created for:", identifier);
}

async function handleSubscriptionUpdated(data: GHLMarketplacePayload['data']) {
  console.log("GHL Subscription updated:", data);
  
  const { locationId, plan, subscriptionId, expiresAt, status } = data;
  
  const usersSnapshot = await db
    .collection('app_installs')
    .where('locationId', '==', locationId)
    .get();

  if (usersSnapshot.empty) return;
  
  const identifier = usersSnapshot.docs[0].id;
  
  // Update subscription with new plan details
  const planType = mapGHLPlanToLocal(plan || 'free');
  const localPlan = GHL_PLANS[planType];
  
  await db.collection("subscriptions").doc(identifier).update({
    ghlSubscriptionId: subscriptionId,
    planId: localPlan.id,
    planName: localPlan.name,
    status: status === 'active' ? 'active' : 'suspended',
    monthlyFee: localPlan.monthlyFee || 0,
    searchLimit: localPlan.searchLimit || 10,
    enrichmentPrice: localPlan.enrichmentPrice || 0,
    currentPeriodEnd: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    updated_at: new Date(),
  });
  
  console.log("GHL Subscription updated for:", identifier);
}

async function handleSubscriptionCancelled(data: GHLMarketplacePayload['data']) {
  console.log("GHL Subscription cancelled:", data);
  
  const { locationId } = data;
  
  const usersSnapshot = await db
    .collection('app_installs')
    .where('locationId', '==', locationId)
    .get();

  if (usersSnapshot.empty) return;
  
  const identifier = usersSnapshot.docs[0].id;
  
  // Update subscription status to canceled
  await db.collection("subscriptions").doc(identifier).update({
    status: 'canceled',
    updated_at: new Date(),
  });
  
  console.log("GHL Subscription cancelled for:", identifier);
}

async function handleSubscriptionExpired(data: GHLMarketplacePayload['data']) {
  console.log("GHL Subscription expired:", data);
  
  const { locationId } = data;
  
  const usersSnapshot = await db
    .collection('app_installs')
    .where('locationId', '==', locationId)
    .get();

  if (usersSnapshot.empty) return;
  
  const identifier = usersSnapshot.docs[0].id;
  
  // Revert to trial plan
  const trialSubscription: SubscriptionRecord = {
    identifier,
    locationId,
    planId: 'trial',
    planName: '7-Day Free Trial',
    status: 'trial_expired', // Special status for expired trial
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    
    // Trial plan pricing
    monthlyFee: 0,
    searchLimit: 3, // 3 searches per day
    searchesUsed: 0,
    enrichmentPrice: 0,
    enrichmentsUsed: 0,
    enrichmentCostAccrued: 0,
    
    // No white label on trial
    isWhiteLabel: false,
    contactLimit: undefined,
    
    lastResetDate: new Date(),
    billingSource: 'trial',
    created_at: new Date(),
    updated_at: new Date(),
  };
  
  await db.collection("subscriptions").doc(identifier).set(trialSubscription);
  
  console.log("Reverted to trial plan for:", identifier);
}

async function handleAppInstalled(data: GHLMarketplacePayload['data']) {
  console.log("App installed:", data);
  // This might be handled in the OAuth callback instead
}

async function handleAppUninstalled(data: GHLMarketplacePayload['data']) {
  console.log("App uninstalled:", data);
  
  const { locationId } = data;
  
  // Mark user as inactive but don't delete data
  const usersSnapshot = await db
    .collection('app_installs')
    .where('locationId', '==', locationId)
    .get();

  if (!usersSnapshot.empty) {
    const userDoc = usersSnapshot.docs[0];
    await userDoc.ref.update({
      isActive: false,
      updated_at: new Date(),
    });
    
    console.log("User marked inactive for uninstalled app:", userDoc.id);
  }
}

function mapGHLPlanToLocal(ghlPlan: string): keyof typeof GHL_PLANS {
  switch (ghlPlan.toLowerCase()) {
    case 'basic':
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