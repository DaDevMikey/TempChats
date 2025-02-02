function CreateRoom({ onRoomCreated, onCancel }) {
  const [formData, setFormData] = React.useState({
    name: '',
    type: 'chat',
    duration: '1h',
    isPrivate: false,
    moderateContent: false,
    advancedModeration: false,
    ephemeralMessages: false,
    features: {
      whiteboard: false
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Please enter a room name');
      return;
    }

    try {
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const room = new WebsimSocket();
      const roomConfig = await room.collection('room_config').create({
        ...formData,
        room_code: roomCode,
        created_at: new Date().toISOString(),
        expires_at: calculateExpiry(formData.duration),
        active_users: []
      });

      onRoomCreated({ 
        id: roomConfig.id,
        room_code: roomCode,
        ...formData
      });
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Error creating room');
    }
  };

  const calculateExpiry = (duration) => {
    const now = new Date();
    switch(duration) {
      case '1h': return new Date(now.getTime() + 60*60*1000).toISOString();
      case '4h': return new Date(now.getTime() + 4*60*60*1000).toISOString();
      case '24h': return new Date(now.getTime() + 24*60*60*1000).toISOString();
      case '7d': return new Date(now.getTime() + 7*24*60*60*1000).toISOString();
      case '30d': return new Date(now.getTime() + 30*24*60*60*1000).toISOString();
      case '1y': return new Date(now.getTime() + 365*24*60*60*1000).toISOString();
      default: return new Date(now.getTime() + 60*60*1000).toISOString();
    }
  };

  return (
    <div className="max-w-2xl mx-auto dark-card p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-100">Create a New Room</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label className="block mb-2 text-gray-300">Room Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            placeholder="Enter room name"
            className="w-full dark-input"
            maxLength={50}
            required
          />
        </div>

        <div className="mb-6">
          <label className="block mb-2 text-gray-300">Room Type</label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({...formData, type: e.target.value})}
            className="w-full dark-input"
          >
            <option value="chat">Quick Chat</option>
            <option value="collaboration">Collaboration Suite</option>
            <option value="secure">Secure Meeting</option>
          </select>
        </div>

        <div className="mb-6">
          <label className="block mb-2 text-gray-300">Duration</label>
          <select
            value={formData.duration}
            onChange={(e) => setFormData({...formData, duration: e.target.value})}
            className="w-full dark-input"
          >
            <option value="1h">1 hour</option>
            <option value="4h">4 hours</option>
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="1y">1 year</option>
          </select>
        </div>

        <div className="mb-6">
          <label className="block mb-2 text-gray-300">Features</label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.features.whiteboard}
                onChange={(e) => setFormData({
                  ...formData,
                  features: {...formData.features, whiteboard: e.target.checked}
                })}
                className="mr-2 dark-input"
              />
              <span className="text-gray-300">Whiteboard</span>
            </label>
          </div>
        </div>

        <div className="mb-6">
          <label className="block mb-2 text-gray-300">Room Privacy</label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.isPrivate}
              onChange={(e) => setFormData({
                ...formData,
                isPrivate: e.target.checked
              })}
              className="mr-2 dark-input"
            />
            <span className="text-gray-300">Private room</span>
          </label>
        </div>

        <div className="mb-6">
          <label className="block mb-2 text-gray-300">Content Moderation</label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.moderateContent}
                onChange={(e) => setFormData({
                  ...formData,
                  moderateContent: e.target.checked
                })}
                className="mr-2 dark-input"
              />
              <span className="text-gray-300">Filter inappropriate content (racism, hate speech)</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.advancedModeration}
                onChange={(e) => setFormData({
                  ...formData,
                  advancedModeration: e.target.checked
                })}
                className="mr-2 dark-input"
              />
              <span className="text-gray-300">Advanced content filtering (includes common swear words)</span>
            </label>
          </div>
        </div>

        <div className="mb-6">
          <label className="block mb-2 text-gray-300">Message Settings</label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.ephemeralMessages}
                onChange={(e) => setFormData({
                  ...formData,
                  ephemeralMessages: e.target.checked
                })}
                className="mr-2 dark-input"
              />
              <span className="text-gray-300">Disappearing messages</span>
            </label>
          </div>
        </div>

        <div className="flex space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="w-full dark-button bg-gray-600 hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="w-full dark-button"
          >
            Create Room
          </button>
        </div>
      </form>
    </div>
  );
}