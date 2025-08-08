// src/pages/api/auth/logout.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getSession, invalidateUserSessions } from "../../../lib/session-utils";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getSession(req, res);
    
    if (session.user) {
      // Invalidate all sessions for this user/location
      await invalidateUserSessions(
        session.user.identifier,
        session.user.locationId
      );
      
      console.log('All sessions invalidated for user:', session.user.identifier);
    }
    
    // Clear the current session
    session.destroy();
    
    res.status(200).json({ 
      success: true, 
      message: "Logged out successfully" 
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      error: "Logout failed" 
    });
  }
}
