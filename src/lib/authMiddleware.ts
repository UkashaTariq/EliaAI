// src/lib/authMiddleware.ts
import { NextApiRequest, NextApiResponse } from "next";
import { getSession, getUserWithSubscription } from "./session-utils";

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
      // Get session data
      const session = await getSession(req, res);

      if (!session.user?.isLoggedIn) {
        return res.status(401).json({ error: "No active session" });
      }

      // Get user data from Firestore
      const userWithSubscription = await getUserWithSubscription(session.user.identifier);

      if (!userWithSubscription) {
        return res.status(401).json({ error: "Invalid session - user not found" });
      }

      const userData = userWithSubscription.user;

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

      // Update session last activity
      if (session.user) {
        session.user.lastActivity = Date.now();
        await session.save();
      }

      return handler(req, res);
    } catch (error) {
      console.error("Auth middleware error:", error);
      return res.status(500).json({ error: "Authentication failed" });
    }
  };
}
