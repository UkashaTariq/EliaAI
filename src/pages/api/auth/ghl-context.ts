// src/pages/api/auth/ghl-context.ts
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
    // Get the current user's GHL session info
    // This endpoint should be called from the frontend with proper GHL context

    const { ghlToken, locationId, userId } = req.query;

    // If we have a GHL token (from frontend), use it to get user info
    if (ghlToken) {
      try {
        const userResponse = await fetch(
          "https://services.leadconnectorhq.com/users/me",
          {
            headers: {
              Authorization: `Bearer ${ghlToken}`,
              Version: "2021-07-28",
            },
          }
        );

        if (userResponse.ok) {
          const userInfo = await userResponse.json();
          console.log("GHL User Info:", userInfo);

          // Get user's locations
          const locationsResponse = await fetch(
            "https://services.leadconnectorhq.com/locations/search",
            {
              headers: {
                Authorization: `Bearer ${ghlToken}`,
                Version: "2021-07-28",
              },
            }
          );

          let locations = [];
          if (locationsResponse.ok) {
            const locationsData = await locationsResponse.json();
            locations = locationsData.locations || [];
          }

          // Check if any of the user's locations have our app installed
          for (const location of locations) {
            const installDoc = await db
              .collection("app_installs")
              .doc(location.id)
              .get();

            if (installDoc.exists) {
              const installData = installDoc.data();

              // Verify the stored token is still valid
              if (installData?.access_token) {
                try {
                  const tokenCheck = await fetch(
                    "https://services.leadconnectorhq.com/users/me",
                    {
                      headers: {
                        Authorization: `Bearer ${installData.access_token}`,
                        Version: "2021-07-28",
                      },
                    }
                  );

                  if (tokenCheck.ok) {
                    // Valid installation found
                    return res.status(200).json({
                      authenticated: true,
                      identifier: installData.identifier,
                      locationId: location.id,
                      locationName: location.name,
                      userId: userInfo.id,
                      userName: userInfo.name,
                      userEmail: userInfo.email,
                      dashboardUrl: `/dashboard?identifier=${installData.identifier}`,
                    });
                  }
                } catch (error) {
                  console.log(
                    `Token verification failed for location ${location.id}`
                  );
                }
              }
            }
          }

          // User authenticated with GHL but app not installed
          return res.status(200).json({
            authenticated: false,
            ghlUser: userInfo,
            locations: locations,
            message: "App not installed for any of user's locations",
            requiresInstall: true,
          });
        }
      } catch (error) {
        console.error("Error checking GHL token:", error);
      }
    }

    // Fallback: Check provided context
    if (locationId || userId) {
      const identifier = locationId || userId;
      const installDoc = await db
        .collection("app_installs")
        .doc(identifier as string)
        .get();

      if (installDoc.exists) {
        const installData = installDoc.data();

        if (installData?.access_token) {
          try {
            const tokenCheck = await fetch(
              "https://services.leadconnectorhq.com/users/me",
              {
                headers: {
                  Authorization: `Bearer ${installData.access_token}`,
                  Version: "2021-07-28",
                },
              }
            );

            if (tokenCheck.ok) {
              return res.status(200).json({
                authenticated: true,
                identifier: installData.identifier,
                locationId: installData.locationId,
                userId: installData.userId,
                name: installData.name,
                email: installData.email,
                dashboardUrl: `/dashboard?identifier=${installData.identifier}`,
              });
            }
          } catch (error) {
            console.log("Token verification failed");
          }
        }
      }
    }

    // No valid authentication found
    return res.status(200).json({
      authenticated: false,
      message: "No valid authentication found",
      requiresAuth: true,
    });
  } catch (error) {
    console.error("GHL context check error:", error);
    return res.status(500).json({
      error: "Failed to check GHL context",
      requiresAuth: true,
    });
  }
}
