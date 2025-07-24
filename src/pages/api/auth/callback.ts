import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const code = req.query.code as string;
  if (!code) return res.status(400).send('Missing code');

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: process.env.GOHIGHLEVEL_CLIENT_ID || '',
    client_secret: process.env.GOHIGHLEVEL_CLIENT_SECRET || '',
    redirect_uri: process.env.GOHIGHLEVEL_REDIRECT_URI || '',
  });

  const tokenRes = await fetch('https://services.leadconnectorhq.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return res.status(500).send(`Token exchange failed: ${text}`);
  }

  const data = await tokenRes.json();
  const identifier = data.locationId || data.account_id || data.user_id || 'unknown';

  await db.collection('app_installs').doc(identifier.toString()).set(
    {
      identifier,
      access_token: data.access_token,
      refresh_token: data.refresh_token || null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    { merge: true }
  );

  res.redirect(`/dashboard?identifier=${identifier}`);
}
