// src/pages/api/ghl/upgrade.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "../../../lib/session-utils";
import { createGHLBillingService, PlanType } from "../../../lib/ghl-billing";
import { db } from "../../../lib/firebaseAdmin";

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

    const { planType } = req.body as { planType: PlanType };
    
    if (!planType || planType === "TRIAL") {
      return res.status(400).json({ error: "Invalid plan type" });
    }

    // Get user data to get access token
    const userDoc = await db.collection('app_installs').doc(session.user.identifier).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userDoc.data();
    
    if (!userData?.access_token) {
      return res.status(400).json({ error: "No access token found" });
    }

    // Create billing service and generate upgrade URL
    const billingService = createGHLBillingService(userData.access_token);
    const upgradeUrl = await billingService.createUpgradeUrl(session.user.locationId, planType);

    return res.status(200).json({
      upgradeUrl,
      planType,
      success: true,
    });
  } catch (error) {
    console.error("Upgrade URL creation error:", error);
    return res.status(500).json({
      error: "Failed to create upgrade URL",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}