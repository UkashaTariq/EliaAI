// api/ghl-refresh.js - GoHighLevel Token Refresh Handler

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    if (!process.env.GHL_CLIENT_SECRET) {
      return res.status(500).json({ error: 'GoHighLevel client secret not configured' });
    }

    // Exchange refresh token for new access token
    const tokenResponse = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GHL_CLIENT_ID,
        client_secret: process.env.GHL_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token refresh failed:', errorData);
      
      // If refresh token is invalid, user needs to re-authenticate
      if (tokenResponse.status === 400 || tokenResponse.status === 401) {
        return res.status(401).json({ 
          error: 'Invalid refresh token', 
          message: 'Please re-authenticate',
          requiresReauth: true
        });
      }
      
      return res.status(500).json({ 
        error: 'Token refresh failed', 
        details: errorData 
      });
    }

    const tokens = await tokenResponse.json();

    // Return new tokens
    return res.status(200).json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || refresh_token, // Some providers don't return new refresh token
      expires_in: tokens.expires_in,
      token_type: tokens.token_type || 'Bearer'
    });

  } catch (error) {
    console.error('Token refresh handler error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}