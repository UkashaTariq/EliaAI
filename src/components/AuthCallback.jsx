// src/components/AuthCallback.jsx
import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';

const AuthCallback = ({ onSuccess, onError }) => {
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      const errorDescription = urlParams.get('error_description');

      if (error) {
        setStatus('error');
        setMessage(errorDescription || `Authentication error: ${error}`);
        if (onError) {
          onError(errorDescription || `Authentication error: ${error}`);
        }
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('No authorization code received');
        if (onError) {
          onError('No authorization code received');
        }
        return;
      }

      // Processing authentication
      setMessage('Exchanging authorization code for access token...');
      
      // Simulate processing time for better UX
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setStatus('success');
      setMessage('Authentication successful! Redirecting...');
      
      if (onSuccess) {
        setTimeout(() => {
          onSuccess(code);
        }, 1500);
      }

    } catch (error) {
      console.error('Auth callback error:', error);
      setStatus('error');
      setMessage('Authentication failed. Please try again.');
      if (onError) {
        onError('Authentication failed. Please try again.');
      }
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'processing':
        return (
          <>
            <Loader className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Authenticating...
            </h2>
            <p className="text-gray-600">{message}</p>
          </>
        );

      case 'success':
        return (
          <>
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Success!
            </h2>
            <p className="text-gray-600">{message}</p>
          </>
        );

      case 'error':
        return (
          <>
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Authentication Failed
            </h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={() => window.location.href = '/'}
              className="bg-blue-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200"
            >
              Return to App
            </button>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
        {renderContent()}
      </div>
    </div>
  );
};

export default AuthCallback;