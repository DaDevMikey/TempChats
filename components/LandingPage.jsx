import React from 'react';

function LandingPage({ onCreateRoom, onJoinRoom }) {
  const [joinCode, setJoinCode] = React.useState('');
  const [publicRooms, setPublicRooms] = React.useState([]);
  const roomConnection = React.useRef(null);

  React.useEffect(() => {
    roomConnection.current = new WebsimSocket();
    
    const unsubscribe = roomConnection.current.collection('room_config')
      .filter({ isPrivate: false })
      .subscribe(async (rooms) => {
        // Filter out expired rooms
        const now = new Date().toISOString();
        const activeRooms = rooms.filter(room => room.expires_at > now);

        // Get latest message for each room
        const roomsWithMessages = await Promise.all(
          activeRooms.map(async (room) => {
            const messages = await roomConnection.current.collection('message')
              .filter({ room_id: room.id })
              .getList();

            const latestMessage = messages.sort((a, b) => 
              new Date(b.created_at) - new Date(a.created_at)
            )[0];

            return {
              ...room,
              latestMessage: latestMessage?.content || 'No messages yet'
            };
          })
        );

        setPublicRooms(roomsWithMessages);
      });

    return () => {
      unsubscribe();
      roomConnection.current = null;
    };
  }, []);

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    if (joinCode.trim()) {
      try {
        const room = new WebsimSocket();
        const configs = await room.collection('room_config')
          .filter({ room_code: joinCode.trim().toUpperCase() })
          .getList();
        
        if (!configs || configs.length === 0) {
          alert('Room not found');
          return;
        }
        
        const config = configs[0];
        
        // Check if room has expired
        if (new Date(config.expires_at) < new Date()) {
          alert('This room has expired');
          return;
        }

        onJoinRoom(config);
        setJoinCode('');
      } catch (error) {
        console.error('Error joining room:', error);
        alert('Error joining room');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto text-center">
      <h1 className="text-4xl font-bold mb-8 text-gray-100">
        Create Secure, Temporary Chat Rooms
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div className="dark-card p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 text-gray-100">Create a Room</h2>
          <p className="mb-4 text-gray-300">Start a new chat room with custom settings</p>
          <button
            onClick={onCreateRoom}
            className="w-full dark-button"
          >
            Create Room
          </button>
        </div>

        <div className="dark-card p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 text-gray-100">Join Private Room</h2>
          <form onSubmit={handleJoinSubmit}>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Enter room code"
              className="w-full dark-input mb-4"
            />
            <button
              type="submit"
              className="w-full dark-button"
            >
              Join Room
            </button>
          </form>
        </div>
      </div>

      <div className="dark-card p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-6 text-gray-100">Public Rooms</h2>
        <div className="space-y-4">
          {publicRooms.map(room => (
            <div key={room.id} className="room-preview">
              <div className="room-preview-content">
                <h3 className="font-semibold text-gray-100">{room.name || 'Unnamed Room'}</h3>
                <p className="room-preview-message">{room.latestMessage}</p>
                <p className="text-sm text-gray-400">
                  Active users: {room.active_users?.length || 0} | 
                  Type: {room.type} |
                  Expires: {new Date(room.expires_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => onJoinRoom(room)}
                className="dark-button"
              >
                Join
              </button>
            </div>
          ))}
          {publicRooms.length === 0 && (
            <p className="text-gray-400">No public rooms available</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default LandingPage;