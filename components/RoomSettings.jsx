import React from 'react';

function RoomSettings({ room, onClose }) {
  const [settings, setSettings] = React.useState({
    muteAll: false,
    requireApproval: false,
    languageFilter: false
  });

  const handleSettingChange = (setting) => {
    setSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
  };

  const handleGenerateSummary = async () => {
    try {
      const response = await fetch('/api/ai_completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Generate a concise summary of the chat conversation.
          
          {
            "summary": string,
            "keyPoints": string[]
          }
          
          {
            "summary": "Team discussed project timeline and assigned tasks",
            "keyPoints": [
              "Deadline moved to next Friday",
              "John will handle frontend",
              "API documentation needed"
            ]
          }`,
          data: room.messages // Pass chat history
        })
      });
      
      const summary = await response.json();
      // Handle summary display
    } catch (error) {
      console.error('Error generating summary:', error);
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Room Settings</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span>Mute All Participants</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.muteAll}
              onChange={() => handleSettingChange('muteAll')}
            />
            <span className="slider round"></span>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <span>Require Message Approval</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.requireApproval}
              onChange={() => handleSettingChange('requireApproval')}
            />
            <span className="slider round"></span>
          </label>
        </div>

        <div className="flex items-center justify-between">
          <span>Language Filter</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.languageFilter}
              onChange={() => handleSettingChange('languageFilter')}
            />
            <span className="slider round"></span>
          </label>
        </div>

        {room.features.aiFeatures && (
          <button
            onClick={handleGenerateSummary}
            className="w-full mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Generate Chat Summary
          </button>
        )}

        <div className="mt-6 pt-6 border-t">
          <h4 className="font-semibold mb-2">Share Room</h4>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={room.id}
              readOnly
              className="flex-1 px-3 py-2 border rounded bg-gray-50"
            />
            <button
              onClick={() => navigator.clipboard.writeText(room.id)}
              className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200"
            >
              Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoomSettings;