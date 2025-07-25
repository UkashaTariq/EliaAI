import { useState } from "react";
import {
  Search,
  X,
  Upload,
  RefreshCw,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react";

import logo from "../../public/elia_logo.webp";

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
}

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [listName, setListName] = useState("My List");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelected(contacts.map((c) => c.id));
  };

  const deselectAll = () => {
    setSelected([]);
  };

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/exaSearch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    const identifier = params.get("identifier");
    if (!identifier) return alert("No identifier");

    const payload = contacts.filter((c) => selected.includes(c.id));
    if (payload.length === 0) return;

    setImporting(true);

    try {
      const res = await fetch("/api/importContacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, contacts: payload, listName }),
      });

      if (res.ok) {
        // Show success message
        alert("Contacts imported successfully!");

        // Auto-close modal and clear states
        setTimeout(() => {
          setShowModal(false);
          setContacts([]);
          setSelected([]);
          setQuery("");
          setListName("My List");
        }, 500);
      } else {
        const text = await res.text();
        alert(`Import failed: ${text}`);
      }
    } catch (error) {
      alert("Import failed: Network error");
    } finally {
      setImporting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      search();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-sm shadow-lg border-b border-indigo-800/30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-4">
              <img src={logo.src} alt="ELIA Logo" className="h-8" />
              {/* <h1 className="text-2xl font-bold text-white">Ask ELIA</h1> */}
            </div>
            <div className="ml-auto text-sm text-indigo-200">
              AI-Powered Contact Discovery & Enrichment
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search Section */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">
            Search Businesses
          </h2>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-indigo-300 w-5 h-5" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter business type, location, or keywords..."
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-indigo-300/30 bg-white/20 backdrop-blur-sm text-white placeholder-indigo-200 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition-all"
              />
            </div>
            <button
              onClick={search}
              disabled={loading || !query.trim()}
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all flex items-center gap-2 min-w-[120px] justify-center shadow-lg"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Search
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results Preview */}
        {contacts.length > 0 && !showModal && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Found {contacts.length} contacts
              </h3>
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium rounded-lg transition-all shadow-lg"
              >
                Review & Import
              </button>
            </div>
            <div className="text-sm text-indigo-200">
              Click "Review & Import" to select which contacts to add to your
              list.
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col border border-indigo-700/30">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-indigo-800/50">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Review Contacts
                </h2>
                <p className="text-sm text-indigo-300 mt-1">
                  Select contacts to import ({selected.length} of{" "}
                  {contacts.length} selected)
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-indigo-300" />
              </button>
            </div>

            {/* List Name Input */}
            <div className="p-6 border-b border-indigo-800/50 bg-slate-800/50">
              <label className="block text-sm font-medium text-indigo-200 mb-2">
                Contact List Name
              </label>
              <input
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="Enter list name..."
                className="w-full px-3 py-2 border border-indigo-600/30 rounded-lg bg-slate-800/50 text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>

            {/* Selection Controls */}
            <div className="p-4 border-b border-indigo-800/50 bg-slate-800/30 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="px-3 py-1 text-sm bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 rounded-md transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  className="px-3 py-1 text-sm bg-slate-700/50 hover:bg-slate-700/70 text-slate-300 rounded-md transition-colors"
                >
                  Deselect All
                </button>
              </div>
              <div className="text-sm text-indigo-300">
                {selected.length} contact{selected.length !== 1 ? "s" : ""}{" "}
                selected
              </div>
            </div>

            {/* Contacts Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 sticky top-0">
                  <tr>
                    <th className="text-left p-4 font-medium text-indigo-200 border-b border-indigo-800/50">
                      Select
                    </th>
                    <th className="text-left p-4 font-medium text-indigo-200 border-b border-indigo-800/50">
                      Name
                    </th>
                    <th className="text-left p-4 font-medium text-indigo-200 border-b border-indigo-800/50">
                      Email
                    </th>
                    <th className="text-left p-4 font-medium text-indigo-200 border-b border-indigo-800/50">
                      Phone
                    </th>
                    <th className="text-left p-4 font-medium text-indigo-200 border-b border-indigo-800/50">
                      Website
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact, index) => (
                    <tr
                      key={contact.id}
                      onClick={() => toggle(contact.id)}
                      className={`border-b border-indigo-800/30 hover:bg-indigo-900/30 transition-colors cursor-pointer ${
                        selected.includes(contact.id) ? "bg-indigo-900/50" : ""
                      }`}
                    >
                      <td className="p-4">
                        <div className="flex items-center justify-center w-5 h-5">
                          {selected.includes(contact.id) ? (
                            <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-500 hover:text-indigo-400" />
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-white">
                          {contact.name}
                        </div>
                        {contact.summary && (
                          <div className="text-sm text-indigo-300 mt-1 line-clamp-2">
                            {contact.summary}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-indigo-200">
                        {contact.email ? (
                          <a
                            href={`mailto:${contact.email}`}
                            className="text-indigo-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {contact.email}
                          </a>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-4 text-indigo-200">
                        {contact.phone ? (
                          <a
                            href={`tel:${contact.phone}`}
                            className="text-indigo-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {contact.phone}
                          </a>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-4 text-indigo-200">
                        {contact.url ? (
                          <a
                            href={contact.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:underline truncate block max-w-[200px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {contact.url}
                          </a>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-indigo-800/50 bg-slate-800/30 flex items-center justify-between">
              <button
                onClick={search}
                className="flex items-center gap-2 px-4 py-2 text-indigo-400 hover:bg-indigo-900/30 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Results
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 border border-indigo-600/50 text-indigo-200 hover:bg-indigo-900/30 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={selected.length === 0 || importing}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all shadow-lg"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Import {selected.length} Contact
                      {selected.length !== 1 ? "s" : ""}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
