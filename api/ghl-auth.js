// api/ghl-auth.js - GoHighLevel OAuth Authentication Handler

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'GET') {
      // Handle OAuth callback
      const { code, error, error_description, state } = req.query;

      if (error) {
        console.error('OAuth Error:', error, error_description);
        return res.redirect(`/?error=${encodeURIComponent(error_description || error)}`);
      }

      if (!code) {
        return res.redirect('/?error=No authorization code received');
      }

      // Exchange code for tokens
      const tokenResponse = await fetch('https://services.leadconnectorhq.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.NEXT_PUBLIC_GHL_CLIENT_ID,
          client_secret: process.env.GHL_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: process.env.GHL_REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error('Token exchange failed:', errorData);
        return res.redirect('/?error=Token exchange failed');
      }

      const tokens = await tokenResponse.json();

      // In production, you should store tokens securely in a database
      // For demo purposes, we'll redirect with tokens (NOT SECURE - use for development only)
      const redirectUrl = new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
      redirectUrl.searchParams.set('access_token', tokens.access_token);
      redirectUrl.searchParams.set('expires_in', tokens.expires_in);
      
      if (tokens.refresh_token) {
        redirectUrl.searchParams.set('refresh_token', tokens.refresh_token);
      }

      return res.redirect(redirectUrl.toString());
    }

    if (req.method === 'POST') {
      // Handle token exchange from frontend
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ error: 'Authorization code is required' });
      }

      const tokenResponse = await fetch('https://services.leadconnectorhq.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.NEXT_PUBLIC_GHL_CLIENT_ID,
          client_secret: process.env.GHL_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: process.env.GHL_REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error('Token exchange failed:', errorData);
        return res.status(400).json({ 
          error: 'Token exchange failed', 
          details: errorData 
        });
      }

      const tokens = await tokenResponse.json();

      // Return tokens to frontend
      return res.status(200).json({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Auth handler error:', error);
    
    if (req.method === 'GET') {
      return res.redirect(`/?error=${encodeURIComponent('Authentication failed')}`);
    }
    
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}

// Alternative: Token refresh handler (create separate file api/ghl-refresh.js)
export async function refreshToken(refresh_token) {
  try {
    const response = await fetch('https://services.leadconnectorhq.com/oauth/token', {
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

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
}