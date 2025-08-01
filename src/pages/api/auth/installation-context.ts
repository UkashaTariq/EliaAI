// src/pages/api/auth/installation-context.ts
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
    console.log("Detecting installation context...");
    console.log("Headers:", req.headers);
    console.log("Query params:", req.query);

    // Method 1: Check for GHL installation parameters
    const {
      location_id,
      locationId,
      user_id,
      userId,
      company_id,
      companyId,
      account_id,
      accountId,
    } = req.query;

    const possibleIdentifiers = [
      location_id,
      locationId,
      user_id,
      userId,
      company_id,
      companyId,
      account_id,
      accountId,
    ].filter(Boolean) as string[];

    console.log("Possible identifiers from query:", possibleIdentifiers);

    // Method 2: Check GHL headers (if app is embedded)
    const headerIdentifiers = [
      req.headers["x-ghl-location-id"],
      req.headers["x-ghl-user-id"],
      req.headers["x-ghl-company-id"],
      req.headers["x-location-id"],
      req.headers["x-user-id"],
    ].filter(Boolean) as string[];

    console.log("Possible identifiers from headers:", headerIdentifiers);

    const allIdentifiers = [...possibleIdentifiers, ...headerIdentifiers];

    // Try each identifier to find an installation
    for (const identifier of allIdentifiers) {
      console.log(`Checking installation for identifier: ${identifier}`);

      try {
        const installDoc = await db
          .collection("app_installs")
          .doc(identifier)
          .get();

        if (installDoc.exists) {
          const installData = installDoc.data();
          console.log(`Found installation for ${identifier}`);

          // Verify the access token is still valid
          if (installData?.access_token) {
            try {
              const tokenResponse = await fetch(
                "https://services.leadconnectorhq.com/users/me",
                {
                  headers: {
                    Authorization: `Bearer ${installData.access_token}`,
                    Version: "2021-07-28",
                  },
                }
              );

              if (tokenResponse.ok) {
                const userInfo = await tokenResponse.json();
                console.log(
                  `Valid token for ${identifier}, user:`,
                  userInfo.id
                );

                // Update last activity
                await db.collection("app_installs").doc(identifier).update({
                  last_activity: new Date(),
                  last_api_check: new Date(),
                });

                return res.status(200).json({
                  success: true,
                  installation: {
                    identifier: installData.identifier,
                    access_token: installData.access_token,
                    refresh_token: installData.refresh_token,
                    locationId: installData.locationId,
                    userId: installData.userId,
                    name: installData.name,
                    email: installData.email,
                    locationName: installData.locationName,
                    scopes: installData.scopes,
                    created_at: installData.created_at,
                    updated_at: installData.updated_at,
                  },
                  currentUser: {
                    id: userInfo.id,
                    name: userInfo.name,
                    email: userInfo.email,
                    phone: userInfo.phone,
                  },
                  context: {
                    detectedFrom: "database",
                    originalIdentifier: identifier,
                    availableIdentifiers: allIdentifiers,
                  },
                });
              } else {
                console.log(
                  `Invalid token for ${identifier}, status:`,
                  tokenResponse.status
                );

                // Token expired, try to refresh if we have refresh_token
                if (installData.refresh_token) {
                  const refreshResult = await refreshAccessToken(
                    installData.refresh_token
                  );

                  if (refreshResult.success) {
                    // Update with new tokens
                    await db
                      .collection("app_installs")
                      .doc(identifier)
                      .update({
                        access_token: refreshResult.access_token,
                        refresh_token:
                          refreshResult.refresh_token ||
                          installData.refresh_token,
                        updated_at: new Date(),
                        last_token_refresh: new Date(),
                      });

                    return res.status(200).json({
                      success: true,
                      installation: {
                        identifier: installData.identifier,
                        access_token: refreshResult.access_token,
                        refresh_token:
                          refreshResult.refresh_token ||
                          installData.refresh_token,
                        locationId: installData.locationId,
                        userId: installData.userId,
                        name: installData.name,
                        email: installData.email,
                        scopes: installData.scopes,
                        created_at: installData.created_at,
                        updated_at: new Date(),
                      },
                      context: {
                        detectedFrom: "database_refreshed",
                        originalIdentifier: identifier,
                        tokenRefreshed: true,
                      },
                    });
                  }
                }
              }
            } catch (tokenError) {
              console.error(
                `Token validation failed for ${identifier}:`,
                tokenError
              );
            }
          }
        } else {
          console.log(`No installation found for ${identifier}`);
        }
      } catch (error) {
        console.error(`Error checking identifier ${identifier}:`, error);
      }
    }

    // Method 3: Try to use the current GHL session (if available)
    const referrer: any = req.headers.referer || req.headers.referrer;

    if (
      referrer &&
      (referrer.includes("gohighlevel.com") ||
        referrer.includes("leadconnectorhq.com"))
    ) {
      console.log("Detected GHL referrer, attempting session detection");

      try {
        const referrerUrl = new URL(referrer);
        const refLocationId =
          referrerUrl.searchParams.get("locationId") ||
          referrerUrl.searchParams.get("location_id");
        const refUserId =
          referrerUrl.searchParams.get("userId") ||
          referrerUrl.searchParams.get("user_id");

        if (refLocationId || refUserId) {
          const refIdentifier: any = refLocationId || refUserId;
          const refInstall = await db
            .collection("app_installs")
            .doc(refIdentifier)
            .get();

          if (refInstall.exists) {
            const refData = refInstall.data();

            return res.status(200).json({
              success: true,
              installation: {
                identifier: refData?.identifier,
                locationId: refData?.locationId,
                userId: refData?.userId,
                name: refData?.name,
                email: refData?.email,
                access_token: refData?.access_token,
                created_at: refData?.created_at,
              },
              context: {
                detectedFrom: "referrer",
                referrer: referrer,
                extractedIdentifier: refIdentifier,
              },
            });
          }
        }
      } catch (error) {
        console.error("Referrer parsing failed:", error);
      }
    }

    // No installation context found
    return res.status(404).json({
      success: false,
      error: "No installation context found",
      debug: {
        checkedIdentifiers: allIdentifiers,
        referrer: referrer,
        userAgent: req.headers["user-agent"],
      },
      suggestion: "User may need to install the app or re-authenticate",
    });
  } catch (error) {
    console.error("Installation context detection error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to detect installation context",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

// Helper function to refresh access token
async function refreshAccessToken(refreshToken: string) {
  try {
    const response = await fetch(
      "https://services.leadconnectorhq.com/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: process.env.GOHIGHLEVEL_CLIENT_ID || "",
          client_secret: process.env.GOHIGHLEVEL_CLIENT_SECRET || "",
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      };
    } else {
      const errorText = await response.text();
      console.error("Token refresh failed:", errorText);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.error("Token refresh error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
