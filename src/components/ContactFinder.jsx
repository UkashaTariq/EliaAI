import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Download, X, Check, Users, Building, Mail, Phone, MapPin } from 'lucide-react';
import ExaAPI from '../api/exa';
import GoHighLevelAPI from '../api/gohighlevel';
import { ERROR_MESSAGES, SUCCESS_MESSAGES, LOADING_MESSAGES } from '../utils/config';

const ContactFinder = ({ onError, onClearError }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [smartListName, setSmartListName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);

  useEffect(() => {
    // Load search suggestions
    setSearchSuggestions(ExaAPI.getSearchSuggestions(''));
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    onClearError && onClearError();
    
    try {
      const results = await ExaAPI.searchContacts(searchQuery);
      setContacts(results);
      setShowPreview(true);
      setSelectedContacts(new Set(results.map(c => c.id)));
    } catch (error) {
      console.error('Search failed:', error);
      onError && onError(error.message || ERROR_MESSAGES.SEARCH_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const results = await ExaAPI.refreshSearch(searchQuery);
      setContacts(results);
      setSelectedContacts(new Set(results.map(c => c.id)));
    } catch (error) {
      console.error('Refresh failed:', error);
      onError && onError(error.message || ERROR_MESSAGES.SEARCH_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (selectedContacts.size === 0 || !smartListName.trim()) return;
    
    setImporting(true);
    onClearError && onClearError();
    
    try {
      const selectedContactsData = contacts.filter(c => selectedContacts.has(c.id));
      
      const result = await GoHighLevelAPI.importContactsToSmartList(
        selectedContactsData, 
        smartListName
      );
      
      setImportSuccess(true);
      
      // Show success message and reset after delay
      setTimeout(() => {
        setShowPreview(false);
        setImportSuccess(false);
        setContacts([]);
        setSelectedContacts(new Set());
        setSmartListName('');
        setSearchQuery('');
      }, 2000);
      
    } catch (error) {
      console.error('Import failed:', error);
      onError && onError(error.message || ERROR_MESSAGES.IMPORT_ERROR);
    } finally {
      setImporting(false);
    }
  };

  const handleQueryChange = (query) => {
    setSearchQuery(query);
    if (query.length > 2) {
      setSearchSuggestions(ExaAPI.getSearchSuggestions(query));
    } else {
      setSearchSuggestions(ExaAPI.getSearchSuggestions(''));
    }
  };

  const toggleContactSelection = (contactId) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Contact Finder</h1>
          <p className="text-gray-600">Discover and import high-quality leads using AI-powered search</p>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
          <div className="flex flex-col space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="e.g., Find car dealers in New York"
                className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-lg"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={handleSearch}
                disabled={loading || !searchQuery.trim()}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    <span>Search Contacts</span>
                  </>
                )}
              </button>
              
              {contacts.length > 0 && (
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="bg-gray-600 text-white py-4 px-6 rounded-xl font-semibold hover:bg-gray-700 disabled:opacity-50 transition-all duration-200 flex items-center space-x-2"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Search Suggestions */}
        {searchSuggestions.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Example Searches:</h3>
            <div className="flex flex-wrap gap-2">
              {searchSuggestions.map((example, index) => (
                <button
                  key={index}
                  onClick={() => handleQueryChange(example)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm transition-colors duration-200"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">Found {contacts.length} Contacts</h2>
                  <p className="text-blue-100">Select contacts to import into your smart list</p>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-white hover:text-gray-200 transition-colors duration-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 max-h-96 overflow-y-auto">
                <div className="grid gap-4">
                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className={`border-2 rounded-xl p-4 cursor-pointer transition-all duration-200 ${
                        selectedContacts.has(contact.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleContactSelection(contact.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <Building className="w-5 h-5 text-gray-500" />
                            <h3 className="text-lg font-semibold text-gray-800">{contact.name}</h3>
                            <div className="flex items-center space-x-1">
                              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                              <span className="text-sm text-gray-600">{contact.rating}</span>
                            </div>
                          </div>
                          
                          <p className="text-gray-600 mb-3">{contact.description}</p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            {contact.email && (
                              <div className="flex items-center space-x-2">
                                <Mail className="w-4 h-4 text-gray-400" />
                                <span>{contact.email}</span>
                              </div>
                            )}
                            {contact.phone && (
                              <div className="flex items-center space-x-2">
                                <Phone className="w-4 h-4 text-gray-400" />
                                <span>{contact.phone}</span>
                              </div>
                            )}
                            {contact.address && (
                              <div className="flex items-center space-x-2 md:col-span-2">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <span>{contact.address}</span>
                              </div>
                            )}
                            {contact.website && (
                              <div className="flex items-center space-x-2 md:col-span-2">
                                <span className="text-blue-600 text-sm">{contact.website}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="ml-4">
                          {selectedContacts.has(contact.id) ? (
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 border-2 border-gray-300 rounded-full"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="border-t bg-gray-50 p-6">
                <div className="flex flex-col space-y-4">
                  <div className="flex items-center space-x-4">
                    <Users className="w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      value={smartListName}
                      onChange={(e) => setSmartListName(e.target.value)}
                      placeholder="Enter smart list name (e.g., NYC Car Dealers)"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">
                      {selectedContacts.size} of {contacts.length} contacts selected
                    </span>
                    
                    <button
                      onClick={handleImport}
                      disabled={selectedContacts.size === 0 || !smartListName.trim() || importing}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 px-8 rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2"
                    >
                      {importing ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          <span>Importing...</span>
                        </>
                      ) : importSuccess ? (
                        <>
                          <Check className="w-5 h-5" />
                          <span>Imported Successfully!</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-5 h-5" />
                          <span>Import to GoHighLevel</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactFinder;