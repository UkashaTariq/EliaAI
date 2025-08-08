// src/pages/api/admin/cleanup-sessions.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { cleanupInactiveSessions } from "../../../lib/session-utils";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Simple authentication check - you might want to improve this
  const adminKey = req.headers.authorization?.replace('Bearer ', '');
  
  if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await cleanupInactiveSessions();
    
    return res.status(200).json({
      success: true,
      message: `Cleaned up ${result.deletedCount} inactive sessions`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Session cleanup failed:", error);
    return res.status(500).json({
      error: "Session cleanup failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}