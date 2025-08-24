'use client';

import { useState, useEffect } from 'react';

export default function LinkedInAutomator() {
  const [isActive, setIsActive] = useState(false);
  const [lastActivity, setLastActivity] = useState<string>('');
  const [stats, setStats] = useState({
    connectionsSuggested: 0,
    postsLiked: 0,
    messagesSent: 0
  });

  const handleToggleAutomation = () => {
    setIsActive(!isActive);
    setLastActivity(`Automation ${!isActive ? 'started' : 'stopped'} at ${new Date().toLocaleTimeString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">GR LinkedIn Automator</h1>
              <p className="text-gray-600 mt-2">Automate your LinkedIn business development activities</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`w-4 h-4 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium">
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Automation Features</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Smart connection suggestions</li>
                <li>• Automatic post engagement</li>
                <li>• Message automation</li>
                <li>• Profile optimization</li>
              </ul>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">Today's Stats</h3>
              <div className="text-sm text-green-800 space-y-1">
                <div>Connections suggested: {stats.connectionsSuggested}</div>
                <div>Posts liked: {stats.postsLiked}</div>
                <div>Messages sent: {stats.messagesSent}</div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleToggleAutomation}
              className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
                isActive
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isActive ? 'Stop Automation' : 'Start Automation'}
            </button>

            {lastActivity && (
              <div className="bg-gray-100 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Last Activity</h4>
                <p className="text-sm text-gray-600">{lastActivity}</p>
              </div>
            )}

            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-medium text-yellow-900 mb-2">How it works</h4>
              <p className="text-sm text-yellow-800">
                This pipe analyzes your LinkedIn activity in real-time and suggests automation actions. 
                It uses AI to identify relevant connections, posts to engage with, and opportunities for business development.
                Make sure you're logged into LinkedIn in your browser for the automation to work.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
