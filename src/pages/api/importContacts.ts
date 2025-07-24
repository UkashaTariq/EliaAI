import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../lib/firebaseAdmin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { identifier, contacts, listName } = req.body as {
    identifier: string;
    contacts: Array<{ name: string; email?: string; phone?: string }>;
    listName: string;
  };

  if (!identifier) return res.status(400).send('Missing identifier');

  const snap = await db.collection('app_installs').doc(identifier).get();
  if (!snap.exists) return res.status(404).send('Install not found');
  interface InstallData {
    identifier: string;
    access_token: string;
    refresh_token?: string;
    created_at: unknown;
    updated_at: unknown;
  }
  const tokens = snap.data() as InstallData;

  const created: Record<string, unknown>[] = [];
  for (const contact of contacts) {
    const resp = await fetch(
      `https://services.leadconnectorhq.com/locations/${identifier}/contacts/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...contact,
          source: listName,
        }),
      }
    );
    if (resp.ok) {
      const data = await resp.json();
      created.push(data);
    } else {
      const error = await resp.text();
      console.error('Failed to create contact', error);
    }
  }

  await db.collection('app_installs').doc(identifier).update({ updated_at: new Date() });

  res.status(200).json({ created });
}
