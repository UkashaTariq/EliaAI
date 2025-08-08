// src/pages/api/ghl/subscribe.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "../../../lib/session-utils";
import { db } from "../../../lib/firebaseAdmin";

interface SubscribeRequest {
  planId: 'starter' | 'pro' | 'enterprise';
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

    const { planId, returnUrl, cancelUrl } = req.body as SubscribeRequest;
    
    if (!planId) {
      return res.status(400).json({ error: "Plan ID is required" });
    }

    // Get user data to get access token and locationId
    const userDoc = await db.collection('app_installs').doc(session.user.identifier).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userDoc.data();
    
    if (!userData?.access_token) {
      return res.status(400).json({ error: "No access token found" });
    }

    const locationId = session.user.locationId;
    const appId = process.env.GOHIGHLEVEL_APP_ID;
    
    if (!appId) {
      return res.status(500).json({ error: "App ID not configured" });
    }

    // Create GHL marketplace subscription URL
    const subscribeUrl = `https://marketplace.gohighlevel.com/subscribe`;
    
    const params = new URLSearchParams({
      appId,
      locationId,
      planId,
      returnUrl: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/subscription?subscribed=success`,
      cancelUrl: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/subscription?subscribed=cancelled`,
    });

    const fullSubscribeUrl = `${subscribeUrl}?${params.toString()}`;

    console.log('Creating subscription URL:', {
      planId,
      locationId,
      appId,
      url: fullSubscribeUrl
    });

    return res.status(200).json({
      subscribeUrl: fullSubscribeUrl,
      planId,
      success: true,
    });
  } catch (error) {
    console.error("Subscription URL creation error:", error);
    return res.status(500).json({
      error: "Failed to create subscription URL",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}