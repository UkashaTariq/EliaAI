// src/lib/authMiddleware.ts
import { NextApiRequest, NextApiResponse } from "next";
import { db } from "./firebaseAdmin";

export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    identifier: string;
    access_token: string;
    locationId?: string;
    userId?: string;
    email?: string;
    name?: string;
  };
}

export function withAuth(
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void>
) {
  return async (req: AuthenticatedRequest, res: NextApiResponse) => {
    try {
      // Get identifier from query or body
      const identifier = req.query.identifier || req.body.identifier;

      if (!identifier || typeof identifier !== "string") {
        return res.status(401).json({ error: "Missing identifier" });
      }

      // Verify user exists in database
      const userDoc = await db.collection("app_installs").doc(identifier).get();

      if (!userDoc.exists) {
        return res.status(401).json({ error: "Invalid identifier" });
      }

      const userData = userDoc.data();

      if (!userData?.access_token) {
        return res.status(401).json({ error: "Invalid access token" });
      }

      // Attach user data to request
      req.user = {
        identifier: userData.identifier,
        access_token: userData.access_token,
        locationId: userData.locationId,
        userId: userData.userId,
        email: userData.email,
        name: userData.name,
      };

      // Update last activity
      await db.collection("app_installs").doc(identifier).update({
        updated_at: new Date(),
        last_activity: new Date(),
      });

      return handler(req, res);
    } catch (error) {
      console.error("Auth middleware error:", error);
      return res.status(500).json({ error: "Authentication failed" });
    }
  };
}
