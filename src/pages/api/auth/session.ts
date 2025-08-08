// src/pages/api/auth/session.ts - Enhanced session management with token validation
import type { NextApiRequest, NextApiResponse } from "next";
import { getSession, getUserWithSubscription } from "../../../lib/session-utils";
import { ensureValidToken } from "../../../lib/token-refresh";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    return await handleGetSession(req, res);
  } else if (req.method === "DELETE") {
    return await handleLogout(req, res);
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}

async function handleGetSession(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession(req, res);
    
    if (!session.user?.isLoggedIn) {
      return res.status(401).json({
        authenticated: false,
        requiresAuth: true,
        message: "No active session",
      });
    }
    
    // Validate and refresh JWT token if needed
    console.log('Validating JWT token for user:', session.user.identifier);
    const tokenResult = await ensureValidToken(session.user.identifier);
    
    if (!tokenResult.success) {
      console.log('Token validation/refresh failed:', tokenResult.error);
      
      if (tokenResult.needsReauth) {
        // Clear session and redirect to re-authentication
        session.destroy();
        return res.status(401).json({
          authenticated: false,
          requiresAuth: true,
          tokenExpired: true,
          message: "JWT token expired - please re-authenticate",
          redirectUrl: "/api/auth/start",
        });
      }
      
      // Other token errors (network, etc.) - continue but log the issue
      console.error('Token refresh failed but continuing session:', tokenResult.error);
    } else {
      console.log('JWT token validated successfully for user:', session.user.identifier);
    }
    
    // Check if session is still valid and get latest user data
    const userWithSubscription = await getUserWithSubscription(session.user.identifier);
    
    if (!userWithSubscription) {
      // Clear invalid session
      session.destroy();
      return res.status(401).json({
        authenticated: false,
        requiresAuth: true,
        message: "Invalid session - user not found",
      });
    }
    
    // Check for location change
    if (userWithSubscription.user.locationId !== session.user.locationId) {
      console.log('Location change detected in session check:', {
        sessionLocation: session.user.locationId,
        dbLocation: userWithSubscription.user.locationId
      });
      
      // Clear session and require re-auth
      session.destroy();
      return res.status(401).json({
        authenticated: false,
        requiresAuth: true,
        locationChanged: true,
        message: "Location changed - please re-authenticate",
      });
    }
    
    // Update last activity in session
    if (session.user) {
      session.user.lastActivity = Date.now();
      await session.save();
    }
    
    // Return session data with user details from Firestore
    return res.status(200).json({
      authenticated: true,
      user: {
        identifier: session.user.identifier,
        locationId: session.user.locationId,
        userId: userWithSubscription.user.userId,
        email: userWithSubscription.user.email,
        name: userWithSubscription.user.name,
        locationName: userWithSubscription.user.locationName,
        loginTime: session.user.loginTime,
        lastActivity: session.user.lastActivity,
      },
      subscription: userWithSubscription.subscription ? {
        planId: userWithSubscription.subscription.planId,
        planName: userWithSubscription.subscription.planName,
        status: userWithSubscription.subscription.status,
        searchLimit: userWithSubscription.subscription.searchLimit,
        searchesUsed: userWithSubscription.subscription.searchesUsed,
        currentPeriodEnd: userWithSubscription.subscription.currentPeriodEnd,
        billingSource: userWithSubscription.subscription.billingSource,
      } : {
        planId: 'free',
        planName: 'Free Plan',
        status: 'active',
        searchLimit: 10,
        searchesUsed: 0,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        billingSource: 'free',
      },
    });
  } catch (error) {
    console.error("Session check error:", error);
    return res.status(500).json({
      authenticated: false,
      requiresAuth: true,
      error: "Session check failed",
    });
  }
}

async function handleLogout(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getSession(req, res);
    
    if (session.user) {
      console.log('Logging out user:', session.user.identifier);
    }
    
    session.destroy();
    
    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      error: "Logout failed",
    });
  }
}
