import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { Search, Users, Phone, Mail, Check, Loader2, Star, Crown } from 'lucide-react';

export default function LeadFinderApp() {
  const [currentStep, setCurrentStep] = useState('auth');
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedLeads, setSelectedLeads] = useState(new Set());
  const [smartListName, setSmartListName] = useState('');
  const [userPlan, setUserPlan] = useState('trial');
  const [searchesRemaining, setSearchesRemaining] = useState(3);
  const [isImporting, setIsImporting] = useState(false);

  // Check for stored auth and OAuth callback
  useEffect(() => {
    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code && currentStep === 'auth') {
      handleOAuthCallback(code);
      return;
    }

    // Check for stored user data
    const storedUser = localStorage.getItem('ghl_user');
    const storedSearches = localStorage.getItem('trial_searches');
    
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setCurrentStep('search');
    }
    
    if (storedSearches) {
      setSearchesRemaining(parseInt(storedSearches));
    }
  }, []);

  const handleOAuthCallback = async (code) => {
    try {
      const response = await fetch('/api/auth/ghl-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });

      const data = await response.json();
      
      if (data.success) {
        setUser(data.user);
        setCurrentStep('search');
        
        // Store user data and tokens
        localStorage.setItem('ghl_user', JSON.stringify(data.user));
        localStorage.setItem('ghl_tokens', JSON.stringify(data.tokens));
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        alert('Authentication failed: ' + data.error);
      }
    } catch (error) {
      console.error('OAuth callback error:', error);
      alert('Authentication failed. Please try again.');
    }
  };

  const initiateGHLAuth = () => {
    const clientId = process.env.NEXT_PUBLIC_GHL_CLIENT_ID;
    if (!clientId) {
      alert('App configuration error. Please contact support.');
      return;
    }
    
    const redirectUri = window.location.origin;
    const scopes = 'contacts.write contacts.readonly locations.readonly';
    
    const authUrl = `https://marketplace.leadconnectorhq.com/oauth/chooselocation?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scopes)}`;
    
    window.location.href = authUrl;
  };

  const performSearch = async () => {
    if (!searchQuery.trim()) {
      alert('Please enter a search query');
      return;
    }
    
    if (userPlan === 'trial' && searchesRemaining <= 0) {
      alert('Trial searches exhausted! Upgrade to Pro for unlimited searches.');
      return;
    }

    setIsSearching(true);
    
    try {
      const response = await fetch('/api/search-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });

      const data = await response.json();
      
      if (data.success) {
        setSearchResults(data.results);
        setSelectedLeads(new Set(data.results.map(r => r.id)));
        setCurrentStep('results');
        
        // Update search count for trial users
        if (userPlan === 'trial') {
          const newCount = searchesRemaining - 1;
          setSearchesRemaining(newCount);
          localStorage.setItem('trial_searches', newCount.toString());
        }
      } else {
        alert('Search failed: ' + data.error);
      }
    } catch (error) {
      console.error('Search error:', error);
      alert('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const importToGHL = async () => {
    if (!smartListName.trim()) {
      alert('Please enter a Smart List name');
      return;
    }
    
    if (selectedLeads.size === 0) {
      alert('Please select at least one lead to import');
      return;
    }

    setIsImporting(true);
    
    try {
      const tokens = JSON.parse(localStorage.getItem('ghl_tokens'));
      const selectedContacts = searchResults.filter(r => selectedLeads.has(r.id));

      const response = await fetch('/api/import-to-ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: selectedContacts,
          smartListName,
          accessToken: tokens.access_token,
          locationId: user.locationId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setCurrentStep('success');
      } else {
        alert('Import failed: ' + data.error);
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  // Component rendering logic here...
  // (I'll provide the JSX in the next part if needed)
  
  return (
    <>
      <Head>
        <title>Lead Finder - AI-Powered Lead Generation</title>
        <meta name="description" content="Find and enrich leads with AI, then import directly to GoHighLevel" />
      </Head>
      <div className="min-h-screen bg-gray-50">
        {/* Your component JSX here */}
        <div className="text-center py-20">
          <h1 className="text-3xl font-bold">Lead Finder App</h1>
          <p>Current Step: {currentStep}</p>
          {currentStep === 'auth' && (
            <button 
              onClick={initiateGHLAuth}
              className="mt-4 px-6 py-3 bg-blue-500 text-white rounded-lg"
            >
              Connect to GoHighLevel
            </button>
          )}
        </div>
      </div>
    </>
  );
}