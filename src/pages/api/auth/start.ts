import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientId = process.env.GOHIGHLEVEL_CLIENT_ID;
  const redirectUri = process.env.GOHIGHLEVEL_REDIRECT_URI;
  const scope = 'contacts.write';

  if (!clientId || !redirectUri) {
    return res.status(500).send('Missing env variables');
  }

  const url = `https://services.leadconnectorhq.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
  res.redirect(url);
}
