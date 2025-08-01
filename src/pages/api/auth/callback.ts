// src/pages/api/auth/callback.ts - Enhanced version
import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "../../../lib/firebaseAdmin";

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
    const userData = {
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
    };

    // Store in Firestore
    await db
      .collection("app_installs")
      .doc(identifier.toString())
      .set(userData, { merge: true });

    console.log("User data stored successfully for identifier:", identifier);

    // Always use ngrok URL for redirect
    const redirectUrl = `https://definite-hedgehog-emerging.ngrok-free.app/?identifier=${identifier}`;

    // Simple redirect without localStorage
    res.setHeader("Content-Type", "text/html");
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <body>
          <script>
              window.location.href = '${redirectUrl}';
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
