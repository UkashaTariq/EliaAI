// src/pages/api/test/firestore.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../lib/firebaseAdmin";
import { getSession } from "../../../lib/session-utils";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Check authentication
    const session = await getSession(req, res);
    
    if (!session.user?.isLoggedIn) {
      return res.status(401).json({ 
        error: "Not authenticated",
        requiresAuth: true 
      });
    }

    if (req.method === "POST") {
      // Test writing to Firestore
      const testDoc = {
        identifier: session.user.identifier,
        locationId: session.user.locationId,
        testData: "Hello World",
        timestamp: new Date(),
        created_at: new Date(),
      };

      console.log("Writing test document to Firestore...");
      await db.collection("test_collection").doc("test-doc").set(testDoc);
      console.log("Test document written successfully");

      return res.status(200).json({ 
        success: true, 
        message: "Test document written to Firestore",
        data: testDoc 
      });
    } else if (req.method === "GET") {
      // Test reading from Firestore
      console.log("Reading test documents from Firestore...");
      
      const snapshot = await db
        .collection("test_collection")
        .where("identifier", "==", session.user.identifier)
        .get();

      console.log("Found", snapshot.size, "test documents");

      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return res.status(200).json({ 
        success: true, 
        count: snapshot.size,
        documents: docs 
      });
    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Firestore test error:", error);
    return res.status(500).json({
      error: "Firestore test failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}