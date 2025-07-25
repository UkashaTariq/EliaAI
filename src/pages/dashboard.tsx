import { useState } from "react";

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

const mockContacts: Contact[] = [
  { id: "1", name: "John Doe Smith Dan", email: "johnD@example.com" },
  { id: "2", name: "Jane Smith", phone: "+1234567890" },
  {
    id: "3",
    name: "Bob Brown",
    email: "bob@example.com",
    phone: "+1987654321",
  },
];

export default function Dashboard() {
  const [selected, setSelected] = useState<string[]>([]);
  const [listName, setListName] = useState("My List");

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleImport = async () => {
    const params = new URLSearchParams(window.location.search);
    const identifier = params.get("identifier");
    if (!identifier) return alert("No identifier");

    const contacts = mockContacts.filter((c) => selected.includes(c.id));
    const res = await fetch("/api/importContacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, contacts, listName }),
    });

    if (res.ok) {
      alert("Imported contacts");
    } else {
      const text = await res.text();
      alert(`Import failed: ${text}`);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Dashboard</h1>
      <div className="mb-4">
        <label className="mr-2">Contact List Name:</label>
        <input
          value={listName}
          onChange={(e) => setListName(e.target.value)}
          className="border p-1"
        />
      </div>
      <table className="min-w-full border mb-4">
        <thead>
          <tr>
            <th className="border px-2">Select</th>
            <th className="border px-2">Name</th>
            <th className="border px-2">Email</th>
            <th className="border px-2">Phone</th>
          </tr>
        </thead>
        <tbody>
          {mockContacts.map((c) => (
            <tr key={c.id}>
              <td className="border px-2 text-center">
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={() => toggle(c.id)}
                />
              </td>
              <td className="border px-2">{c.name}</td>
              <td className="border px-2">{c.email || "-"}</td>
              <td className="border px-2">{c.phone || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        className="bg-blue-500 text-white px-4 py-2 rounded"
        onClick={handleImport}
        disabled={selected.length === 0}
      >
        Import Selected
      </button>
    </div>
  );
}
