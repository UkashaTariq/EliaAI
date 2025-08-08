// src/lib/token-refresh.ts
import { db } from "./firebaseAdmin";
import type { AppInstall } from "./firestore-schema";

interface TokenRefreshResult {
  success: boolean;
  accessToken?: string;
  needsReauth?: boolean;
  error?: string;
}

// Validate if JWT token is expired or invalid
export async function validateGHLToken(identifier: string): Promise<boolean> {
  try {
    const userDoc = await db.collection('app_installs').doc(identifier).get();
    
    if (!userDoc.exists) {
      return false;
    }
    
    const userData = userDoc.data() as AppInstall;
    
    if (!userData.access_token) {
      return false;
    }
    
    // Test the token with a simple API call
    const testResponse = await fetch(
      'https://services.leadconnectorhq.com/users/me',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userData.access_token}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
        },
      }
    );
    
    return testResponse.ok;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

// Refresh the access token using refresh token
export async function refreshGHLToken(identifier: string): Promise<TokenRefreshResult> {
  try {
    const userDoc = await db.collection('app_installs').doc(identifier).get();
    
    if (!userDoc.exists) {
      return { 
        success: false, 
        needsReauth: true,
        error: 'User document not found' 
      };
    }
    
    const userData = userDoc.data() as AppInstall;
    
    if (!userData.refresh_token) {
      console.log('No refresh token available for user:', identifier);
      return { 
        success: false, 
        needsReauth: true,
        error: 'No refresh token available' 
      };
    }
    
    console.log('Attempting to refresh token for user:', identifier);
    
    // Use refresh token to get new access token
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: userData.refresh_token,
      client_id: process.env.GOHIGHLEVEL_CLIENT_ID || '',
      client_secret: process.env.GOHIGHLEVEL_CLIENT_SECRET || '',
    });
    
    const response = await fetch(
      'https://services.leadconnectorhq.com/oauth/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token refresh failed:', response.status, errorText);
      
      // If refresh token is invalid, user needs to re-authenticate
      if (response.status === 401 || response.status === 400) {
        return { 
          success: false, 
          needsReauth: true,
          error: `Token refresh failed: ${errorText}` 
        };
      }
      
      return { 
        success: false, 
        error: `Token refresh failed: ${errorText}` 
      };
    }
    
    const tokenData = await response.json();
    console.log('Token refresh successful for user:', identifier);
    
    // Update the stored tokens
    const updatedUserData: Partial<AppInstall> = {
      access_token: tokenData.access_token,
      updated_at: new Date(),
      last_login: new Date(),
    };
    
    // Update refresh token if provided
    if (tokenData.refresh_token) {
      updatedUserData.refresh_token = tokenData.refresh_token;
    }
    
    // Update expires_in if provided
    if (tokenData.expires_in) {
      updatedUserData.expires_in = tokenData.expires_in;
    }
    
    await db.collection('app_installs').doc(identifier).update(updatedUserData);
    
    return { 
      success: true, 
      accessToken: tokenData.access_token 
    };
    
  } catch (error) {
    console.error('Token refresh error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Validate token and refresh if needed
export async function ensureValidToken(identifier: string): Promise<TokenRefreshResult> {
  console.log('Checking token validity for user:', identifier);
  
  const isValid = await validateGHLToken(identifier);
  
  if (isValid) {
    console.log('Token is valid for user:', identifier);
    return { success: true };
  }
  
  console.log('Token is invalid, attempting refresh for user:', identifier);
  return await refreshGHLToken(identifier);
}

// Get valid access token (validate and refresh if needed)
export async function getValidAccessToken(identifier: string): Promise<string | null> {
  const result = await ensureValidToken(identifier);
  
  if (result.success) {
    // If refresh was successful, return new token
    if (result.accessToken) {
      return result.accessToken;
    }
    
    // If validation was successful, get existing token
    const userDoc = await db.collection('app_installs').doc(identifier).get();
    if (userDoc.exists) {
      const userData = userDoc.data() as AppInstall;
      return userData.access_token || null;
    }
  }
  
  if (result.needsReauth) {
    console.log('User needs re-authentication:', identifier);
    // This will be handled by the calling function
  }
  
  return null;
}