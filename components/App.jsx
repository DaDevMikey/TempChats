import React from 'react';
import LandingPage from './LandingPage';
import CreateRoom from './CreateRoom';
import ChatRoom from './ChatRoom';
import WebsimSocket from './WebsimSocket'; // Assuming WebsimSocket is imported from this location

function calculateExpiry(duration) {
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + duration);
  return expiryDate.toISOString();
}

function App() {
  const [view, setView] = React.useState('login');
  const [currentRoom, setCurrentRoom] = React.useState(null);
  const [username, setUsername] = React.useState(null);

  React.useEffect(() => {
    // Check login status and expiry
    const savedUsername = localStorage.getItem('username');
    const loginTime = localStorage.getItem('loginTime');
    
    if (savedUsername && loginTime) {
      const loginDate = new Date(loginTime);
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      if (loginDate < oneMonthAgo) {
        // Auto logout if more than a month old
        handleLogout();
      } else {
        setUsername(savedUsername);
        setView('landing');
      }
    }
  }, []);

  const handleLogin = (username) => {
    localStorage.setItem('username', username);
    localStorage.setItem('loginTime', new Date().toISOString());
    setUsername(username);
    setView('landing');
  };

  const handleLogout = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('loginTime');
    setUsername(null);
    setView('login');
  };

  const handleCreateRoom = async (roomData) => {
    try {
      const room = new WebsimSocket();
      const roomConfig = await room.collection('room_config').create({
        ...roomData,
        created_at: new Date().toISOString(),
        expires_at: calculateExpiry(roomData.duration)
      });

      setCurrentRoom({ 
        id: roomConfig.id,
        ...roomData
      });
      setView('chat');
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Error creating room');
    }
  };

  const handleJoinRoom = async (roomId) => {
    try {
      const room = new WebsimSocket();
      const configs = await room.collection('room_config')
        .filter({ id: roomId })
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
      
      setCurrentRoom({ 
        id: roomId,
        ...config
      });
      setView('chat');
    } catch (error) {
      console.error('Error joining room:', error);
      alert('Error joining room');
    }
  };

  const renderView = () => {
    switch(view) {
      case 'login':
        return (
          <div>
            <h1>Login</h1>
            <input type="text" placeholder="Username" />
            <button onClick={() => handleLogin('username')}>Login</button>
          </div>
        );
      case 'landing':
        return <LandingPage onCreateRoom={() => setView('create')} onJoinRoom={handleJoinRoom} />;
      case 'create':
        return <CreateRoom onRoomCreated={handleCreateRoom} />;
      case 'chat':
        return <ChatRoom room={currentRoom} onLeave={() => setView('landing')} />;
      default:
        return <LandingPage />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex-shrink-0 cursor-pointer" onClick={() => setView('landing')}>
              <h1 className="text-2xl font-bold text-indigo-600">TempChat</h1>
            </div>
            <div className="flex items-center space-x-4">
              {view !== 'landing' && (
                <button
                  onClick={() => setView('landing')}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Exit Room
                </button>
              )}
              {username && (
                <button
                  onClick={handleLogout}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderView()}
      </main>
    </div>
  );
}

export default App;