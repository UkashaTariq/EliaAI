// src/App.js
import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';
import ContactFinder from './components/ContactFinder';
import AuthCallback from './components/AuthCallback';
import GoHighLevelAPI from './api/gohighlevel';
import { validateEnvironment, ERROR_MESSAGES } from './utils/config';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [showAuthCallback, setShowAuthCallback] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Validate environment variables
      const envValidation = validateEnvironment();
      if (!envValidation.isValid) {
        setError(`Configuration error: Missing ${envValidation.missing.join(', ')}`);
        setIsLoading(false);
        return;
      }

      // Check if we're handling an OAuth callback
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      if (error) {
        setError('Authentication failed: ' + error);
        setIsLoading(false);
        return;
      }

      if (code) {
        setShowAuthCallback(true);
        await handleAuthCallback(code);
        return;
      }

      // Check existing authentication
      await checkAuthentication();
    } catch (error) {
      console.error('App initialization error:', error);
      setError('Failed to initialize application');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthCallback = async (code) => {
    try {
      setIsLoading(true);
      const tokens = await GoHighLevelAPI.exchangeCodeForToken(code);
      
      if (tokens) {
        await loadUserData();
        setIsAuthenticated(true);
        setShowAuthCallback(false);
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (error) {
      console.error('Auth callback error:', error);
      setError('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const checkAuthentication = async () => {
    try {
      if (GoHighLevelAPI.isAuthenticated()) {
        await loadUserData();
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Authentication check error:', error);
      GoHighLevelAPI.logout();
      setIsAuthenticated(false);
    }
  };

  const loadUserData = async () => {
    try {
      const userData = await GoHighLevelAPI.getCurrentUser();
      setUser(userData);
    } catch (error) {
      console.error('Failed to load user data:', error);
      // Don't fail authentication if user data fails to load
    }
  };

  const handleLogin = () => {
    try {
      const authUrl = GoHighLevelAPI.getAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Login error:', error);
      setError('Failed to initiate login. Please try again.');
    }
  };

  const handleLogout = () => {
    GoHighLevelAPI.logout();
    setIsAuthenticated(false);
    setUser(null);
    setError(null);
  };

  const clearError = () => {
    setError(null);
  };

  // Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <Loader className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Loading...</h2>
          <p className="text-gray-600">
            {showAuthCallback ? 'Completing authentication...' : 'Initializing application...'}
          </p>
        </div>
      </div>
    );
  }

  // Error screen
  if (error && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-red-700 transition-colors duration-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Authentication screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-xl font-bold">CF</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Contact Finder</h1>
            <p className="text-gray-600">
              Discover and import high-quality leads using AI-powered search
            </p>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Connect with GoHighLevel</h2>
            <p className="text-sm text-gray-600 mb-4">
              Authenticate with your GoHighLevel account to start importing contacts
            </p>
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center justify-center space-x-2"
          >
            <span>Connect GoHighLevel</span>
          </button>

          <div className="mt-6 text-xs text-gray-500">
            <p>By connecting, you agree to allow Contact Finder to:</p>
            <ul className="mt-2 space-y-1">
              <li>• Read and write contacts</li>
              <li>• Create smart lists</li>
              <li>• Access location information</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Main application
  return (
    <div className="App">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">CF</span>
              </div>
              <h1 className="text-xl font-bold text-gray-800">Contact Finder</h1>
            </div>

            <div className="flex items-center space-x-4">
              {user && (
                <div className="text-sm text-gray-600">
                  Welcome, {user.firstName || user.name || 'User'}
                </div>
              )}
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
              <p className="text-red-700">{error}</p>
            </div>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-600 transition-colors duration-200"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Success Alert for completed actions */}
      {/* This would be managed by ContactFinder component */}

      {/* Main Content */}
      <main>
        <ContactFinder 
          onError={setError}
          onClearError={clearError}
        />
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600">
            <p className="text-sm">
              Contact Finder v1.0.0 - Powered by Exa.ai and GoHighLevel
            </p>
            <p className="text-xs mt-2">
              Made with ❤️ for better lead generation
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;