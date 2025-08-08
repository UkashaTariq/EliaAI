// src/components/ImportHistoryCards.tsx
import React from "react";
import { 
  Users, 
  Calendar, 
  ExternalLink, 
  Mail, 
  Phone, 
  CheckCircle,
  AlertCircle,
  Sparkles
} from "lucide-react";

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
}

interface ImportHistoryItem {
  importId: string;
  searchId: string;
  query: string;
  listName: string;
  contactsImported: number;
  contacts: Contact[];
  timestamp: string | Date;
  ghlResponse?: {
    created: number;
    errors: number;
    smartListId?: string;
  };
}

interface ImportHistoryCardsProps {
  importHistory: ImportHistoryItem[];
  onReimport?: (searchId: string, query: string) => void;
  isLoading?: boolean;
}

export default function ImportHistoryCards({ 
  importHistory, 
  onReimport, 
  isLoading 
}: ImportHistoryCardsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-slate-800/50 rounded-xl p-6 animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="h-5 w-48 bg-slate-700 rounded"></div>
              <div className="h-4 w-24 bg-slate-700 rounded"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-slate-700 rounded"></div>
              <div className="h-4 w-3/4 bg-slate-700 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!importHistory || importHistory.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="w-16 h-16 text-slate-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-slate-300 mb-2">
          No Import History
        </h3>
        <p className="text-slate-500 mb-6">
          Import contacts from your searches to see them here.
        </p>
      </div>
    );
  }

  const formatDate = (date: string | Date) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getEnrichedContactsCount = (contacts: Contact[]) => {
    return contacts.filter(contact => contact.email || contact.phone).length;
  };

  return (
    <div className="space-y-4">
      {importHistory.map((item) => {
        const enrichedCount = getEnrichedContactsCount(item.contacts);
        const successRate = item.ghlResponse 
          ? ((item.ghlResponse.created / item.contactsImported) * 100).toFixed(1)
          : "100.0";

        return (
          <div
            key={item.importId}
            className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all group"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg">
                    {item.listName}
                  </h3>
                  <p className="text-slate-400 text-sm truncate max-w-xs">
                    Query: &quot;{item.query}&quot;
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(item.timestamp)}</span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="flex items-center gap-2 p-3 bg-slate-700/30 rounded-lg">
                <Users className="w-4 h-4 text-blue-400" />
                <div>
                  <p className="text-slate-300 text-sm">Total Imported</p>
                  <p className="font-semibold text-white">{item.contactsImported}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-slate-700/30 rounded-lg">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <div>
                  <p className="text-slate-300 text-sm">Enriched Contacts</p>
                  <p className="font-semibold text-white">
                    {enrichedCount}
                    <span className="text-slate-400 text-sm ml-1">
                      ({((enrichedCount / item.contactsImported) * 100).toFixed(1)}%)
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-700/30 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <div>
                  <p className="text-slate-300 text-sm">Success Rate</p>
                  <p className="font-semibold text-white">{successRate}%</p>
                </div>
              </div>
            </div>

            {/* Contact Preview */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-slate-300 mb-2">
                Contact Preview ({Math.min(3, item.contacts.length)} of {item.contacts.length})
              </h4>
              <div className="space-y-2">
                {item.contacts.slice(0, 3).map((contact, index) => (
                  <div
                    key={contact.id || index}
                    className="flex items-center justify-between p-3 bg-slate-700/20 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center">
                        <span className="text-blue-400 font-medium text-sm">
                          {contact.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-medium">{contact.name}</p>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                          {contact.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              <span>{contact.email}</span>
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              <span>{contact.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {contact.url && (
                      <a
                        href={contact.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
              <div className="flex items-center gap-4 text-sm text-slate-400">
                {item.ghlResponse?.smartListId && (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>Smart List Created</span>
                  </div>
                )}
                {item.ghlResponse?.errors && item.ghlResponse.errors > 0 && (
                  <div className="flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 text-yellow-400" />
                    <span>{item.ghlResponse.errors} errors</span>
                  </div>
                )}
              </div>
              
              {onReimport && (
                <button
                  onClick={() => onReimport(item.searchId, item.query)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  Search Again
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}