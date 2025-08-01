// src/pages/api/auth/session.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Check if user has active GHL session by trying to get user info
    // This requires the user to be logged into GHL in their browser

    // First, we'll try to detect if there's an active GHL session
    // by checking referrer or using GHL's session detection

    const ghlOrigin = req.headers.referer;
    const isFromGHL =
      ghlOrigin &&
      (ghlOrigin.includes("app.gohighlevel.com") ||
        ghlOrigin.includes("app.leadconnectorhq.com") ||
        ghlOrigin.includes("marketplace.leadconnectorhq.com"));

    // If not coming from GHL, we can't verify active session
    if (!isFromGHL) {
      return res.status(401).json({
        error: "No active GHL session detected",
        requiresAuth: true,
      });
    }

    // For now, we'll return that session check is not directly possible
    // The proper way is to always go through OAuth flow
    return res.status(200).json({
      sessionActive: false,
      requiresAuth: true,
      message: "Please authenticate through OAuth flow",
    });
  } catch (error) {
    console.error("Session check error:", error);
    return res.status(500).json({
      error: "Session check failed",
      requiresAuth: true,
    });
  }
}
