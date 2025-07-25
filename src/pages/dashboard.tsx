import { useState } from 'react';

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
}

export default function Dashboard() {
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [listName, setListName] = useState('My List');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/exaSearch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
        setSelected(data.contacts.map((c: Contact) => c.id));
        setShowModal(true);
      } else {
        const text = await res.text();
        alert(`Search failed: ${text}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const params = new URLSearchParams(window.location.search);
    const identifier = params.get('identifier');
    if (!identifier) return alert('No identifier');

    const payload = contacts.filter((c) => selected.includes(c.id));
    if (payload.length === 0) return;

    const res = await fetch('/api/importContacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, contacts: payload, listName }),
    });

    if (res.ok) {
      alert('Imported contacts');
      setShowModal(false);
      setContacts([]);
      setSelected([]);
    } else {
      const text = await res.text();
      alert(`Import failed: ${text}`);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-6">Dashboard</h1>
      <div className="flex gap-2 mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search businesses..."
          className="w-full rounded-md border px-3 py-2 bg-light text-dark focus:ring-2 focus:ring-primary focus:outline-none"
        />
        <button
          onClick={search}
          className="px-4 py-2 rounded-md bg-primary text-white disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Searching...' : 'Send'}
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-md p-6 max-w-2xl w-full space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Preview Contacts</h2>
              <button
                className="text-gray-500 hover:text-black"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="mb-4">
              <label className="mr-2">Contact List Name:</label>
              <input
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                className="border p-1 rounded"
              />
            </div>
            <div className="max-h-80 overflow-auto border rounded">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-2 border">Select</th>
                    <th className="px-2 border">Name</th>
                    <th className="px-2 border">Email</th>
                    <th className="px-2 border">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id}>
                      <td className="border px-2 text-center">
                        <input
                          type="checkbox"
                          checked={selected.includes(c.id)}
                          onChange={() => toggle(c.id)}
                        />
                      </td>
                      <td className="border px-2">{c.name}</td>
                      <td className="border px-2">{c.email || '-'}</td>
                      <td className="border px-2">{c.phone || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center pt-2">
              <button
                onClick={search}
                className="text-sm text-primary hover:underline"
              >
                Refetch
              </button>
              <button
                onClick={handleImport}
                className="px-4 py-2 rounded-md bg-secondary text-white disabled:opacity-50"
                disabled={selected.length === 0}
              >
                Import Contacts
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
