// src/pages/api/auth/callback.ts - Enhanced version with session management
import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../lib/firebaseAdmin";
import {
  getSession,
  createUserSession,
  invalidateUserSessions,
} from "../../../lib/session-utils";
import type { AppInstall } from "../../../lib/firestore-schema";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const code = req.query.code as string;
  if (!code) return res.status(400).send("Missing authorization code");

  try {
    // Exchange code for tokens
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.GOHIGHLEVEL_CLIENT_ID || "",
      client_secret: process.env.GOHIGHLEVEL_CLIENT_SECRET || "",
      redirect_uri: process.env.GOHIGHLEVEL_REDIRECT_URI || "",
    });

    const tokenRes = await fetch(
      "https://services.leadconnectorhq.com/oauth/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      }
    );

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error("Token exchange failed:", text);
      return res.status(500).send(`Token exchange failed: ${text}`);
    }

    const tokenData = await tokenRes.json();
    console.log("Token data received:", {
      hasAccessToken: !!tokenData.access_token,
      locationId: tokenData.locationId,
      userId: tokenData.user_id,
    });

    // Get user/location information
    let userInfo = null;
    let locationInfo = null;

    try {
      // Try to get user information
      if (tokenData.access_token) {
        const userRes = await fetch(
          "https://services.leadconnectorhq.com/users/me",
          {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
              Version: "2021-07-28",
            },
          }
        );

        if (userRes.ok) {
          userInfo = await userRes.json();
          console.log("User info retrieved:", {
            id: userInfo?.id,
            email: userInfo?.email,
            name: userInfo?.name,
          });
        }

        // Try to get location information if locationId is available
        if (tokenData.locationId) {
          const locationRes = await fetch(
            `https://services.leadconnectorhq.com/locations/${tokenData.locationId}`,
            {
              headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
                Version: "2021-07-28",
              },
            }
          );

          if (locationRes.ok) {
            locationInfo = await locationRes.json();
            console.log("Location info retrieved:", {
              id: locationInfo?.id,
              name: locationInfo?.name,
              address: locationInfo?.address,
            });
          }
        }
      }
    } catch (apiError) {
      console.error("Error fetching user/location info:", apiError);
      // Continue without user info - we can still function with just tokens
    }

    // Determine identifier - prefer locationId, fallback to userId, then user_id from token
    const identifier =
      tokenData.locationId ||
      userInfo?.id ||
      tokenData.user_id ||
      tokenData.userId ||
      "unknown";

    if (identifier === "unknown") {
      console.error(
        "Could not determine identifier from token data:",
        tokenData
      );
      return res.status(500).send("Unable to determine user identifier");
    }

    // Prepare user data for storage
    const userData: AppInstall = {
      identifier: identifier.toString(),
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      locationId: tokenData.locationId || null,
      userId: userInfo?.id || tokenData.user_id || null,
      email: userInfo?.email || null,
      name:
        userInfo?.name ||
        userInfo?.firstName + " " + userInfo?.lastName ||
        null,
      locationName: locationInfo?.name || null,
      locationAddress: locationInfo?.address || null,
      scopes: tokenData.scope || "contacts.write",
      token_type: tokenData.token_type || "Bearer",
      expires_in: tokenData.expires_in || null,
      created_at: new Date(),
      updated_at: new Date(),
      last_login: new Date(),
      isActive: true,
    };

    // Check if this is a location change for existing user
    const existingUserDoc = await db
      .collection("app_installs")
      .doc(identifier.toString())
      .get();

    let isLocationChange = false;
    if (existingUserDoc.exists) {
      const existingData = existingUserDoc.data() as AppInstall;
      isLocationChange = (existingData?.locationId &&
        existingData.locationId !== userData.locationId) as boolean;

      if (isLocationChange) {
        console.log("Location change detected:", {
          old: existingData?.locationId,
          new: userData.locationId,
        });

        // Invalidate old sessions for the old location
        await invalidateUserSessions(
          identifier.toString(),
          existingData.locationId
        );
      }
    }

    // Store in Firestore
    await db
      .collection("app_installs")
      .doc(identifier.toString())
      .set(userData, { merge: true });

    console.log("User data stored successfully for identifier:", identifier);

    // Create new session
    const sessionId = await createUserSession(
      identifier.toString(),
      userData.locationId!,
      req
    );

    // Get session and store minimal user data
    const session = await getSession(req, res);
    session.user = {
      identifier: identifier.toString(),
      locationId: userData.locationId!,
      isLoggedIn: true,
      loginTime: Date.now(),
      lastActivity: Date.now(),
    };

    await session.save();

    console.log("Session created with minimal data:", sessionId);

    // Determine redirect URL based on environment
    const baseUrl =
      process.env.NODE_ENV === "production"
        ? process.env.NEXT_PUBLIC_APP_URL ||
          "https://definite-hedgehog-emerging.ngrok-free.app"
        : "https://definite-hedgehog-emerging.ngrok-free.app";

    const redirectUrl = `${baseUrl}/dashboard`;

    // Redirect to dashboard with session
    res.setHeader("Content-Type", "text/html");
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Redirecting...</title>
        </head>
        <body>
          <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial, sans-serif;">
            <div style="text-align: center;">
              <h2>Authentication Successful</h2>
              <p>Redirecting to dashboard...</p>
              <div style="margin-top: 20px;">
                <div style="border: 4px solid #f3f3f3; border-radius: 50%; border-top: 4px solid #3498db; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
              </div>
            </div>
          </div>
          <style>
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
          <script>
            setTimeout(() => {
              window.location.href = '${redirectUrl}';
            }, 2000);
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Callback handler error:", error);
    res
      .status(500)
      .send(
        `Authentication failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
  }
}
