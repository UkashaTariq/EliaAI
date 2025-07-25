import type { NextApiRequest, NextApiResponse } from 'next';

interface ExaResult {
  title?: string;
  url?: string;
  text?: string;
  summary?: string;
}

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { query } = req.body as { query?: string };
  if (!query) return res.status(400).json({ error: 'Missing query' });

  try {
    const exaResp = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.EXA_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        numResults: 20,
        type: 'neural',
        useAutoprompt: true,
        contents: { text: true, highlights: true, summary: true },
      }),
    });

    if (!exaResp.ok) {
      const text = await exaResp.text();
      return res.status(500).json({ error: text });
    }

    const data = await exaResp.json();
    const results: ExaResult[] = data.results || [];

    const contacts: Contact[] = results
      .map((r, idx) => {
        const email = extractEmail(r.text || '');
        const phone = extractPhone(r.text || '');
        if (!email && !phone) return null;
        return {
          id: String(idx + 1),
          name: r.title || 'Unknown',
          email: email || undefined,
          phone: phone || undefined,
          url: r.url,
          summary: r.summary,
        } as Contact;
      })
      .filter(Boolean) as Contact[];

    return res.status(200).json({ contacts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal error' });
  }
}

function extractEmail(text: string): string | null {
  const match = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  return match ? match[0] : null;
}

function extractPhone(text: string): string | null {
  const match = text.match(/\+?\d[\d\s().-]{7,}\d/);
  return match ? match[0] : null;
}
