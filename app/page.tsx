'use client';

import { useState, useEffect } from 'react';
import type { Stats, ConnectionSuggestion, ErrorLog } from '../types/shared';
import { SETTINGS_KEY } from '../types/shared';

export default function LinkedInAutomator() {
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [stats, setStats] = useState<Stats>({
    connectionsSuggested: 0,
    postsLiked: 0,
    messagesSent: 0,
    lastActivity: 'No activity yet',
    lastRun: 0
  });
  const [suggestions, setSuggestions] = useState<ConnectionSuggestion[]>([]);
  const [errorLog, setErrorLog] = useState<ErrorLog[]>([]);

  // Load state from localStorage on mount
  useEffect(() => {
    const loadState = () => {
      try {
        const savedEnabled = localStorage.getItem(`${SETTINGS_KEY}-enabled`);
        const savedStats = localStorage.getItem(`${SETTINGS_KEY}-stats`);
        const savedSuggestions = localStorage.getItem(`${SETTINGS_KEY}-suggestions`);
        const savedErrors = localStorage.getItem(`${SETTINGS_KEY}-errors`);

        if (savedEnabled !== null) {
          setIsActive(savedEnabled === 'true');
        }

        if (savedStats) {
          setStats(JSON.parse(savedStats));
        }

        if (savedSuggestions) {
          setSuggestions(JSON.parse(savedSuggestions));
        }

        if (savedErrors) {
          setErrorLog(JSON.parse(savedErrors));
        }
      } catch (err) {
        console.error('Failed to load state:', err);
        setError('Failed to load saved state');
      }
    };

    loadState();

    // Poll for updates every 5 seconds
    const interval = setInterval(loadState, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleToggleAutomation = async () => {
    setIsLoading(true);
    setError('');

    try {
      const newState = !isActive;

      // Save to localStorage (in a real Screenpipe integration, this would use pipe.settings)
      localStorage.setItem(`${SETTINGS_KEY}-enabled`, String(newState));

      setIsActive(newState);

      const activity = `Automation ${newState ? 'started' : 'stopped'} at ${new Date().toLocaleTimeString()}`;

      const updatedStats = {
        ...stats,
        lastActivity: activity
      };

      setStats(updatedStats);
      localStorage.setItem(`${SETTINGS_KEY}-stats`, JSON.stringify(updatedStats));
    } catch (err) {
      console.error('Failed to toggle automation:', err);
      setError('Failed to toggle automation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetStats = () => {
    const resetStats: Stats = {
      connectionsSuggested: 0,
      postsLiked: 0,
      messagesSent: 0,
      lastActivity: 'Stats reset',
      lastRun: 0
    };

    setStats(resetStats);
    setSuggestions([]);
    setErrorLog([]);

    localStorage.setItem(`${SETTINGS_KEY}-stats`, JSON.stringify(resetStats));
    localStorage.removeItem(`${SETTINGS_KEY}-suggestions`);
    localStorage.removeItem(`${SETTINGS_KEY}-errors`);
  };

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Card */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">GR LinkedIn Automator</h1>
              <p className="text-gray-600 mt-2">AI-powered LinkedIn business development automation</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`w-4 h-4 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium">
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              <p className="text-sm font-medium">Error: {error}</p>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Connections</h3>
              <p className="text-3xl font-bold text-blue-600">{stats.connectionsSuggested}</p>
              <p className="text-xs text-blue-700 mt-1">Suggested today</p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">Engagement</h3>
              <p className="text-3xl font-bold text-green-600">{stats.postsLiked}</p>
              <p className="text-xs text-green-700 mt-1">Posts liked</p>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900 mb-2">Messages</h3>
              <p className="text-3xl font-bold text-purple-600">{stats.messagesSent}</p>
              <p className="text-xs text-purple-700 mt-1">Sent today</p>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleToggleAutomation}
              disabled={isLoading}
              className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
                isActive
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? 'Loading...' : (isActive ? 'Stop Automation' : 'Start Automation')}
            </button>

            <button
              onClick={handleResetStats}
              className="w-full py-2 px-6 rounded-lg font-medium bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors text-sm"
            >
              Reset Stats
            </button>
          </div>
        </div>

        {/* Activity Card */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-700">{stats.lastActivity}</p>
            <p className="text-xs text-gray-500 mt-2">Last run: {formatTimestamp(stats.lastRun)}</p>
          </div>
        </div>

        {/* Connection Suggestions */}
        {suggestions.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Recent Connection Suggestions</h3>
            <div className="space-y-3">
              {suggestions.map((suggestion, idx) => (
                <div key={idx} className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-blue-900">{suggestion.name}</h4>
                      <p className="text-sm text-blue-700">{suggestion.title}</p>
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 mt-2">{suggestion.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Log */}
        {errorLog.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Error Log</h3>
            <div className="space-y-2">
              {errorLog.slice(-5).reverse().map((log, idx) => (
                <div key={idx} className="bg-red-50 p-3 rounded-lg border border-red-100">
                  <p className="text-xs text-red-600 font-mono">{log.error}</p>
                  <p className="text-xs text-red-500 mt-1">{log.timestamp}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Features Card */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Automation Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 font-bold">🤝</span>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Smart Connections</h4>
                <p className="text-sm text-gray-600">AI identifies relevant professionals to connect with</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-600 font-bold">👍</span>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Post Engagement</h4>
                <p className="text-sm text-gray-600">Automatically like relevant industry posts</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-purple-600 font-bold">✉️</span>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Message Templates</h4>
                <p className="text-sm text-gray-600">Generate personalized outreach messages</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <span className="text-yellow-600 font-bold">📊</span>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Profile Analysis</h4>
                <p className="text-sm text-gray-600">Analyze profiles for connection opportunities</p>
              </div>
            </div>
          </div>
        </div>

        {/* How it Works */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h4 className="font-medium text-yellow-900 mb-3">How it works</h4>
          <div className="space-y-2 text-sm text-yellow-800">
            <p>
              1. <strong>Real-time Monitoring:</strong> The automation continuously monitors your LinkedIn activity
            </p>
            <p>
              2. <strong>AI Analysis:</strong> Uses advanced AI to analyze profiles, posts, and opportunities
            </p>
            <p>
              3. <strong>Smart Suggestions:</strong> Provides intelligent recommendations for connections and engagement
            </p>
            <p>
              4. <strong>Rate Limiting:</strong> Respects LinkedIn's usage patterns with 30-second cooldowns
            </p>
            <p className="mt-4 text-xs text-yellow-700">
              <strong>Note:</strong> Make sure you're logged into LinkedIn in your browser. The pipe runs through Screenpipe and analyzes page content in real-time.
            </p>
          </div>
        </div>

        {/* Safety Notice */}
        <div className="bg-gray-100 border border-gray-300 rounded-lg p-6">
          <h4 className="font-medium text-gray-900 mb-3">Safety & Compliance</h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li>✓ Only suggests actions - manual approval required</li>
            <li>✓ Respects LinkedIn's terms of service</li>
            <li>✓ Built-in rate limiting (30s between actions)</li>
            <li>✓ Conservative AI recommendations</li>
            <li>✓ Full activity logging and transparency</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
