// src/pages/api/auth/logout.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Clear any session cookies if you're using them
  // For now, we'll just return success since we're using URL-based auth

  res.status(200).json({ success: true, message: "Logged out successfully" });
}
