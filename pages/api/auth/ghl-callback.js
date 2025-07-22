export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code } = req.body;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GHL_CLIENT_ID,
        client_secret: process.env.GHL_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.VERCEL_URL ? 
          `https://${process.env.VERCEL_URL}` : 
          'http://localhost:3000'
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Token exchange failed');
    }

    const tokens = await tokenResponse.json();

    // Get user info
    const userResponse = await fetch('https://services.leadconnectorhq.com/users/search', {
      headers: { 
        'Authorization': `Bearer ${tokens.access_token}`,
        'Version': '2021-07-28'
      }
    });

    if (!userResponse.ok) {
      throw new Error('User fetch failed');
    }

    const userData = await userResponse.json();
    const user = userData.users?.[0];

    if (!user) {
      throw new Error('No user data received');
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        locationId: tokens.locationId || user.locationId,
        companyId: tokens.companyId || user.companyId
      },
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token
      }
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Authentication failed'
    });
  }
}