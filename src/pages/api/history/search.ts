// src/pages/api/history/search.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "../../../lib/session-utils";
import { db } from "../../../lib/firebaseAdmin";
import type { SearchHistory } from "../../../lib/firestore-schema";
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
      // Get search history
      const limit = parseInt(req.query.limit as string) || 10;
      
      console.log("Fetching search history for identifier:", identifier, "limit:", limit);
      
      try {
        const snapshot = await db
          .collection("search_history")
          .where("identifier", "==", identifier)
          .orderBy("timestamp", "desc")
          .limit(limit)
          .get();

        console.log("Firestore query returned", snapshot.size, "documents");

        const searchHistory = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            timestamp: data.timestamp instanceof Date ? data.timestamp : (data.timestamp as Timestamp).toDate(),
            created_at: data.created_at instanceof Date ? data.created_at : (data.created_at as Timestamp).toDate(),
          };
        });

        return res.status(200).json({ searchHistory });
      } catch (firestoreError) {
        console.error("Firestore query error:", firestoreError);
        // Try a simpler query without orderBy in case of index issues
        console.log("Attempting simpler query without orderBy...");
        
        const simpleSnapshot = await db
          .collection("search_history")
          .where("identifier", "==", identifier)
          .limit(limit)
          .get();

        console.log("Simple query returned", simpleSnapshot.size, "documents");

        const searchHistory = simpleSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            timestamp: data.timestamp instanceof Date ? data.timestamp : (data.timestamp as Timestamp).toDate(),
            created_at: data.created_at instanceof Date ? data.created_at : (data.created_at as Timestamp).toDate(),
          };
        }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Sort in memory

        return res.status(200).json({ searchHistory });
      }
    } else if (req.method === "POST") {
      // Save search history
      const { searchId, query, contacts, searchType = 'manual' } = req.body;

      if (!searchId || !query || !contacts) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const searchHistory: SearchHistory = {
        identifier,
        locationId: session.user.locationId,
        searchId,
        query,
        timestamp: new Date(),
        contactsFound: contacts.length,
        contacts,
        searchType,
        created_at: new Date(),
      };

      await db.collection("search_history").doc(searchId).set(searchHistory);

      return res.status(200).json({ success: true });
    } else if (req.method === "DELETE") {
      // Delete search history entry
      const { searchId } = req.query;

      if (!searchId) {
        return res.status(400).json({ error: "Missing searchId" });
      }

      // Verify the search belongs to the user
      const doc = await db.collection("search_history").doc(searchId as string).get();
      
      if (!doc.exists) {
        return res.status(404).json({ error: "Search not found" });
      }

      const data = doc.data() as SearchHistory;
      
      if (data.identifier !== identifier) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await db.collection("search_history").doc(searchId as string).delete();

      return res.status(200).json({ success: true });
    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Search history API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}