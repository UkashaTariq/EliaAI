// src/pages/api/auth/current-user.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../lib/firebaseAdmin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get location/user context from GHL if available
    const { locationId, userId, companyId } = req.query;

    if (!locationId && !userId && !companyId) {
      return res.status(400).json({
        error: "No GHL context provided",
        requiresAuth: true,
      });
    }

    // Try to find user by any of the available identifiers
    const possibleIdentifiers = [locationId, userId, companyId].filter(Boolean);

    for (const identifier of possibleIdentifiers) {
      if (identifier && typeof identifier === "string") {
        // Check if this identifier exists in our database
        const userDoc = await db
          .collection("app_installs")
          .doc(identifier)
          .get();

        if (userDoc.exists) {
          const userData = userDoc.data();

          // Verify this user still has valid access token
          if (userData?.access_token) {
            // Optional: Verify token is still valid with GHL
            try {
              const ghlResponse = await fetch(
                "https://services.leadconnectorhq.com/users/me",
                {
                  headers: {
                    Authorization: `Bearer ${userData.access_token}`,
                    Version: "2021-07-28",
                  },
                }
              );

              if (!ghlResponse.ok) {
                console.log(`Token invalid for identifier ${identifier}`);
                continue; // Try next identifier
              }
            } catch (error) {
              console.log(`Failed to verify token for ${identifier}:`, error);
              continue; // Try next identifier
            }

            // Return safe user data
            return res.status(200).json({
              authenticated: true,
              identifier: userData.identifier,
              locationId: userData.locationId,
              userId: userData.userId,
              name: userData.name,
              email: userData.email,
              created_at: userData.created_at,
              last_login: userData.last_login,
            });
          }
        }
      }
    }

    // No valid user found with any of the provided identifiers
    return res.status(404).json({
      error: "User not found or token expired",
      requiresAuth: true,
      checkedIdentifiers: possibleIdentifiers,
    });
  } catch (error) {
    console.error("Current user check error:", error);
    return res.status(500).json({
      error: "Failed to check current user",
      requiresAuth: true,
    });
  }
}
