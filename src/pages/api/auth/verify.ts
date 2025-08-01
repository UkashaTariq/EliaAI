// src/pages/api/auth/verify.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../lib/firebaseAdmin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { identifier } = req.query;

  if (!identifier || typeof identifier !== "string") {
    return res.status(400).json({ error: "Missing identifier" });
  }

  try {
    const doc = await db.collection("app_installs").doc(identifier).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = doc.data();

    // Remove sensitive data before sending to client
    const safeUserData = {
      identifier: userData?.identifier,
      locationId: userData?.locationId,
      created_at: userData?.created_at,
      updated_at: userData?.updated_at,
      last_sync: userData?.last_sync,
    };

    res.status(200).json(safeUserData);
  } catch (error) {
    console.error("Verification error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
