// src/pages/api/ghl/switch-plan.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "../../../lib/session-utils";
import { db } from "../../../lib/firebaseAdmin";
import { GHL_PLANS } from "../../../lib/ghl-billing";

interface SwitchPlanRequest {
  newPlanId: 'starter' | 'pro' | 'enterprise';
  returnUrl?: string;
  cancelUrl?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getSession(req, res);
    
    if (!session.user?.isLoggedIn) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { newPlanId, returnUrl, cancelUrl } = req.body as SwitchPlanRequest;
    
    if (!newPlanId) {
      return res.status(400).json({ error: "New plan ID is required" });
    }

    // Get user data and current subscription
    const userDoc = await db.collection('app_installs').doc(session.user.identifier).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userDoc.data();
    
    if (!userData?.access_token) {
      return res.status(400).json({ error: "No access token found" });
    }

    // Get current subscription
    const subscriptionDoc = await db
      .collection("subscriptions")
      .doc(session.user.identifier)
      .get();

    if (!subscriptionDoc.exists) {
      return res.status(404).json({ error: "No subscription found" });
    }

    const currentSubscription = subscriptionDoc.data();
    const locationId = session.user.locationId;
    
    // Check if user is on trial - if so, this is an upgrade, not a switch
    if (currentSubscription?.planId === 'trial') {
      // For trial users, redirect to subscription flow
      const subscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/ghl/subscribe`;
      
      const subscribeResponse = await fetch(subscribeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': req.headers.cookie || '',
        },
        body: JSON.stringify({
          planId: newPlanId,
          returnUrl,
          cancelUrl,
        }),
      });
      
      if (subscribeResponse.ok) {
        const subscribeData = await subscribeResponse.json();
        return res.status(200).json({
          ...subscribeData,
          isUpgradeFromTrial: true,
        });
      } else {
        const error = await subscribeResponse.text();
        return res.status(400).json({ error: "Failed to create subscription", details: error });
      }
    }
    
    // For existing paid subscribers, handle plan switching
    if (!currentSubscription?.ghlSubscriptionId) {
      return res.status(400).json({ error: "No GHL subscription ID found" });
    }

    const newPlan = GHL_PLANS[newPlanId.toUpperCase() as keyof typeof GHL_PLANS];
    
    if (!newPlan) {
      return res.status(400).json({ error: "Invalid plan ID" });
    }

    // Call GHL API to update subscription
    const updateResponse = await fetch(
      `https://services.leadconnectorhq.com/subscriptions/${currentSubscription.ghlSubscriptionId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${userData.access_token}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: newPlanId,
          locationId: locationId,
          // Include any plan-specific parameters
          monthlyFee: newPlan.monthlyFee,
          enrichmentPrice: newPlan.enrichmentPrice,
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('GHL plan switch failed:', errorText);
      
      // If GHL API fails, we might still want to create a change URL
      const appId = process.env.GOHIGHLEVEL_APP_ID;
      
      if (appId) {
        const changeUrl = `https://marketplace.gohighlevel.com/change-plan`;
        const params = new URLSearchParams({
          appId,
          locationId,
          currentPlanId: currentSubscription.planId,
          newPlanId,
          subscriptionId: currentSubscription.ghlSubscriptionId,
          returnUrl: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/subscription?changed=success`,
          cancelUrl: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/subscription?changed=cancelled`,
        });

        return res.status(200).json({
          changeUrl: `${changeUrl}?${params.toString()}`,
          requiresManualApproval: true,
          message: "Plan change requires approval through GHL marketplace",
        });
      }
      
      return res.status(400).json({
        error: "Failed to switch plan with GHL",
        details: errorText,
      });
    }

    const updateData = await updateResponse.json();
    
    // Update local subscription
    await db.collection("subscriptions").doc(session.user.identifier).update({
      planId: newPlanId,
      planName: newPlan.name,
      monthlyFee: newPlan.monthlyFee,
      enrichmentPrice: newPlan.enrichmentPrice,
      updated_at: new Date(),
    });

    console.log('Plan switched successfully:', {
      identifier: session.user.identifier,
      fromPlan: currentSubscription.planId,
      toPlan: newPlanId,
    });

    return res.status(200).json({
      success: true,
      message: "Plan switched successfully",
      newPlan: {
        id: newPlanId,
        name: newPlan.name,
        monthlyFee: newPlan.monthlyFee,
        enrichmentPrice: newPlan.enrichmentPrice,
      },
      updateData,
    });
  } catch (error) {
    console.error("Plan switch error:", error);
    return res.status(500).json({
      error: "Failed to switch plan",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}