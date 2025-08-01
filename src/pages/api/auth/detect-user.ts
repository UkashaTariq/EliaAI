// src/pages/api/auth/detect-user.ts
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
    console.log("Starting GHL user detection...");

    // Method 1: Try to get current user's installed locations from GHL
    try {
      const ghlResponse = await fetch(
        "https://marketplace.gohighlevel.com/oauth/chooselocation",
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "ELIA-AI-App/1.0",
            // Include any session cookies that might be available
            Cookie: req.headers.cookie || "",
          },
        }
      );

      console.log("GHL API Response status:", ghlResponse.status);

      if (ghlResponse.ok) {
        const ghlData = await ghlResponse.json();
        console.log("GHL API Response:", ghlData);

        // Check if we have user data and installed locations
        if (ghlData.user && ghlData.locations) {
          const userId = ghlData.user.id;
          const userEmail = ghlData.user.email;
          const userName = ghlData.user.name;

          console.log("Found GHL user:", { userId, userEmail, userName });

          // Check each installed location to see if our app is installed
          for (const location of ghlData.locations) {
            const locationId = location.id;
            console.log(`Checking location: ${locationId}`);

            // Check if this location has our app installed
            const userDoc = await db
              .collection("app_installs")
              .doc(locationId)
              .get();

            if (userDoc.exists) {
              const userData = userDoc.data();
              console.log(`Found app installation for location: ${locationId}`);

              // Verify the access token is still valid
              if (userData?.access_token) {
                try {
                  const tokenVerifyResponse = await fetch(
                    "https://services.leadconnectorhq.com/users/me",
                    {
                      headers: {
                        Authorization: `Bearer ${userData.access_token}`,
                        Version: "2021-07-28",
                      },
                    }
                  );

                  if (tokenVerifyResponse.ok) {
                    console.log(
                      `Valid token found for location: ${locationId}`
                    );

                    // Update last activity
                    await db.collection("app_installs").doc(locationId).update({
                      last_activity: new Date(),
                      last_login: new Date(),
                    });

                    return res.status(200).json({
                      detected: true,
                      authenticated: true,
                      identifier: userData.identifier,
                      locationId: userData.locationId,
                      userId: userData.userId,
                      name: userData.name,
                      email: userData.email,
                      currentLocation: location,
                      dashboardUrl: `/dashboard?identifier=${userData.identifier}`,
                    });
                  } else {
                    console.log(`Invalid token for location: ${locationId}`);
                  }
                } catch (error) {
                  console.log(
                    `Token verification failed for ${locationId}:`,
                    error
                  );
                }
              }
            }
          }

          // User found but no valid app installations
          return res.status(200).json({
            detected: true,
            authenticated: false,
            ghlUser: {
              id: userId,
              email: userEmail,
              name: userName,
            },
            availableLocations: ghlData.locations,
            message: "User found but app not installed or tokens expired",
            requiresAuth: true,
          });
        }
      } else if (ghlResponse.status === 401) {
        console.log("User not authenticated with GHL");
        return res.status(200).json({
          detected: false,
          authenticated: false,
          message: "User not logged into GoHighLevel",
          requiresAuth: true,
        });
      } else {
        console.log("Unexpected GHL API response:", ghlResponse.status);
      }
    } catch (error) {
      console.error("Error calling GHL API:", error);
    }

    // Method 2: Fallback to checking provided context parameters
    const { locationId, userId, companyId } = req.query;

    if (locationId || userId || companyId) {
      console.log("Falling back to context parameter check");
      return handleContextLookup(
        res,
        locationId as string,
        userId as string,
        companyId as string
      );
    }

    // No authentication detected
    return res.status(200).json({
      detected: false,
      authenticated: false,
      message: "No GHL authentication detected",
      requiresAuth: true,
    });
  } catch (error) {
    console.error("User detection error:", error);
    return res.status(500).json({
      error: "Failed to detect user",
      requiresAuth: true,
    });
  }
}

async function handleContextLookup(
  res: NextApiResponse,
  locationId: string | null,
  userId: string | null,
  companyId: string | null
) {
  const possibleIdentifiers = [locationId, userId, companyId].filter(
    Boolean
  ) as string[];

  for (const identifier of possibleIdentifiers) {
    console.log(`Checking context identifier: ${identifier}`);

    try {
      const userDoc = await db.collection("app_installs").doc(identifier).get();

      if (userDoc.exists) {
        const userData = userDoc.data();

        if (userData?.access_token) {
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

            if (ghlResponse.ok) {
              console.log(`Valid context authentication for ${identifier}`);

              await db.collection("app_installs").doc(identifier).update({
                last_activity: new Date(),
              });

              return res.status(200).json({
                detected: true,
                authenticated: true,
                identifier: userData.identifier,
                locationId: userData.locationId,
                userId: userData.userId,
                name: userData.name,
                email: userData.email,
                dashboardUrl: `/dashboard?identifier=${userData.identifier}`,
              });
            }
          } catch (error) {
            console.log(`Token verification failed for ${identifier}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Error checking identifier ${identifier}:`, error);
    }
  }

  return res.status(200).json({
    detected: true,
    authenticated: false,
    message: "Context found but not authenticated with our app",
    requiresAuth: true,
    checkedIdentifiers: possibleIdentifiers,
  });
}
