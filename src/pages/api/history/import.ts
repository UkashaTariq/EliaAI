// src/pages/api/history/import.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "../../../lib/session-utils";
import { db } from "../../../lib/firebaseAdmin";
import type { ImportHistory } from "../../../lib/firestore-schema";
import { Timestamp } from "firebase-admin/firestore";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const session = await getSession(req, res);

    if (!session.user?.isLoggedIn) {
      return res.status(401).json({ error: "No active session" });
    }

    const identifier = session.user.identifier;

    if (req.method === "GET") {
      // Get import history
      const limit = parseInt(req.query.limit as string) || 10;
      
      const snapshot = await db
        .collection("import_history")
        .where("identifier", "==", identifier)
        .orderBy("timestamp", "desc")
        .limit(limit)
        .get();

      const importHistory = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          timestamp: data.timestamp instanceof Date ? data.timestamp : (data.timestamp as Timestamp).toDate(),
          created_at: data.created_at instanceof Date ? data.created_at : (data.created_at as Timestamp).toDate(),
        };
      });

      return res.status(200).json({ importHistory });
    } else if (req.method === "POST") {
      // Save import history
      const { importId, searchId, query, listName, contacts, ghlResponse } = req.body;

      if (!importId || !searchId || !query || !listName || !contacts) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const importHistory: ImportHistory = {
        identifier,
        locationId: session.user.locationId,
        importId,
        searchId,
        query,
        listName,
        contactsImported: contacts.length,
        contacts,
        timestamp: new Date(),
        ghlResponse,
        created_at: new Date(),
      };

      await db.collection("import_history").doc(importId).set(importHistory);

      return res.status(200).json({ success: true });
    } else if (req.method === "DELETE") {
      // Delete import history entry
      const { importId } = req.query;

      if (!importId) {
        return res.status(400).json({ error: "Missing importId" });
      }

      // Verify the import belongs to the user
      const doc = await db.collection("import_history").doc(importId as string).get();
      
      if (!doc.exists) {
        return res.status(404).json({ error: "Import not found" });
      }

      const data = doc.data() as ImportHistory;
      
      if (data.identifier !== identifier) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await db.collection("import_history").doc(importId as string).delete();

      return res.status(200).json({ success: true });
    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Import history API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}