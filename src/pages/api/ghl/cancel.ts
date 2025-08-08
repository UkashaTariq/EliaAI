// src/pages/api/ghl/cancel.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "../../../lib/session-utils";
import { db } from "../../../lib/firebaseAdmin";
import { getValidAccessToken } from "../../../lib/token-refresh";

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

    // Get valid access token (with automatic refresh if needed)
    const validAccessToken = await getValidAccessToken(session.user.identifier);
    
    if (!validAccessToken) {
      return res.status(401).json({ 
        error: "Invalid or expired access token",
        tokenExpired: true,
        message: "Please re-authenticate with GoHighLevel"
      });
    }

    // Get current subscription
    const subscriptionDoc = await db
      .collection("subscriptions")
      .doc(session.user.identifier)
      .get();

    if (!subscriptionDoc.exists) {
      return res.status(404).json({ error: "No subscription found" });
    }

    const subscription = subscriptionDoc.data();
    
    if (!subscription?.ghlSubscriptionId) {
      return res.status(400).json({ error: "No GHL subscription ID found" });
    }

    // Call GHL API to cancel subscription
    const cancelResponse = await fetch(
      `https://services.leadconnectorhq.com/subscriptions/${subscription.ghlSubscriptionId}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${validAccessToken}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!cancelResponse.ok) {
      const errorText = await cancelResponse.text();
      console.error('GHL cancellation failed:', errorText);
      
      // Even if GHL API fails, update our local status
      await db.collection("subscriptions").doc(session.user.identifier).update({
        status: 'cancelled',
        updated_at: new Date(),
      });
      
      return res.status(400).json({
        error: "Failed to cancel subscription with GHL",
        details: errorText,
        localStatusUpdated: true
      });
    }

    const cancelData = await cancelResponse.json();
    
    // Update local subscription status
    await db.collection("subscriptions").doc(session.user.identifier).update({
      status: 'cancelled',
      updated_at: new Date(),
    });

    console.log('Subscription cancelled successfully:', {
      identifier: session.user.identifier,
      ghlSubscriptionId: subscription.ghlSubscriptionId
    });

    return res.status(200).json({
      success: true,
      message: "Subscription cancelled successfully",
      cancellationData: cancelData,
    });
  } catch (error) {
    console.error("Cancellation error:", error);
    return res.status(500).json({
      error: "Failed to cancel subscription",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}